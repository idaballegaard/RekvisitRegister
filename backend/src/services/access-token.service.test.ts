import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ACCESS_TOKEN_TTL_SECONDS,
  createAccessToken,
  verifyAccessToken,
  type AuthenticatedUser,
} from './access-token.service.ts'

const key = new TextEncoder().encode('test-secret-with-at-least-32-bytes')
const user: AuthenticatedUser = {
  userId: '0123456789abcdef01234567',
  firstName: 'Ada',
  lastName: 'Lovelace',
  userName: 'ada.l',
  role: 'associationAdmin',
  associationId: 'fedcba9876543210fedcba98',
}

test('signs and verifies short-lived access tokens', async () => {
  const token = await createAccessToken(user, key)
  const verifiedUser = await verifyAccessToken(token, key)

  assert.deepEqual(verifiedUser, user)
  assert.equal(ACCESS_TOKEN_TTL_SECONDS, 900)
})

test('rejects tokens signed with a different key', async () => {
  const token = await createAccessToken(user, key)
  const otherKey = new TextEncoder().encode('another-test-secret-with-32-bytes')

  await assert.rejects(() => verifyAccessToken(token, otherKey))
})
