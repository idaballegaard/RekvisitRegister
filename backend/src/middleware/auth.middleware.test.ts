import assert from 'node:assert/strict'
import { once } from 'node:events'
import express from 'express'
import test from 'node:test'
import { PERMISSIONS, ROLES } from '../models/user.model.ts'
import { createAccessToken } from '../services/access-token.service.ts'
import { requireAuthentication, requirePermission } from './auth.middleware.ts'

const signingKey = new TextEncoder().encode('test-secret-with-at-least-32-bytes')
const authenticatedUser = {
  userId: '0123456789abcdef01234567',
  firstName: 'Ada',
  lastName: 'Lovelace',
  userName: 'ada.l',
  role: ROLES.PROP_MANAGER,
  associationId: 'fedcba9876543210fedcba98',
}

test('protects permission routes with authentication and role checks', async (context) => {
  const originalSecret = process.env.AUTH_TOKEN_SECRET
  process.env.AUTH_TOKEN_SECRET = Buffer.from(signingKey).toString('utf8')
  context.after(() => {
    if (originalSecret === undefined) {
      delete process.env.AUTH_TOKEN_SECRET
    } else {
      process.env.AUTH_TOKEN_SECRET = originalSecret
    }
  })

  const token = await createAccessToken(authenticatedUser, signingKey)
  const app = express()
  app.get(
    '/manage-props',
    requireAuthentication,
    requirePermission(PERMISSIONS.MANAGE_PROPS),
    (_request, response) => response.json({ status: 'ok' }),
  )
  app.get(
    '/create-users',
    requireAuthentication,
    requirePermission(PERMISSIONS.CREATE_ASSOCIATION_USERS),
    (_request, response) => response.json({ status: 'ok' }),
  )

  const server = app.listen(0)
  await once(server, 'listening')
  context.after(async () => {
    server.close()
    await once(server, 'close')
  })

  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const baseUrl = `http://127.0.0.1:${address.port}`

  const unauthenticatedResponse = await fetch(`${baseUrl}/manage-props`)
  assert.equal(unauthenticatedResponse.status, 401)

  const forbiddenResponse = await fetch(`${baseUrl}/create-users`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(forbiddenResponse.status, 403)

  const allowedResponse = await fetch(`${baseUrl}/manage-props`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  assert.equal(allowedResponse.status, 200)
  assert.deepEqual(await allowedResponse.json(), { status: 'ok' })
})
