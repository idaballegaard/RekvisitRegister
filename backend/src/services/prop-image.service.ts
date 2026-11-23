import { randomBytes } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'
import { ObjectId } from 'mongodb'
import sharp from 'sharp'
import { getDatabase } from '../config/database.ts'
import type { PropDocument } from '../models/prop.model.ts'

export class ImageInputError extends Error {}
export class ImageNotFoundError extends Error {}
export class ImageLimitError extends Error {}

const imageIdPattern = /^[a-f\d]{24}$/

function imagePath(imageId: string): string {
  if (!imageIdPattern.test(imageId)) {
    throw new ImageNotFoundError()
  }
  const directory = process.env.PROP_IMAGE_DIR || join(homedir(), '.rekvisit-register', 'images')
  if (!isAbsolute(directory)) {
    throw new Error('PROP_IMAGE_DIR skal være en absolut sti.')
  }
  return join(directory, `${imageId}.webp`)
}

function ids(associationId: string, propId: string): { associationId: ObjectId; _id: ObjectId } {
  if (!imageIdPattern.test(associationId.toLowerCase()) || !imageIdPattern.test(propId.toLowerCase())) {
    throw new ImageNotFoundError()
  }
  return { associationId: new ObjectId(associationId), _id: new ObjectId(propId) }
}

export async function uploadPropImage(
  associationId: string,
  propId: string,
  contentType: string,
  input: Buffer,
): Promise<string> {
  const filter = ids(associationId, propId)
  const collection = getDatabase().collection<PropDocument>('prop')
  if (!await collection.findOne(filter, { projection: { _id: 1 } })) {
    throw new ImageNotFoundError()
  }
  if (!Buffer.isBuffer(input) || input.length === 0 || input.length > 5 * 1024 * 1024) {
    throw new ImageInputError('Billedet skal være mellem 1 byte og 5 MB.')
  }
  const formats: Record<string, string> = {
    'image/jpeg': 'jpeg',
    'image/png': 'png',
    'image/webp': 'webp',
  }
  if (!Object.hasOwn(formats, contentType)) {
    throw new ImageInputError('Kun JPEG, PNG og WebP er tilladt.')
  }
  const isExpectedFormat = contentType === 'image/jpeg'
    ? input.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
    : contentType === 'image/png'
      ? input.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      : input.subarray(0, 4).toString('ascii') === 'RIFF'
        && input.subarray(8, 12).toString('ascii') === 'WEBP'
  if (!isExpectedFormat) {
    throw new ImageInputError('Filens indhold svarer ikke til en understøttet billedtype.')
  }

  let encoded: Buffer
  try {
    const image = sharp(input, { limitInputPixels: 40_000_000, failOn: 'warning' })
    const metadata = await image.metadata()
    if (metadata.format !== formats[contentType] || (metadata.pages ?? 1) !== 1) {
      throw new ImageInputError('Filens indhold svarer ikke til en understøttet billedtype.')
    }
    encoded = await image.rotate().webp({ quality: 85 }).toBuffer()
  } catch (error) {
    if (error instanceof ImageInputError) throw error
    throw new ImageInputError('Billedfilen er ugyldig eller for stor.')
  }

  const imageId = randomBytes(12).toString('hex')
  const path = imagePath(imageId)
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await writeFile(path, encoded, { flag: 'wx', mode: 0o600 })
  try {
    const result = await collection.updateOne(
      { ...filter, 'imageIds.9': { $exists: false } },
      { $push: { imageIds: imageId } },
    )
    if (!result.matchedCount) {
      if (!await collection.findOne(filter, { projection: { _id: 1 } })) {
        throw new ImageNotFoundError()
      }
      throw new ImageLimitError('En rekvisit kan højst have 10 billeder.')
    }
  } catch (error) {
    try {
      await unlink(path)
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], 'Billedet kunne ikke gemmes, og oprydning fejlede.')
    }
    throw error
  }
  return imageId
}

export async function readPropImage(
  associationId: string,
  propId: string,
  imageId: string,
): Promise<Buffer> {
  const path = imagePath(imageId)
  const prop = await getDatabase().collection<PropDocument>('prop')
    .findOne({ ...ids(associationId, propId), imageIds: imageId }, { projection: { _id: 1 } })
  if (!prop) throw new ImageNotFoundError()
  return readFile(path)
}

export async function deletePropImage(
  associationId: string,
  propId: string,
  imageId: string,
): Promise<void> {
  const path = imagePath(imageId)
  const result = await getDatabase().collection<PropDocument>('prop').updateOne(
    { ...ids(associationId, propId), imageIds: imageId },
    { $pull: { imageIds: imageId } },
  )
  if (!result.matchedCount) throw new ImageNotFoundError()
  await unlink(path)
}
