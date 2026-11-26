import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import express from 'express'
import { MongoMemoryReplSet } from 'mongodb-memory-server'
import { ObjectId } from 'mongodb'
import sharp from 'sharp'
import type { Server } from 'node:http'
import test, { after, before, describe } from 'node:test'
import { closeDatabase, connectToDatabase, getDatabase } from '../config/database.ts'
import type { PropDocument } from '../models/prop.model.ts'
import type { ReservationDocument } from '../models/reservation.model.ts'
import { LOAN_STATUSES, type LoanDocument } from '../models/loan.model.ts'
import type { StorageLocationDocument } from '../models/storage-location.model.ts'
import { ROLES, type UserDocument } from '../models/user.model.ts'
import type { AssociationDocument } from '../models/association.model.ts'
import associationRouter from '../routes/association.routes.ts'
import authRouter from '../routes/auth.routes.ts'
import { createAccessToken } from './access-token.service.ts'
import { requestEmailVerification, requestPasswordReset } from './auth.service.ts'
import { hashPassword, verifyPassword } from './user.service.ts'
import {
  acceptAssociationUserInvitation,
  AssociationUserInvitationDeliveryError,
  InvalidInvitationError,
  inviteAssociationUser,
  resendAssociationUserInvitation,
} from './association-user.service.ts'

const testPassword = 'integration-test-passphrase'
const testEmail = 'integration@example.dk'
const testSigningSecret = 'integration-test-signing-secret-with-32-bytes'
const testAssociationName = 'Integration Theatre'
const environmentKeys = [
  'MONGODB_URI',
  'MONGODB_DB_NAME',
  'AUTH_TOKEN_SECRET',
  'FRONTEND_BASE_URL',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'SMTP_FROM',
  'PROP_IMAGE_DIR',
] as const
const originalEnvironment = new Map(
  environmentKeys.map((key) => [key, process.env[key]]),
)

let mongoServer: MongoMemoryReplSet | undefined
let httpServer: Server | undefined
let baseUrl: string
let expectedAssociationId: ObjectId
let storageLocationIds: [ObjectId, ObjectId]
let expectedUserId: string
let reservedEmailUserId: ObjectId
let authenticatedAccessToken: string
let associationManagerAccessToken: string
let imageDirectory: string | undefined

describe('auth endpoints with MongoDB', () => {
  before(async () => {
    mongoServer = await MongoMemoryReplSet.create({
      replSet: { count: 1, dbName: 'auth_integration_test' },
    })
    process.env.MONGODB_URI = mongoServer.getUri()
    process.env.MONGODB_DB_NAME = 'auth_integration_test'
    process.env.AUTH_TOKEN_SECRET = testSigningSecret
    process.env.FRONTEND_BASE_URL = 'http://localhost:5173'
    process.env.SMTP_HOST = 'smtp.example.test'
    process.env.SMTP_PORT = '587'
    process.env.SMTP_USER = 'smtp-user'
    process.env.SMTP_PASSWORD = 'smtp-password'
    process.env.SMTP_FROM = 'Rekvisit Test <no-reply@example.test>'
    imageDirectory = await mkdtemp(join(tmpdir(), 'rekvisit-images-test-'))
    process.env.PROP_IMAGE_DIR = imageDirectory

    await connectToDatabase()
    expectedAssociationId = new ObjectId()
    storageLocationIds = [new ObjectId(), new ObjectId()]
    const storageLocations: StorageLocationDocument[] = [
      { address: 'Industrivej 7', postalCode: '6740', city: 'Bramming' },
      { address: 'Teatergade 2', postalCode: '6700', city: 'Esbjerg' },
    ]
    await getDatabase().collection<StorageLocationDocument>('storagelocation').insertMany(
      storageLocations.map((location, index) => ({
        _id: storageLocationIds[index],
        ...location,
      })),
    )
    const association: AssociationDocument = {
      name: testAssociationName,
      storageLocationIds,
      contactPerson: {
        name: 'Association Contact',
        email: 'contact@example.dk',
        phone: '+45 12345678',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    await getDatabase().collection<AssociationDocument>('associations')
      .insertOne({ _id: expectedAssociationId, ...association })
    const propId = new ObjectId('6b002a5c3c49f74ff7188de8')
    const props: PropDocument[] = [
      {
        name: 'Træstol',
        description: 'Mørk træstol med polstret sæde.',
        associationId: expectedAssociationId,
        storageLocationId: storageLocationIds[0],
        availability: true,
        dimensions: { height: 90, width: 45, depth: 45, unit: 'cm' },
        quantity: 1,
        colour: 'Mørkebrun',
        placement: 'Reol 3',
        tags: ['stol', 'træstol', 'møbel', 'polstret'],
        condition: 'God stand med lette brugsspor',
        historicalPeriod: '1920’erne',
      },
    ]
    await getDatabase().collection<PropDocument>('prop').insertOne({
      _id: propId,
      ...props[0],
    })
    const user: UserDocument = {
      firstName: 'Integration',
      lastName: 'Tester',
      userName: 'integration.test',
      email: testEmail,
      emailVerifiedAt: new Date(),
      passwordHash: await hashPassword(testPassword),
      role: ROLES.ASSOCIATION_ADMIN,
      associationId: expectedAssociationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const insertResult = await getDatabase().collection<UserDocument>('users').insertOne(user)
    expectedUserId = insertResult.insertedId.toHexString()
    const reservedEmailUser: UserDocument = {
      firstName: 'Reserved',
      lastName: user.lastName,
      userName: 'reserved.email',
      email: 'reserved@example.dk',
      emailVerifiedAt: new Date(),
      passwordHash: user.passwordHash,
      role: user.role,
      associationId: expectedAssociationId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    }
    const reservedUserResult = await getDatabase().collection<UserDocument>('users')
      .insertOne(reservedEmailUser)
    reservedEmailUserId = reservedUserResult.insertedId
    await getDatabase().collection<UserDocument>('users').insertOne({
      firstName: 'Integration',
      lastName: 'Manager',
      userName: 'integration.manager',
      email: 'manager@example.dk',
      passwordHash: user.passwordHash,
      role: ROLES.PROP_MANAGER,
      associationId: expectedAssociationId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })
    await getDatabase().collection<UserDocument>('users').insertOne({
      firstName: 'Integration',
      lastName: 'Searcher',
      userName: 'integration.search',
      email: 'search@example.dk',
      emailVerifiedAt: new Date(),
      passwordHash: user.passwordHash,
      role: ROLES.SEARCH_USER,
      associationId: expectedAssociationId,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    })

    const app = express()
    app.use(express.json())
    app.use(associationRouter)
    app.use(authRouter)

    httpServer = app.listen(0)
    await once(httpServer, 'listening')
    const address = httpServer.address()
    assert.ok(address && typeof address !== 'string')
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  after(async () => {
    if (httpServer?.listening) {
      await new Promise<void>((resolve, reject) => {
        httpServer?.close((error) => error ? reject(error) : resolve())
      })
    }
    await closeDatabase()
    await mongoServer?.stop()
    if (imageDirectory) await rm(imageDirectory, { recursive: true, force: true })

    for (const key of environmentKeys) {
      const originalValue = originalEnvironment.get(key)
      if (originalValue === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = originalValue
      }
    }
  })

  test('logs in an existing database user and returns a token without password data', async () => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: ' Integration.Test ', password: testPassword }),
    })

    assert.equal(response.status, 200)
    const body = await response.json() as {
      tokenType: string
      expiresIn: number
      accessToken: string
      user: Record<string, unknown>
    }
    assert.equal(body.tokenType, 'Bearer')
    assert.equal(body.expiresIn, 900)
    assert.ok(body.accessToken)
    authenticatedAccessToken = body.accessToken
    assert.deepEqual(body.user, {
      userId: expectedUserId,
      firstName: 'Integration',
      lastName: 'Tester',
      userName: 'integration.test',
      role: ROLES.ASSOCIATION_ADMIN,
      associationId: expectedAssociationId.toHexString(),
    })
    assert.equal('password' in body.user, false)
    assert.equal('passwordHash' in body.user, false)
  })

  test('rejects an incorrect password', async () => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: 'integration.test', password: 'wrong-password' }),
    })

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      error: 'Brugernavn eller adgangskode er forkert',
    })
  })

  test('rejects an unknown username with the same unauthorized response', async () => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: 'unknown.user', password: testPassword }),
    })

    assert.equal(response.status, 401)
    assert.deepEqual(await response.json(), {
      error: 'Brugernavn eller adgangskode er forkert',
    })
  })

  test('rejects invalid login input', async () => {
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: 'integration.test' }),
    })

    assert.equal(response.status, 400)
  })

  test('requires authentication to list the current association props', async () => {
    const response = await fetch(`${baseUrl}/associations/current/props`)
    assert.equal(response.status, 401)
  })

  test('lists only props belonging to the authenticated association', async () => {
    assert.ok(authenticatedAccessToken)
    const foreignAssociationId = new ObjectId()
    await getDatabase().collection<PropDocument>('prop').insertOne({
      name: 'Foreign prop',
      description: 'Belongs to another association.',
      associationId: foreignAssociationId,
      storageLocationId: new ObjectId(),
      availability: true,
      dimensions: { height: 1, width: 2, depth: 3, unit: 'cm' },
      quantity: 1,
      colour: '',
      placement: '',
      tags: [],
      condition: '',
      historicalPeriod: '',
    })

    const response = await fetch(`${baseUrl}/associations/current/props`, {
      headers: { Authorization: 'Bearer ' + authenticatedAccessToken },
    })

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      props: [{
        id: '6b002a5c3c49f74ff7188de8',
        name: 'Træstol',
        description: 'Mørk træstol med polstret sæde.',
        storageLocationId: storageLocationIds[0].toHexString(),
        availability: true,
        dimensions: { height: 90, width: 45, depth: 45, unit: 'cm' },
        quantity: 1,
        colour: 'Mørkebrun',
        placement: 'Reol 3',
        tags: ['stol', 'træstol', 'møbel', 'polstret'],
        condition: 'God stand med lette brugsspor',
        historicalPeriod: '1920’erne',
      }],
    })
  })

  test('creates a validated prop for the authenticated association', async () => {
    const url = `${baseUrl}/associations/current/props`
    const input = {
      name: ' Ny rekvisit ', description: 'En beskrivelse',
      storageLocationId: storageLocationIds[0].toHexString(), availability: true,
      dimensions: { height: 10, width: 20, depth: 30, unit: 'cm' },
      quantity: 1, colour: 'Blå', placement: 'Reol 1', tags: ['teater'],
      condition: 'God', historicalPeriod: '',
    }
    const headers = {
      Authorization: 'Bearer ' + authenticatedAccessToken,
      'Content-Type': 'application/json',
    }
    assert.equal((await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    })).status, 401)
    for (const invalid of [
      { ...input, name: '' },
      { ...input, quantity: 0 },
      { ...input, dimensions: { ...input.dimensions, width: -1 } },
      { ...input, storageLocationId: new ObjectId().toHexString() },
    ]) {
      assert.equal((await fetch(url, {
        method: 'POST', headers, body: JSON.stringify(invalid),
      })).status, 400)
    }
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...input, associationId: new ObjectId().toHexString(), imageIds: ['bad'] }),
    })
    assert.equal(response.status, 201)
    const body = await response.json() as { prop: { id: string; name: string; imageIds?: string[] } }
    assert.equal(body.prop.name, 'Ny rekvisit')
    assert.equal(body.prop.imageIds, undefined)
    const stored = await getDatabase().collection<PropDocument>('prop')
      .findOne({ _id: new ObjectId(body.prop.id) })
    assert.ok(stored?.associationId.equals(expectedAssociationId))
    assert.ok(stored?.storageLocationId.equals(storageLocationIds[0]))
    const listResponse = await fetch(url, { headers })
    const list = await listResponse.json() as { props: Array<{ id: string }> }
    assert.ok(list.props.some(({ id }) => id === body.prop.id))
    await getDatabase().collection<PropDocument>('prop').deleteOne({ _id: new ObjectId(body.prop.id) })
  })

  test('validates, stores, protects, limits and removes prop images', async () => {
      const propObjectId = new ObjectId()
      const propId = propObjectId.toHexString()
      await getDatabase().collection<PropDocument>('prop').insertOne({
        _id: propObjectId, name: 'Image test', description: '', associationId: expectedAssociationId,
        storageLocationId: storageLocationIds[0], availability: true,
        dimensions: { height: 1, width: 1, depth: 1, unit: 'cm' },
        quantity: 1, colour: '', placement: '', tags: [], condition: '', historicalPeriod: '',
      })
      const endpoint = `${baseUrl}/associations/current/props/${propId}/images`
      const image = await sharp({
        create: { width: 2, height: 2, channels: 3, background: '#ff0000' },
      }).png().toBuffer()
      const auth = { Authorization: 'Bearer ' + authenticatedAccessToken }
      const upload = (body: Buffer, contentType = 'image/png') => fetch(endpoint, {
        method: 'POST',
        headers: { ...auth, 'Content-Type': contentType },
        body: new Uint8Array(body),
      })

      assert.equal((await fetch(endpoint, { method: 'POST' })).status, 401)
      assert.equal((await upload(Buffer.from('not an image'))).status, 400)
      assert.equal((await upload(image, 'image/jpeg')).status, 400)
      assert.equal((await upload(image, 'image/svg+xml')).status, 400)
      assert.equal((await upload(Buffer.alloc(5 * 1024 * 1024 + 1))).status, 413)

      const response = await upload(image)
      assert.equal(response.status, 201)
      const { imageId } = await response.json() as { imageId: string }
      assert.match(imageId, /^[a-f\d]{24}$/)
      const imageUrl = `${endpoint}/${imageId}`
      assert.equal((await fetch(imageUrl)).status, 401)
      const readResponse = await fetch(imageUrl, { headers: auth })
      assert.equal(readResponse.status, 200)
      assert.equal(readResponse.headers.get('content-type'), 'image/webp')
      assert.equal((await sharp(Buffer.from(await readResponse.arrayBuffer())).metadata()).format, 'webp')

      const foreignId = new ObjectId()
      await getDatabase().collection<PropDocument>('prop').insertOne({
        name: 'Foreign image prop', description: '', associationId: new ObjectId(),
        storageLocationId: storageLocationIds[0], availability: true,
        dimensions: { height: 1, width: 1, depth: 1, unit: 'cm' },
        quantity: 1, colour: '', placement: '', tags: [], condition: '', historicalPeriod: '',
        imageIds: [imageId], _id: foreignId,
      })
      const foreignUrl = `${baseUrl}/associations/current/props/${foreignId.toHexString()}/images/${imageId}`
      assert.equal((await fetch(foreignUrl, { headers: auth })).status, 404)
      assert.equal((await fetch(foreignUrl, { method: 'DELETE', headers: auth })).status, 404)
      assert.equal((await fetch(`${baseUrl}/associations/current/props/${foreignId.toHexString()}/images`, {
        method: 'POST', headers: { ...auth, 'Content-Type': 'image/png' }, body: new Uint8Array(image),
      })).status, 404)

      const uploads = await Promise.all(Array.from({ length: 10 }, () => upload(image)))
      assert.equal(uploads.filter((result) => result.status === 201).length, 9)
      assert.equal(uploads.filter((result) => result.status === 400).length, 1)
      const prop = await getDatabase().collection<PropDocument>('prop').findOne({ _id: new ObjectId(propId) })
      assert.equal(prop?.imageIds?.length, 10)
      const listResponse = await fetch(`${baseUrl}/associations/current/props`, { headers: auth })
      const list = await listResponse.json() as { props: Array<{ id: string; imageIds?: string[] }> }
      assert.deepEqual(list.props.find((item) => item.id === propId)?.imageIds, prop?.imageIds)

      const deleted = await fetch(imageUrl, { method: 'DELETE', headers: auth })
      assert.equal(deleted.status, 200)
      assert.equal((await fetch(imageUrl, { headers: auth })).status, 404)
      assert.equal((await fetch(imageUrl, { method: 'DELETE', headers: auth })).status, 404)
      await getDatabase().collection<PropDocument>('prop').deleteOne({ _id: propObjectId })
  })

  test('updates only a valid prop owned by the authenticated association', async () => {
    const updatedInput = {
      name: 'Træstol med nyt sæde',
      description: 'En opdateret beskrivelse.',
      storageLocationId: storageLocationIds[1].toHexString(),
      availability: false,
      dimensions: { height: 91, width: 46, depth: 44, unit: 'cm' },
      quantity: 2,
      colour: 'Sort',
      placement: 'Reol 4',
      tags: ['stol', 'opdateret'],
      condition: 'Nyligt istandsat',
      historicalPeriod: '1920’erne',
    }
    const response = await fetch(
      `${baseUrl}/associations/current/props/6b002a5c3c49f74ff7188de8`,
      {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer ' + authenticatedAccessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedInput),
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      message: 'Rekvisitten er opdateret.',
      prop: {
        id: '6b002a5c3c49f74ff7188de8',
        ...updatedInput,
      },
    })

    const foreignAssociationId = new ObjectId()
    const foreignPropId = new ObjectId()
    await getDatabase().collection<PropDocument>('prop').insertOne({
      _id: foreignPropId,
      ...updatedInput,
      associationId: foreignAssociationId,
      storageLocationId: storageLocationIds[0],
    })
    const foreignPropResponse = await fetch(
      `${baseUrl}/associations/current/props/${foreignPropId.toHexString()}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer ' + authenticatedAccessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedInput),
      },
    )
    assert.equal(foreignPropResponse.status, 404)

    const invalidInputResponse = await fetch(
      `${baseUrl}/associations/current/props/6b002a5c3c49f74ff7188de8`,
      {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer ' + authenticatedAccessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...updatedInput, quantity: 0 }),
      },
    )
    assert.equal(invalidInputResponse.status, 400)
  })

  test('deletes only owned props for managers and admins and cleans up prop images', async () => {
    const manager = await getDatabase().collection<UserDocument>('users')
      .findOne({ userName: 'integration.manager' })
    const searchUser = await getDatabase().collection<UserDocument>('users')
      .findOne({ userName: 'integration.search' })
    assert.ok(manager)
    assert.ok(searchUser)
    associationManagerAccessToken = await createAccessToken({
      userId: manager._id.toHexString(),
      firstName: manager.firstName,
      lastName: manager.lastName,
      userName: manager.userName,
      role: manager.role,
      associationId: manager.associationId.toHexString(),
    })
    const searchUserToken = await createAccessToken({
      userId: searchUser._id.toHexString(),
      firstName: searchUser.firstName,
      lastName: searchUser.lastName,
      userName: searchUser.userName,
      role: searchUser.role,
      associationId: searchUser.associationId.toHexString(),
    })

    const ownedPropId = new ObjectId()
    await getDatabase().collection<PropDocument>('prop').insertOne({
      _id: ownedPropId,
      name: 'Prop to delete',
      description: '',
      associationId: expectedAssociationId,
      storageLocationId: storageLocationIds[0],
      availability: true,
      dimensions: { height: 1, width: 1, depth: 1, unit: 'cm' },
      quantity: 1,
      colour: '',
      placement: '',
      tags: [],
      condition: '',
      historicalPeriod: '',
    })
    const image = await sharp({
      create: { width: 2, height: 2, channels: 3, background: '#ff0000' },
    }).png().toBuffer()
    const uploadResponse = await fetch(
      `${baseUrl}/associations/current/props/${ownedPropId.toHexString()}/images`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + authenticatedAccessToken,
          'Content-Type': 'image/png',
        },
        body: new Uint8Array(image),
      },
    )
    assert.equal(uploadResponse.status, 201)
    const { imageId } = await uploadResponse.json() as { imageId: string }

    const ownedPropUrl = `${baseUrl}/associations/current/props/${ownedPropId.toHexString()}`
    const managerHeaders = { Authorization: 'Bearer ' + associationManagerAccessToken }
    const managerDelete = await fetch(ownedPropUrl, {
      method: 'DELETE',
      headers: managerHeaders,
    })
    assert.equal(managerDelete.status, 200)
    assert.deepEqual(await managerDelete.json(), { message: 'Rekvisitten er slettet.' })
    assert.equal(
      await getDatabase().collection<PropDocument>('prop').findOne({ _id: ownedPropId }),
      null,
    )
    await assert.rejects(readFile(join(imageDirectory!, `${imageId}.webp`)), { code: 'ENOENT' })

    const unknownDelete = await fetch(
      `${baseUrl}/associations/current/props/${new ObjectId().toHexString()}`,
      { method: 'DELETE', headers: managerHeaders },
    )
    assert.equal(unknownDelete.status, 404)

    const foreignPropId = new ObjectId()
    await getDatabase().collection<PropDocument>('prop').insertOne({
      _id: foreignPropId,
      name: 'Foreign prop',
      description: '',
      associationId: new ObjectId(),
      storageLocationId: storageLocationIds[0],
      availability: true,
      dimensions: { height: 1, width: 1, depth: 1, unit: 'cm' },
      quantity: 1,
      colour: '',
      placement: '',
      tags: [],
      condition: '',
      historicalPeriod: '',
    })
    const foreignDelete = await fetch(
      `${baseUrl}/associations/current/props/${foreignPropId.toHexString()}`,
      { method: 'DELETE', headers: managerHeaders },
    )
    assert.equal(foreignDelete.status, 404)
    assert.ok(await getDatabase().collection<PropDocument>('prop').findOne({ _id: foreignPropId }))

    const searchDelete = await fetch(ownedPropUrl, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + searchUserToken },
    })
    assert.equal(searchDelete.status, 403)

    const adminPropId = new ObjectId()
    await getDatabase().collection<PropDocument>('prop').insertOne({
      _id: adminPropId,
      name: 'Admin prop',
      description: '',
      associationId: expectedAssociationId,
      storageLocationId: storageLocationIds[0],
      availability: true,
      dimensions: { height: 1, width: 1, depth: 1, unit: 'cm' },
      quantity: 1,
      colour: '',
      placement: '',
      tags: [],
      condition: '',
      historicalPeriod: '',
    })
    const adminDelete = await fetch(
      `${baseUrl}/associations/current/props/${adminPropId.toHexString()}`,
      { method: 'DELETE', headers: { Authorization: 'Bearer ' + authenticatedAccessToken } },
    )
    assert.equal(adminDelete.status, 200)
    assert.equal(
      await getDatabase().collection<PropDocument>('prop').findOne({ _id: adminPropId }),
      null,
    )
  })

  test('allows managers to block non-overlapping reservation periods for owned props', async () => {
    const manager = await getDatabase().collection<UserDocument>('users')
      .findOne({ userName: 'integration.manager' })
    assert.ok(manager)
    const managerToken = await createAccessToken({
      userId: manager._id.toHexString(),
      firstName: manager.firstName,
      lastName: manager.lastName,
      userName: manager.userName,
      role: manager.role,
      associationId: manager.associationId.toHexString(),
    })
    const managerHeaders = {
      Authorization: 'Bearer ' + managerToken,
      'Content-Type': 'application/json',
    }
    const searchUser = await getDatabase().collection<UserDocument>('users')
      .findOne({ userName: 'integration.search' })
    assert.ok(searchUser)
    const searchToken = await createAccessToken({
      userId: searchUser._id.toHexString(),
      firstName: searchUser.firstName,
      lastName: searchUser.lastName,
      userName: searchUser.userName,
      role: searchUser.role,
      associationId: searchUser.associationId.toHexString(),
    })
    const propId = new ObjectId()
    await getDatabase().collection<PropDocument>('prop').insertOne({
      _id: propId,
      name: 'Reservable prop',
      description: '',
      associationId: expectedAssociationId,
      storageLocationId: storageLocationIds[0],
      availability: true,
      dimensions: { height: 1, width: 1, depth: 1, unit: 'cm' },
      quantity: 1,
      colour: '',
      placement: '',
      tags: [],
      condition: '',
      historicalPeriod: '',
    })
    const url = `${baseUrl}/associations/current/props/${propId.toHexString()}/reservations`
    const reserve = (startDate: string, endDate: string) => fetch(url, {
      method: 'POST',
      headers: managerHeaders,
      body: JSON.stringify({ startDate, endDate }),
    })

    assert.equal((await reserve('2026-02-31', '2026-03-01')).status, 400)
    assert.equal((await reserve('2026-12-04', '2026-12-03')).status, 400)
    assert.equal((await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + searchToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ startDate: '2026-12-01', endDate: '2026-12-03' }),
    })).status, 403)

    const firstReservationResponse = await reserve('2026-12-01', '2026-12-03')
    assert.equal(firstReservationResponse.status, 201)
    const firstReservationBody = await firstReservationResponse.json() as {
      reservation: {
        id: string
        propId: string
        startDate: string
        endDate: string
        createdAt: string
      }
    }
    assert.deepEqual(firstReservationBody.reservation, {
      id: firstReservationBody.reservation.id,
      propId: propId.toHexString(),
      startDate: '2026-12-01',
      endDate: '2026-12-03',
      createdAt: firstReservationBody.reservation.createdAt,
    })

    assert.equal((await reserve('2026-12-03', '2026-12-04')).status, 409)
    assert.equal((await reserve('2026-12-04', '2026-12-05')).status, 201)

    const unavailablePropId = new ObjectId()
    await getDatabase().collection<PropDocument>('prop').insertOne({
      _id: unavailablePropId,
      name: 'Unavailable prop',
      description: '',
      associationId: expectedAssociationId,
      storageLocationId: storageLocationIds[0],
      availability: false,
      dimensions: { height: 1, width: 1, depth: 1, unit: 'cm' },
      quantity: 1,
      colour: '',
      placement: '',
      tags: [],
      condition: '',
      historicalPeriod: '',
    })
    const unavailableResponse = await fetch(
      `${baseUrl}/associations/current/props/${unavailablePropId.toHexString()}/reservations`,
      {
        method: 'POST',
        headers: managerHeaders,
        body: JSON.stringify({ startDate: '2026-12-01', endDate: '2026-12-03' }),
      },
    )
    assert.equal(unavailableResponse.status, 409)

    const foreignPropId = new ObjectId()
    await getDatabase().collection<PropDocument>('prop').insertOne({
      _id: foreignPropId,
      name: 'Foreign prop',
      description: '',
      associationId: new ObjectId(),
      storageLocationId: storageLocationIds[0],
      availability: true,
      dimensions: { height: 1, width: 1, depth: 1, unit: 'cm' },
      quantity: 1,
      colour: '',
      placement: '',
      tags: [],
      condition: '',
      historicalPeriod: '',
    })
    assert.equal((await fetch(
      `${baseUrl}/associations/current/props/${foreignPropId.toHexString()}/reservations`,
      { headers: { Authorization: 'Bearer ' + managerToken } },
    )).status, 404)
    const foreignReservation = await fetch(
      `${baseUrl}/associations/current/props/${foreignPropId.toHexString()}/reservations`,
      {
        method: 'POST',
        headers: managerHeaders,
        body: JSON.stringify({ startDate: '2026-12-01', endDate: '2026-12-03' }),
      },
    )
    assert.equal(foreignReservation.status, 404)

    const listResponse = await fetch(url, {
      headers: { Authorization: 'Bearer ' + managerToken },
    })
    assert.equal(listResponse.status, 200)
    const reservationList = await listResponse.json() as {
      reservations: Array<{ id: string; startDate: string; endDate: string }>
    }
    assert.deepEqual(reservationList.reservations.map(({ startDate, endDate }) => ({
      startDate,
      endDate,
    })), [
      { startDate: '2026-12-01', endDate: '2026-12-03' },
      { startDate: '2026-12-04', endDate: '2026-12-05' },
    ])

    const concurrentResponses = await Promise.all([
      reserve('2027-01-01', '2027-01-03'),
      reserve('2027-01-02', '2027-01-04'),
    ])
    assert.deepEqual(
      concurrentResponses.map((response) => response.status).sort(),
      [201, 409],
    )
    assert.equal(
      await getDatabase().collection<ReservationDocument>('reservation').countDocuments({
        propId,
        startDate: { $lt: new Date('2027-01-05T00:00:00.000Z') },
        endDate: { $gt: new Date('2026-12-31T00:00:00.000Z') },
      }),
      1,
    )

    const removeResponse = await fetch(`${url}/${firstReservationBody.reservation.id}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + managerToken },
    })
    assert.equal(removeResponse.status, 200)
    assert.equal((await reserve('2026-12-01', '2026-12-03')).status, 201)

    const propToDelete = await getDatabase().collection<PropDocument>('prop')
      .findOne({ _id: propId })
    assert.ok(propToDelete)
    const reservationCollection = getDatabase().collection<ReservationDocument>('reservation')
    const existingReservation = await reservationCollection.findOne({ propId })
    assert.ok(existingReservation)
    const propDelete = await fetch(
      `${baseUrl}/associations/current/props/${propId.toHexString()}`,
      { method: 'DELETE', headers: { Authorization: 'Bearer ' + managerToken } },
    )
    assert.equal(propDelete.status, 200)
    assert.equal(await reservationCollection.countDocuments({ propId }), 0)
  })

  test('lists loans only for the owner and borrower from their respective perspectives', async () => {
    const ownerId = new ObjectId()
    const borrowerId = new ObjectId()
    const outsiderId = new ObjectId()
    const propId = new ObjectId()
    const loanId = new ObjectId()
    const now = new Date()
    const associations = getDatabase().collection<AssociationDocument>('associations')
    const props = getDatabase().collection<PropDocument>('prop')
    const loans = getDatabase().collection<LoanDocument>('loan')
    await associations.insertMany([
      { _id: ownerId, name: 'Owner theatre', createdAt: now, updatedAt: now },
      { _id: borrowerId, name: 'Borrower theatre', createdAt: now, updatedAt: now },
      { _id: outsiderId, name: 'Other theatre', createdAt: now, updatedAt: now },
    ])
    await props.insertOne({
      _id: propId, associationId: ownerId, storageLocationId: storageLocationIds[0],
      name: 'Lånestol', description: '', availability: true,
      dimensions: { height: 1, width: 1, depth: 1, unit: 'cm' },
      quantity: 1, colour: '', placement: '', tags: [], condition: '', historicalPeriod: '',
    })
    await loans.insertOne({
      _id: loanId, propId, ownerAssociationId: ownerId, borrowerAssociationId: borrowerId,
      startDate: new Date('2026-12-01T00:00:00Z'),
      endDate: new Date('2026-12-10T00:00:00Z'),
      status: 'Afventer svar', borrowerMessage: 'Private message',
    })
    const makeToken = (associationId: ObjectId, role: typeof ROLES.ASSOCIATION_ADMIN | typeof ROLES.PROP_MANAGER | typeof ROLES.SEARCH_USER) => createAccessToken({
      userId: expectedUserId, firstName: 'Test', lastName: 'User', userName: 'test.user',
      role, associationId: associationId.toHexString(),
    })
    const fetchLoans = (token: string) => fetch(`${baseUrl}/associations/current/loans`, {
      headers: { Authorization: 'Bearer ' + token },
    })
    const ownerResponse = await fetchLoans(await makeToken(ownerId, ROLES.ASSOCIATION_ADMIN))
    assert.equal(ownerResponse.status, 200)
    assert.deepEqual(await ownerResponse.json(), { loans: [{
      id: loanId.toHexString(), type: 'lending', propName: 'Lånestol',
      associationName: 'Borrower theatre', startDate: '2026-12-01', endDate: '2026-12-10',
      status: 'Afventer svar',
    }] })
    const borrowerResponse = await fetchLoans(await makeToken(borrowerId, ROLES.ASSOCIATION_ADMIN))
    assert.equal(borrowerResponse.status, 200)
    assert.deepEqual(await borrowerResponse.json(), { loans: [{
      id: loanId.toHexString(), type: 'loan', propName: 'Lånestol',
      associationName: 'Owner theatre', startDate: '2026-12-01', endDate: '2026-12-10',
      status: 'Afventer svar',
    }] })
    assert.deepEqual(await (await fetchLoans(await makeToken(outsiderId, ROLES.ASSOCIATION_ADMIN))).json(), { loans: [] })
    assert.equal((await fetch(`${baseUrl}/associations/current/loans`)).status, 401)
    assert.equal((await fetchLoans(await makeToken(ownerId, ROLES.PROP_MANAGER))).status, 403)
    assert.equal((await fetchLoans(await makeToken(ownerId, ROLES.SEARCH_USER))).status, 403)
    const ownerToken = await makeToken(ownerId, ROLES.ASSOCIATION_ADMIN)
    const fetchDetail = (token: string, id = loanId.toHexString()) => fetch(
      `${baseUrl}/associations/current/loans/${id}`,
      { headers: { Authorization: 'Bearer ' + token } },
    )
    const ownerDetail = await fetchDetail(ownerToken)
    assert.equal(ownerDetail.status, 200)
    assert.deepEqual(await ownerDetail.json(), { loan: {
      id: loanId.toHexString(), type: 'lending', propName: 'Lånestol',
      associationName: 'Borrower theatre', startDate: '2026-12-01', endDate: '2026-12-10',
      status: 'Afventer svar', borrowerMessage: 'Private message',
    } })
    const borrowerDetail = await fetchDetail(await makeToken(borrowerId, ROLES.ASSOCIATION_ADMIN))
    assert.equal(borrowerDetail.status, 200)
    assert.deepEqual(await borrowerDetail.json(), { loan: {
      id: loanId.toHexString(), type: 'loan', propName: 'Lånestol',
      associationName: 'Owner theatre', startDate: '2026-12-01', endDate: '2026-12-10',
      status: 'Afventer svar', borrowerMessage: 'Private message',
    } })
    assert.equal((await fetchDetail(await makeToken(outsiderId, ROLES.ASSOCIATION_ADMIN))).status, 404)
    assert.equal((await fetchDetail(ownerToken, new ObjectId().toHexString())).status, 404)
    assert.equal((await fetchDetail(ownerToken, 'invalid')).status, 404)
    assert.equal((await fetch(`${baseUrl}/associations/current/loans/${loanId.toHexString()}`)).status, 401)
    assert.equal((await fetchDetail(await makeToken(ownerId, ROLES.PROP_MANAGER))).status, 403)
    await loans.updateOne({ _id: loanId }, { $unset: { borrowerMessage: '' } })
    const noMessage = await (await fetchDetail(ownerToken)).json() as { loan: { borrowerMessage: string | null } }
    assert.equal(noMessage.loan.borrowerMessage, null)
    await getDatabase().collection('loan').updateOne({ _id: loanId }, { $set: { borrowerMessage: 123 } })
    assert.equal((await fetchDetail(ownerToken)).status, 500)
    await loans.updateOne({ _id: loanId }, { $set: { borrowerMessage: 'Private message' } })
    for (const status of LOAN_STATUSES) {
      await loans.updateOne({ _id: loanId }, { $set: { status } })
      const response = await fetchLoans(ownerToken)
      assert.equal(response.status, 200)
      const body = await response.json() as { loans: { status: string }[] }
      assert.equal(body.loans[0]?.status, status)
    }
    const rawLoans = getDatabase().collection('loan')
    await rawLoans.updateOne({ _id: loanId }, { $set: { status: 'Udlånt' } })
    assert.equal((await fetchLoans(ownerToken)).status, 500)
    await rawLoans.updateOne({ _id: loanId }, { $set: { status: 'Godkendt', endDate: 'invalid' } })
    assert.equal((await fetchLoans(ownerToken)).status, 500)
    await rawLoans.updateOne({ _id: loanId }, { $set: { endDate: new Date('2026-12-10T00:00:00Z'), borrowerAssociationId: new ObjectId() } })
    assert.equal((await fetchLoans(ownerToken)).status, 500)
    await rawLoans.updateOne({ _id: loanId }, { $set: { borrowerAssociationId: borrowerId } })
    await props.deleteOne({ _id: propId })
    assert.equal((await fetchLoans(ownerToken)).status, 500)
    assert.equal((await fetchDetail(ownerToken)).status, 500)
    await loans.deleteOne({ _id: loanId })
    await associations.deleteMany({ _id: { $in: [ownerId, borrowerId, outsiderId] } })
  })

  test('decides pending loans safely across associations, reservations and concurrent requests', async () => {
    const ownerId = new ObjectId()
    const borrowerId = new ObjectId()
    const outsiderId = new ObjectId()
    const propId = new ObjectId()
    const loans = getDatabase().collection<LoanDocument>('loan')
    const props = getDatabase().collection<PropDocument>('prop')
    const reservations = getDatabase().collection<ReservationDocument>('reservation')
    const associations = getDatabase().collection<AssociationDocument>('associations')
    const now = new Date()
    await associations.insertMany([
      { _id: ownerId, name: 'Owner', createdAt: now, updatedAt: now },
      { _id: borrowerId, name: 'Borrower', createdAt: now, updatedAt: now },
      { _id: outsiderId, name: 'Other', createdAt: now, updatedAt: now },
    ])
    await props.insertOne({
      _id: propId, associationId: ownerId, storageLocationId: storageLocationIds[0],
      name: 'Test prop', description: '', availability: true,
      dimensions: { height: 1, width: 1, depth: 1, unit: 'cm' },
      quantity: 1, colour: '', placement: '', tags: [], condition: '', historicalPeriod: '',
    })
    const token = (id: ObjectId, role: typeof ROLES.ASSOCIATION_ADMIN | typeof ROLES.PROP_MANAGER = ROLES.ASSOCIATION_ADMIN) => createAccessToken({
      userId: expectedUserId, firstName: 'Test', lastName: 'User', userName: 'test',
      role, associationId: id.toHexString(),
    })
    const ownerToken = await token(ownerId)
    const borrowerToken = await token(borrowerId)
    const outsiderToken = await token(outsiderId)
    const managerToken = await token(ownerId, ROLES.PROP_MANAGER)
    const makeLoan = async (start: string, end: string) => {
      const id = new ObjectId()
      await loans.insertOne({
        _id: id, propId, ownerAssociationId: ownerId, borrowerAssociationId: borrowerId,
        startDate: new Date(`${start}T00:00:00Z`), endDate: new Date(`${end}T00:00:00Z`),
        status: 'Afventer svar',
      })
      return id
    }
    const decide = (id: ObjectId, status: string, accessToken = ownerToken) => fetch(
      `${baseUrl}/associations/current/loans/${id.toHexString()}`,
      { method: 'PATCH', headers: { Authorization: 'Bearer ' + accessToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) },
    )
    const reserve = (startDate: string, endDate: string) => fetch(
      `${baseUrl}/associations/current/props/${propId.toHexString()}/reservations`,
      { method: 'POST', headers: { Authorization: 'Bearer ' + managerToken, 'Content-Type': 'application/json' }, body: JSON.stringify({ startDate, endDate }) },
    )
    const first = await makeLoan('2026-12-01', '2026-12-03')
    assert.equal((await decide(first, 'Godkendt', borrowerToken)).status, 404)
    assert.equal((await decide(first, 'Godkendt', outsiderToken)).status, 404)
    assert.equal((await decide(first, 'Godkendt', managerToken)).status, 403)
    assert.equal((await fetch(`${baseUrl}/associations/current/loans/${first}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{"status":"Godkendt"}' })).status, 401)
    assert.equal((await decide(first, 'Afleveret')).status, 400)
    assert.equal((await decide(first, 'Godkendt')).status, 200)
    assert.equal((await decide(first, 'Afvist')).status, 409)
    const detail = await fetch(`${baseUrl}/associations/current/loans/${first}`, { headers: { Authorization: 'Bearer ' + borrowerToken } })
    assert.equal((await detail.json() as { loan: { status: string } }).loan.status, 'Godkendt')
    assert.equal((await reserve('2026-12-03', '2026-12-04')).status, 409)
    const overlapping = await makeLoan('2026-12-03', '2026-12-04')
    assert.equal((await decide(overlapping, 'Godkendt')).status, 409)
    assert.equal((await decide(overlapping, 'Afvist')).status, 200)
    assert.equal((await loans.findOne({ _id: overlapping }))?.status, 'Afvist')
    assert.equal((await reserve('2026-12-04', '2026-12-05')).status, 201)
    const reserved = await makeLoan('2026-12-05', '2026-12-06')
    assert.equal((await decide(reserved, 'Godkendt')).status, 409)
    assert.equal((await loans.findOne({ _id: reserved }))?.status, 'Afventer svar')
    const adjacent = await makeLoan('2026-12-06', '2026-12-07')
    assert.equal((await decide(adjacent, 'Godkendt')).status, 200)

    const raceA = await makeLoan('2027-01-01', '2027-01-05')
    const raceB = await makeLoan('2027-01-05', '2027-01-06')
    const simultaneousLoans = await Promise.all([decide(raceA, 'Godkendt'), decide(raceB, 'Godkendt')])
    assert.deepEqual(simultaneousLoans.map((response) => response.status).sort(), [200, 409])
    const raceReservation = await makeLoan('2027-02-01', '2027-02-03')
    const simultaneousReservation = await Promise.all([
      decide(raceReservation, 'Godkendt'),
      reserve('2027-02-03', '2027-02-04'),
    ])
    assert.deepEqual(simultaneousReservation.map((response) => response.status).sort(), [
      simultaneousReservation[0]?.status === 200 ? 200 : 201, 409,
    ])
    const raceDecision = await makeLoan('2027-03-01', '2027-03-02')
    const simultaneousDecisions = await Promise.all([decide(raceDecision, 'Godkendt'), decide(raceDecision, 'Afvist')])
    assert.deepEqual(simultaneousDecisions.map((response) => response.status).sort(), [200, 409])
    await loans.deleteMany({ propId })
    await reservations.deleteMany({ propId })
    await props.deleteOne({ _id: propId })
    await associations.deleteMany({ _id: { $in: [ownerId, borrowerId, outsiderId] } })
  })

  test('invites association users and activates their account with a one-time token', async () => {
    let invitationUrl = ''
    const user = await inviteAssociationUser(
      expectedAssociationId.toHexString(),
      {
        firstName: 'New',
        lastName: 'Prop Manager',
        userName: `new.manager.${Date.now()}`,
        email: `new.manager.${Date.now()}@example.dk`,
        role: ROLES.PROP_MANAGER,
      },
      async (_email, url) => {
        invitationUrl = url
      },
    )
    assert.equal(user.status, 'pending')
    assert.equal(user.role, ROLES.PROP_MANAGER)
    const originalToken = new URL(invitationUrl).searchParams.get('token')
    assert.ok(originalToken)
    let resentInvitationUrl = ''
    await resendAssociationUserInvitation(
      expectedAssociationId.toHexString(),
      user.id,
      async (_email, url) => {
        resentInvitationUrl = url
      },
    )
    const token = new URL(resentInvitationUrl).searchParams.get('token')
    assert.ok(token)
    assert.notEqual(token, originalToken)
    await assert.rejects(
      acceptAssociationUserInvitation(originalToken, 'new-account-password-123'),
      InvalidInvitationError,
    )

    const storedUser = await getDatabase().collection<UserDocument>('users')
      .findOne({ _id: new ObjectId(user.id) })
    assert.ok(storedUser)
    assert.equal(storedUser.emailVerifiedAt, undefined)
    assert.notEqual(storedUser.invitationTokenHash, token)
    assert.notEqual(storedUser.passwordHash, token)

    await acceptAssociationUserInvitation(token, 'new-account-password-123')
    const activeUser = await getDatabase().collection<UserDocument>('users')
      .findOne({ _id: new ObjectId(user.id) })
    assert.ok(activeUser?.emailVerifiedAt)
    assert.equal(activeUser?.invitationTokenHash, undefined)
    assert.equal(await verifyPassword('new-account-password-123', activeUser.passwordHash), true)
    await assert.rejects(
      acceptAssociationUserInvitation(token, 'another-account-password-456'),
      InvalidInvitationError,
    )
  })

  test('removes a pending association user when invitation email delivery fails', async () => {
    const email = `failed.invite.${Date.now()}@example.dk`
    await assert.rejects(
      inviteAssociationUser(
        expectedAssociationId.toHexString(),
        {
          firstName: 'Failed',
          lastName: 'Invitation',
          userName: `failed.invite.${Date.now()}`,
          email,
          role: ROLES.SEARCH_USER,
        },
        async () => {
          throw new Error('test delivery failure')
        },
      ),
      AssociationUserInvitationDeliveryError,
    )
    assert.equal(await getDatabase().collection<UserDocument>('users').findOne({ email }), null)
  })

  test('limits association user management to association admins and current association users', async () => {
    const manager = await getDatabase().collection<UserDocument>('users')
      .findOne({ userName: 'integration.manager' })
    assert.ok(manager)
    const managerToken = await createAccessToken({
      userId: manager._id.toHexString(),
      firstName: manager.firstName,
      lastName: manager.lastName,
      userName: manager.userName,
      role: manager.role,
      associationId: manager.associationId.toHexString(),
    })
    const endpoint = `${baseUrl}/associations/current/users`
    const adminHeaders = {
      Authorization: 'Bearer ' + authenticatedAccessToken,
      'Content-Type': 'application/json',
    }

    const listResponse = await fetch(endpoint, {
      headers: { Authorization: 'Bearer ' + authenticatedAccessToken },
    })
    assert.equal(listResponse.status, 200)
    const body = await listResponse.json() as {
      users: Array<Record<string, unknown> & { userName: string }>
    }
    assert.ok(body.users.some(({ userName }) => userName.startsWith('new.manager.')))
    assert.ok(body.users.every((user) => !('passwordHash' in user)
      && !('invitationTokenHash' in user)))

    assert.equal((await fetch(endpoint, {
      headers: { Authorization: 'Bearer ' + managerToken },
    })).status, 403)
    assert.equal((await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + managerToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firstName: 'Not',
        lastName: 'Authorized',
        userName: 'not.authorized',
        email: 'not.authorized@example.dk',
        role: ROLES.PROP_MANAGER,
      }),
    })).status, 403)

    const invalidInputResponse = await fetch(endpoint, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ firstName: 'Missing required fields' }),
    })
    assert.equal(invalidInputResponse.status, 400)
  })

  test('returns a generic response for an unknown reset email', async () => {
    const response = await fetch(`${baseUrl}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'unknown@example.dk' }),
    })

    assert.equal(response.status, 202)
    assert.deepEqual(await response.json(), {
      message: 'Hvis e-mailadressen findes, sender vi et link til nulstilling.',
    })
  })

  test('requires authentication and limits association updates to association admins', async () => {
    const unauthenticatedResponse = await fetch(`${baseUrl}/auth/me`)
    assert.equal(unauthenticatedResponse.status, 401)

    const unauthenticatedLocationResponse = await fetch(
      `${baseUrl}/associations/current/storage-locations`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: 'Havnevej 9',
          postalCode: '8000',
          city: 'Aarhus',
        }),
      },
    )
    assert.equal(unauthenticatedLocationResponse.status, 401)

    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: 'integration.test', password: testPassword }),
    })
    assert.equal(loginResponse.status, 200)
    const loginBody = await loginResponse.json() as { accessToken: string; user: unknown }

    const authenticatedResponse = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${loginBody.accessToken}` },
    })

    {
      const getResponse = await fetch(`${baseUrl}/associations/current`, {
        headers: { Authorization: 'Bearer ' + authenticatedAccessToken },
      })
      assert.equal(getResponse.status, 200)
      assert.deepEqual(await getResponse.json(), {
        association: {
          name: testAssociationName,
          contactPerson: {
            name: 'Association Contact',
            email: 'contact@example.dk',
            phone: '+45 12345678',
          },
          storageLocations: [
            {
              id: storageLocationIds[0]?.toHexString(),
              address: 'Industrivej 7',
              postalCode: '6740',
              city: 'Bramming',
            },
            {
              id: storageLocationIds[1]?.toHexString(),
              address: 'Teatergade 2',
              postalCode: '6700',
              city: 'Esbjerg',
            },
          ],
        },
      })

      const invalidUpdateResponse = await fetch(`${baseUrl}/associations/current`, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer ' + authenticatedAccessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: testAssociationName,
          contactPerson: {
            name: 'Association Contact',
            email: 'not-an-email',
            phone: '+45 12345678',
          },
        }),
      })
      assert.equal(invalidUpdateResponse.status, 400)

      const invalidLocationResponse = await fetch(
        `${baseUrl}/associations/current/storage-locations`,
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + authenticatedAccessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            address: ' ',
            postalCode: '8000',
            city: 'Aarhus',
          }),
        },
      )
      assert.equal(invalidLocationResponse.status, 400)

      const updateInput = {
        name: testAssociationName,
        contactPerson: {
          name: 'Updated Association Contact',
          email: 'updated.contact@example.dk',
          phone: '+45 60409598',
        },
      }
      const updateResponse = await fetch(`${baseUrl}/associations/current`, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer ' + authenticatedAccessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateInput),
      })
      assert.equal(updateResponse.status, 200)
      assert.deepEqual(await updateResponse.json(), {
        message: 'Foreningens oplysninger er opdateret.',
        association: {
          ...updateInput,
          storageLocations: [
            {
              id: storageLocationIds[0]?.toHexString(),
              address: 'Industrivej 7',
              postalCode: '6740',
              city: 'Bramming',
            },
            {
              id: storageLocationIds[1]?.toHexString(),
              address: 'Teatergade 2',
              postalCode: '6700',
              city: 'Esbjerg',
            },
          ],
        },
      })

      const newLocationInput = {
        address: 'Havnevej 9',
        postalCode: '8000',
        city: 'Aarhus',
      }
      const createLocationResponse = await fetch(
        `${baseUrl}/associations/current/storage-locations`,
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + authenticatedAccessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newLocationInput),
        },
      )
      assert.equal(createLocationResponse.status, 201)
      const createLocationBody = await createLocationResponse.json() as {
        message: string
        association: { storageLocations: Array<{ id: string; address: string; postalCode: string; city: string }> }
      }
      assert.equal(createLocationBody.message, 'Lageradressen er tilføjet.')
      assert.equal(createLocationBody.association.storageLocations.length, 3)
      assert.deepEqual(createLocationBody.association.storageLocations[2], {
        id: createLocationBody.association.storageLocations[2]?.id,
        ...newLocationInput,
      })
      assert.match(createLocationBody.association.storageLocations[2]?.id ?? '', /^[a-f\d]{24}$/i)
      const newLocationId = createLocationBody.association.storageLocations[2]?.id
      assert.ok(newLocationId)

      const otherAssociationId = new ObjectId()
      await getDatabase().collection<AssociationDocument>('associations').insertOne({
        _id: otherAssociationId,
        name: 'Another Theatre',
        storageLocationIds: [new ObjectId(newLocationId)],
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const editedLocationInput = {
        address: 'Havnevej 11',
        postalCode: '8000',
        city: 'Aarhus C',
      }
      const editLocationResponse = await fetch(
        `${baseUrl}/associations/current/storage-locations/${newLocationId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer ' + authenticatedAccessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(editedLocationInput),
        },
      )
      assert.equal(editLocationResponse.status, 200)
      const editLocationBody = await editLocationResponse.json() as {
        association: { storageLocations: Array<{ id: string; address: string; postalCode: string; city: string }> }
      }
      const editedLocationId = editLocationBody.association.storageLocations[2]?.id
      assert.ok(editedLocationId)
      assert.notEqual(editedLocationId, newLocationId)
      assert.deepEqual(editLocationBody.association.storageLocations[2], {
        id: editedLocationId,
        ...editedLocationInput,
      })
      assert.deepEqual(
        await getDatabase().collection<StorageLocationDocument>('storagelocation')
          .findOne({ _id: new ObjectId(newLocationId) }),
        { _id: new ObjectId(newLocationId), ...newLocationInput },
      )
      const otherAssociationBeforeDelete = await getDatabase()
        .collection<AssociationDocument>('associations')
        .findOne({ _id: otherAssociationId })
      assert.deepEqual(otherAssociationBeforeDelete?.storageLocationIds, [new ObjectId(newLocationId)])

      const unassociatedLocationEditResponse = await fetch(
        `${baseUrl}/associations/current/storage-locations/${newLocationId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer ' + authenticatedAccessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(editedLocationInput),
        },
      )
      assert.equal(unassociatedLocationEditResponse.status, 404)

      const invalidLocationEditResponse = await fetch(
        `${baseUrl}/associations/current/storage-locations/${newLocationId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer ' + authenticatedAccessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            address: '',
            postalCode: '8000',
            city: 'Aarhus C',
          }),
        },
      )
      assert.equal(invalidLocationEditResponse.status, 400)

      const managerLoginResponse = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userName: 'integration.manager', password: testPassword }),
      })
      assert.equal(managerLoginResponse.status, 200)
      const managerLoginBody = await managerLoginResponse.json() as { accessToken: string }
      associationManagerAccessToken = managerLoginBody.accessToken
      const managerPropInput = {
        name: 'Manager-created prop',
        description: 'Created by the prop manager.',
        storageLocationId: storageLocationIds[0].toHexString(),
        availability: true,
        dimensions: { height: 10, width: 20, depth: 30, unit: 'cm' },
        quantity: 1,
        colour: 'Blå',
        placement: 'Reol 1',
        tags: ['manager'],
        condition: 'God',
        historicalPeriod: '',
      }
      const managerPropCreate = await fetch(`${baseUrl}/associations/current/props`, {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + associationManagerAccessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(managerPropInput),
      })
      assert.equal(managerPropCreate.status, 201)
      const managerPropBody = await managerPropCreate.json() as { prop: { id: string } }
      const managerPropUrl = `${baseUrl}/associations/current/props/${managerPropBody.prop.id}`
      const managerImage = await sharp({
        create: { width: 2, height: 2, channels: 3, background: '#ff0000' },
      }).png().toBuffer()
      const managerImageUpload = await fetch(
        `${managerPropUrl}/images`,
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + associationManagerAccessToken,
            'Content-Type': 'image/png',
          },
          body: new Uint8Array(managerImage),
        },
      )
      assert.equal(managerImageUpload.status, 201)
      const managerImageBody = await managerImageUpload.json() as { imageId: string }

      const managerImageDelete = await fetch(
        `${managerPropUrl}/images/${managerImageBody.imageId}`,
        {
          method: 'DELETE',
          headers: { Authorization: 'Bearer ' + associationManagerAccessToken },
        },
      )
      assert.equal(managerImageDelete.status, 200)

      const forbiddenUpdateResponse = await fetch(`${baseUrl}/associations/current`, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer ' + associationManagerAccessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateInput),
      })
      assert.equal(forbiddenUpdateResponse.status, 403)

      const managerPropEditResponse = await fetch(
        managerPropUrl,
        {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer ' + associationManagerAccessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ ...managerPropInput, name: 'Manager-updated prop' }),
        },
      )
      assert.equal(managerPropEditResponse.status, 200)
      const managerPropEditBody = await managerPropEditResponse.json() as { prop: { name: string } }
      assert.equal(managerPropEditBody.prop.name, 'Manager-updated prop')

      const forbiddenLocationResponse = await fetch(
        `${baseUrl}/associations/current/storage-locations`,
        {
          method: 'POST',
          headers: {
            Authorization: 'Bearer ' + associationManagerAccessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newLocationInput),
        },
      )
      assert.equal(forbiddenLocationResponse.status, 403)

      const forbiddenLocationEditResponse = await fetch(
        `${baseUrl}/associations/current/storage-locations/${editedLocationId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer ' + associationManagerAccessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(editedLocationInput),
        },
      )
      assert.equal(forbiddenLocationEditResponse.status, 403)

      const forbiddenLocationDeleteResponse = await fetch(
        `${baseUrl}/associations/current/storage-locations/${editedLocationId}`,
        {
          method: 'DELETE',
          headers: { Authorization: 'Bearer ' + associationManagerAccessToken },
        },
      )
      assert.equal(forbiddenLocationDeleteResponse.status, 403)

      const deleteLocationResponse = await fetch(
        `${baseUrl}/associations/current/storage-locations/${editedLocationId}`,
        {
          method: 'DELETE',
          headers: { Authorization: 'Bearer ' + authenticatedAccessToken },
        },
      )
      assert.equal(deleteLocationResponse.status, 200)
      const deleteLocationBody = await deleteLocationResponse.json() as {
        message: string
        association: { storageLocations: Array<{ id: string }> }
      }
      assert.equal(deleteLocationBody.message, 'Lageradressen er fjernet.')
      assert.equal(deleteLocationBody.association.storageLocations.length, 2)
      assert.ok(!deleteLocationBody.association.storageLocations.some(
        (location) => location.id === editedLocationId,
      ))
      assert.equal(
        await getDatabase().collection<StorageLocationDocument>('storagelocation')
          .findOne({ _id: new ObjectId(editedLocationId) }),
        null,
      )
      assert.ok(await getDatabase().collection<StorageLocationDocument>('storagelocation')
        .findOne({ _id: new ObjectId(newLocationId) }))
      const otherAssociation = await getDatabase().collection<AssociationDocument>('associations')
        .findOne({ _id: otherAssociationId })
      assert.deepEqual(otherAssociation?.storageLocationIds, [new ObjectId(newLocationId)])

      const missingLocationResponse = await fetch(
        `${baseUrl}/associations/current/storage-locations/${new ObjectId().toHexString()}`,
        {
          method: 'DELETE',
          headers: { Authorization: 'Bearer ' + authenticatedAccessToken },
        },
      )
      assert.equal(missingLocationResponse.status, 404)

      const persistedAssociation = await getDatabase()
        .collection<AssociationDocument>('associations')
        .findOne({ _id: expectedAssociationId })
      assert.deepEqual(persistedAssociation?.contactPerson, updateInput.contactPerson)
      assert.equal(persistedAssociation?.storageLocationIds?.length, 2)
    }

    assert.equal(authenticatedResponse.status, 200)
    assert.deepEqual(await authenticatedResponse.json(), {
      user: {
        ...loginBody.user as object,
        email: testEmail,
        emailVerified: true,
        associationName: testAssociationName,
      },
    })
  })

  test('updates the authenticated user email and rejects invalid addresses', async () => {
    const invalidResponse = await fetch(`${baseUrl}/auth/profile`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${authenticatedAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'not-an-email' }),
    })
    assert.equal(invalidResponse.status, 400)

    const duplicateResponse = await fetch(`${baseUrl}/auth/profile`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${authenticatedAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: 'RESERVED@example.dk' }),
    })
    assert.equal(duplicateResponse.status, 409)
    assert.deepEqual(await duplicateResponse.json(), {
      error: 'E-mailadressen er allerede knyttet til en anden bruger.',
    })

    const updateResponse = await fetch(`${baseUrl}/auth/profile`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${authenticatedAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: '  NEW.EMAIL@EXAMPLE.DK  ' }),
    })
    assert.equal(updateResponse.status, 200)
    assert.deepEqual(await updateResponse.json(), {
      message: 'E-mailadressen er opdateret.',
      emailVerified: false,
    })

    const profileResponse = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${authenticatedAccessToken}` },
    })
    const profileBody = await profileResponse.json() as {
      user: { email: string; emailVerified: boolean }
    }
    assert.equal(profileBody.user.email, 'new.email@example.dk')
    assert.equal(profileBody.user.emailVerified, false)
    const reservedUser = await getDatabase().collection<UserDocument>('users')
      .findOne({ _id: reservedEmailUserId })
    assert.equal(reservedUser?.email, 'reserved@example.dk')
  })

  test('verifies a changed email and rejects replayed verification tokens', async () => {
    let verificationUrl = ''
    await requestEmailVerification(expectedUserId, async (_recipient, url) => {
      verificationUrl = url
    })
    const token = new URL(verificationUrl).searchParams.get('token')
    assert.ok(token)

    const confirmationResponse = await fetch(`${baseUrl}/auth/confirm-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    assert.equal(confirmationResponse.status, 200)

    const replayResponse = await fetch(`${baseUrl}/auth/confirm-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    assert.equal(replayResponse.status, 400)

    const user = await getDatabase().collection<UserDocument>('users')
      .findOne({ _id: new ObjectId(expectedUserId) })
    assert.ok(user?.emailVerifiedAt)
    assert.equal(user?.emailVerificationTokenHash, undefined)
  })

  test('does not send password-reset mail to an unverified email', async () => {
    let sentMail = false
    await getDatabase().collection<UserDocument>('users').updateOne(
      { _id: reservedEmailUserId },
      { $unset: { emailVerifiedAt: '' } },
    )
    await requestPasswordReset('reserved@example.dk', async () => {
      sentMail = true
    })
    assert.equal(sentMail, false)
    await getDatabase().collection<UserDocument>('users').updateOne(
      { _id: reservedEmailUserId },
      { $set: { emailVerifiedAt: new Date() } },
    )
  })

  test('requires authentication to change a password', async () => {
    const response = await fetch(`${baseUrl}/auth/password`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: testPassword,
        newPassword: 'new-integration-passphrase',
      }),
    })

    assert.equal(response.status, 401)
  })

  test('rejects invalid password-change input', async () => {
    const response = await fetch(`${baseUrl}/auth/password`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${authenticatedAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword: testPassword,
        newPassword: 'too-short',
      }),
    })

    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), {
      error: 'Den nye adgangskode skal være mindst 12 og højst 72 bytes',
    })
  })

  test('rejects an incorrect current password', async () => {
    const response = await fetch(`${baseUrl}/auth/password`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${authenticatedAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword: 'incorrect-current-password',
        newPassword: 'new-integration-passphrase',
      }),
    })

    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), {
      error: 'Den nuværende adgangskode er forkert.',
    })
  })

  test('changes the password and allows login only with the new password', async () => {
    const changeResponse = await fetch(`${baseUrl}/auth/password`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${authenticatedAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        currentPassword: testPassword,
        newPassword: 'new-integration-passphrase',
      }),
    })

    assert.equal(changeResponse.status, 200)
    assert.deepEqual(await changeResponse.json(), {
      message: 'Adgangskoden er opdateret.',
    })

    const oldPasswordResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: 'integration.test', password: testPassword }),
    })
    assert.equal(oldPasswordResponse.status, 401)

    const newPasswordResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userName: 'integration.test',
        password: 'new-integration-passphrase',
      }),
    })
    assert.equal(newPasswordResponse.status, 200)
  })

  test('resets password with a one-time email token', async () => {
    await assert.rejects(
      () => requestPasswordReset('reserved@example.dk', async () => {
        throw new Error('test SMTP failure')
      }),
      /Nulstillingsmailen kunne ikke sendes/,
    )
    const userAfterDeliveryFailure = await getDatabase().collection<UserDocument>('users')
      .findOne({ _id: reservedEmailUserId })
    assert.equal(userAfterDeliveryFailure?.passwordResetTokenHash, undefined)

    let expiredResetUrl = ''
    await requestPasswordReset('reserved@example.dk', async (_recipient, url) => {
      expiredResetUrl = url
    })
    const expiredToken = new URL(expiredResetUrl).searchParams.get('token')
    assert.ok(expiredToken)
    await getDatabase().collection<UserDocument>('users').updateOne(
      { _id: reservedEmailUserId },
      { $set: { passwordResetExpiresAt: new Date(Date.now() - 1000) } },
    )
    const expiredResponse = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: expiredToken, newPassword: 'new-reserved-passphrase' }),
    })
    assert.equal(expiredResponse.status, 400)

    let resetUrl = ''
    await requestPasswordReset('reserved@example.dk', async (_recipient, url) => {
      resetUrl = url
    })
    const token = new URL(resetUrl).searchParams.get('token')
    assert.ok(token)

    const resetResponse = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword: 'new-reserved-passphrase' }),
    })
    assert.equal(resetResponse.status, 200)
    assert.deepEqual(await resetResponse.json(), {
      message: 'Adgangskoden er nulstillet. Du kan nu logge ind.',
    })

    const reusedTokenResponse = await fetch(`${baseUrl}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword: 'another-reserved-passphrase' }),
    })
    assert.equal(reusedTokenResponse.status, 400)

    const oldPasswordResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userName: 'reserved.email', password: testPassword }),
    })
    assert.equal(oldPasswordResponse.status, 401)

    const newPasswordResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userName: 'reserved.email',
        password: 'new-reserved-passphrase',
      }),
    })
    assert.equal(newPasswordResponse.status, 200)
  })
})
