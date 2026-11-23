import { ObjectId, type WithId } from 'mongodb'
import type {
  AssociationProp,
  PropDocument,
  UpdateAssociationPropInput,
} from '../models/prop.model.ts'
import { findAssociationById } from '../repositories/association.repository.ts'
import {
  createProp,
  findPropsByAssociationId,
  updatePropByIdForAssociation,
} from '../repositories/prop.repository.ts'

export class AssociationPropsError extends Error {}
export class AssociationPropNotFoundError extends Error {}
export class InvalidAssociationPropInputError extends Error {}
export class AssociationPropStorageLocationNotFoundError extends Error {}

export function validateUpdateAssociationPropInput(input: unknown): UpdateAssociationPropInput {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new InvalidAssociationPropInputError('Rekvisittens oplysninger er ugyldige.')
  }

  const value = input as Record<string, unknown>
  const name = requireText(value.name, 'Navn', 120, true)
  const description = requireText(value.description, 'Beskrivelse', 2000)
  const storageLocationId = requireText(value.storageLocationId, 'Lageradresse', 24, true)
  if (!/^[a-f\d]{24}$/i.test(storageLocationId)) {
    throw new InvalidAssociationPropInputError('Vælg en gyldig lageradresse.')
  }
  if (typeof value.availability !== 'boolean') {
    throw new InvalidAssociationPropInputError('Tilgængelighed skal angives.')
  }
  if (typeof value.dimensions !== 'object' || value.dimensions === null
    || Array.isArray(value.dimensions)) {
    throw new InvalidAssociationPropInputError('Rekvisittens mål er ugyldige.')
  }

  const dimensions = value.dimensions as Record<string, unknown>
  const height = requireNonNegativeNumber(dimensions.height, 'Højde')
  const width = requireNonNegativeNumber(dimensions.width, 'Bredde')
  const depth = requireNonNegativeNumber(dimensions.depth, 'Dybde')
  const unit = requireText(dimensions.unit, 'Måleenhed', 20, true)
  if (!Number.isInteger(value.quantity) || (value.quantity as number) < 1) {
    throw new InvalidAssociationPropInputError('Antal skal være et helt tal på mindst 1.')
  }
  if (!Array.isArray(value.tags)
    || value.tags.length > 30
    || !value.tags.every((tag) => (
      typeof tag === 'string' && tag.trim().length > 0 && tag.trim().length <= 50
    ))) {
    throw new InvalidAssociationPropInputError('Tags skal være tekst på højst 50 tegn (maks. 30 tags).')
  }

  return {
    name,
    description,
    storageLocationId,
    availability: value.availability,
    dimensions: { height, width, depth, unit },
    quantity: value.quantity as number,
    colour: requireText(value.colour, 'Farve', 80),
    placement: requireText(value.placement, 'Placering', 120),
    tags: value.tags.map((tag) => (tag as string).trim()),
    condition: requireText(value.condition, 'Stand', 500),
    historicalPeriod: requireText(value.historicalPeriod, 'Tidsalder', 100),
  }
}

function requireText(
  value: unknown,
  label: string,
  maximumLength: number,
  required = false,
): string {
  if (typeof value !== 'string' || value.trim().length > maximumLength
    || (required && !value.trim())) {
    throw new InvalidAssociationPropInputError(
      `${label} ${required ? 'skal udfyldes' : 'må højst være'}${required ? '' : ` ${maximumLength} tegn`}.`,
    )
  }
  return value.trim()
}

function requireNonNegativeNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new InvalidAssociationPropInputError(`${label} skal være et tal på mindst 0.`)
  }
  return value
}

export async function getAssociationProps(associationId: string): Promise<AssociationProp[]> {
  if (!/^[a-f\d]{24}$/i.test(associationId)) {
    throw new AssociationPropsError('Forenings-id’et er ugyldigt.')
  }
  const props = await findPropsByAssociationId(new ObjectId(associationId))
  if (!props.every(isValidProp)) {
    throw new AssociationPropsError('En eller flere rekvisitter har ugyldige databaseoplysninger.')
  }
  return props.map(toAssociationProp)
}

async function validateStorageLocation(associationId: ObjectId, locationId: ObjectId): Promise<void> {
  const association = await findAssociationById(associationId)
  if (!association?.storageLocationIds?.some((id) => id.equals(locationId))) {
    throw new AssociationPropStorageLocationNotFoundError()
  }
}

export async function createAssociationProp(
  associationId: string,
  input: UpdateAssociationPropInput,
): Promise<AssociationProp> {
  if (!/^[a-f\d]{24}$/i.test(associationId)) {
    throw new AssociationPropsError('Forenings-id’et er ugyldigt.')
  }
  const associationObjectId = new ObjectId(associationId)
  const storageLocationId = new ObjectId(input.storageLocationId)
  await validateStorageLocation(associationObjectId, storageLocationId)
  const prop = await createProp({
    ...input,
    associationId: associationObjectId,
    storageLocationId,
  })
  return toAssociationProp(prop)
}

export async function updateAssociationProp(
  associationId: string,
  propId: string,
  input: UpdateAssociationPropInput,
): Promise<AssociationProp> {
  if (!/^[a-f\d]{24}$/i.test(associationId) || !/^[a-f\d]{24}$/i.test(propId)) {
    throw new AssociationPropNotFoundError()
  }
  const associationObjectId = new ObjectId(associationId)
  const normalizedPropId = new ObjectId(propId).toHexString()
  const storageLocationId = new ObjectId(input.storageLocationId)
  await validateStorageLocation(associationObjectId, storageLocationId)

  const { storageLocationId: _, ...rest } = input
  const updated = await updatePropByIdForAssociation(
    new ObjectId(propId),
    associationObjectId,
    { ...rest, storageLocationId },
  )
  if (!updated) {
    throw new AssociationPropNotFoundError()
  }

  const props = await getAssociationProps(associationId)
  const prop = props.find(({ id }) => id === normalizedPropId)
  if (!prop) {
    throw new AssociationPropNotFoundError()
  }
  return prop
}

function isValidProp(value: unknown): value is WithId<PropDocument> {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const prop = value as Partial<WithId<PropDocument>>
  const dimensions = prop.dimensions
  return prop._id instanceof ObjectId
    && typeof prop.name === 'string'
    && typeof prop.description === 'string'
    && prop.associationId instanceof ObjectId
    && prop.storageLocationId instanceof ObjectId
    && typeof prop.availability === 'boolean'
    && typeof dimensions === 'object'
    && dimensions !== null
    && typeof dimensions.height === 'number'
    && Number.isFinite(dimensions.height)
    && typeof dimensions.width === 'number'
    && Number.isFinite(dimensions.width)
    && typeof dimensions.depth === 'number'
    && Number.isFinite(dimensions.depth)
    && typeof dimensions.unit === 'string'
    && typeof prop.quantity === 'number'
    && Number.isFinite(prop.quantity)
    && typeof prop.colour === 'string'
    && typeof prop.placement === 'string'
    && Array.isArray(prop.tags)
    && prop.tags.every((tag) => typeof tag === 'string')
    && typeof prop.condition === 'string'
    && typeof prop.historicalPeriod === 'string'
    && (prop.imageIds === undefined || (
      Array.isArray(prop.imageIds)
      && prop.imageIds.every((id) => typeof id === 'string' && /^[a-f\d]{24}$/.test(id))
    ))
}

function toAssociationProp(prop: WithId<PropDocument>): AssociationProp {
  return {
    id: prop._id.toHexString(),
    name: prop.name,
    description: prop.description,
    storageLocationId: prop.storageLocationId.toHexString(),
    availability: prop.availability,
    dimensions: prop.dimensions,
    quantity: prop.quantity,
    colour: prop.colour,
    placement: prop.placement,
    tags: prop.tags,
    condition: prop.condition,
    historicalPeriod: prop.historicalPeriod,
    ...(prop.imageIds ? { imageIds: prop.imageIds } : {}),
  }
}
