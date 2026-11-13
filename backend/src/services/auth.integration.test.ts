import assert from 'node:assert/strict'
import { once } from 'node:events'
import express from 'express'
import { MongoMemoryServer } from 'mongodb-memory-server'
import { ObjectId } from 'mongodb'
import type { Server } from 'node:http'
import test, { after, before, describe } from 'node:test'
import { closeDatabase, connectToDatabase, getDatabase } from '../config/database.ts'
import { ROLES, type UserDocument } from '../models/user.model.ts'
import authRouter from '../routes/auth.routes.ts'
import { hashPassword } from './user.service.ts'

const testPassword = 'integration-test-passphrase'
const testSigningSecret = 'integration-test-signing-secret-with-32-bytes'
const environmentKeys = ['MONGODB_URI', 'MONGODB_DB_NAME', 'AUTH_TOKEN_SECRET'] as const
const originalEnvironment = new Map(
  environmentKeys.map((key) => [key, process.env[key]]),
)

let mongoServer: MongoMemoryServer | undefined
let httpServer: Server | undefined
let baseUrl: string
let expectedAssociationId: ObjectId
let expectedUserId: string

describe('auth endpoints with MongoDB', () => {
  before(async () => {
    mongoServer = await MongoMemoryServer.create({
      instance: { dbName: 'auth_integration_test' },
    })
    process.env.MONGODB_URI = mongoServer.getUri()
    process.env.MONGODB_DB_NAME = 'auth_integration_test'
    process.env.AUTH_TOKEN_SECRET = testSigningSecret

    await connectToDatabase()
    expectedAssociationId = new ObjectId()
    const user: UserDocument = {
      firstName: 'Integration',
      lastName: 'Tester',
      userName: 'integration.test',
      passwordHash: await hashPassword(testPassword),
      role: ROLES.ASSOCIATION_ADMIN,
      associationId: expectedAssociationId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    const insertResult = await getDatabase().collection<UserDocument>('users').insertOne(user)
    expectedUserId = insertResult.insertedId.toHexString()

    const app = express()
    app.use(express.json())
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

  test('requires a valid token for the current-user endpoint', async () => {
    const unauthenticatedResponse = await fetch(`${baseUrl}/auth/me`)
    assert.equal(unauthenticatedResponse.status, 401)

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

    assert.equal(authenticatedResponse.status, 200)
    assert.deepEqual(await authenticatedResponse.json(), { user: loginBody.user })
  })
})
