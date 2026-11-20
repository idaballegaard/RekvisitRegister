import assert from 'node:assert/strict'
import { once } from 'node:events'
import express from 'express'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { ObjectId } from 'mongodb'
import type { Server } from 'node:http'
import test, { after, before, describe } from 'node:test'
import { closeDatabase, connectToDatabase, getDatabase } from '../config/database.ts'
import type { PropDocument } from '../models/prop.model.ts'
import type { StorageLocationDocument } from '../models/storage-location.model.ts'
import { ROLES, type UserDocument } from '../models/user.model.ts'
import type { AssociationDocument } from '../models/association.model.ts'
import associationRouter from '../routes/association.routes.ts'
import authRouter from '../routes/auth.routes.ts'
import { requestEmailVerification, requestPasswordReset } from './auth.service.ts'
import { hashPassword } from './user.service.ts'

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
] as const
const originalEnvironment = new Map(
  environmentKeys.map((key) => [key, process.env[key]]),
)

let mongoServer: MongoMemoryServer | undefined
let httpServer: Server | undefined
let baseUrl: string
let expectedAssociationId: ObjectId
let storageLocationIds: [ObjectId, ObjectId]
let expectedUserId: string
let reservedEmailUserId: ObjectId
let authenticatedAccessToken: string
let associationManagerAccessToken: string

describe('auth endpoints with MongoDB', () => {
  before(async () => {
    mongoServer = await MongoMemoryServer.create({
      instance: { dbName: 'auth_integration_test' },
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

      const forbiddenUpdateResponse = await fetch(`${baseUrl}/associations/current`, {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer ' + associationManagerAccessToken,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateInput),
      })
      assert.equal(forbiddenUpdateResponse.status, 403)

      const forbiddenPropEditResponse = await fetch(
        `${baseUrl}/associations/current/props/6b002a5c3c49f74ff7188de8`,
        {
          method: 'PATCH',
          headers: {
            Authorization: 'Bearer ' + associationManagerAccessToken,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'No permission',
            description: '',
            storageLocationId: storageLocationIds[0].toHexString(),
            availability: true,
            dimensions: { height: 1, width: 1, depth: 1, unit: 'cm' },
            quantity: 1,
            colour: '',
            placement: '',
            tags: [],
            condition: '',
            historicalPeriod: '',
          }),
        },
      )
      assert.equal(forbiddenPropEditResponse.status, 403)

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
