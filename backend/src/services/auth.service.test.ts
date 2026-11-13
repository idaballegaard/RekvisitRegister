import assert from 'node:assert/strict'
import { ObjectId, type WithId } from 'mongodb'
import test, { before, describe } from 'node:test'
import type { UserDocument } from '../models/user.model.ts'
import {
  authenticateUser,
  InvalidLoginInputError,
  validateLoginInput,
} from './auth.service.ts'
import { verifyAccessToken } from './access-token.service.ts'
import { hashPassword } from './user.service.ts'

const signingKey = new TextEncoder().encode('unit-test-signing-key-with-32-bytes')
const password = 'correct-test-passphrase'
let user: WithId<UserDocument>

test('normalizes login usernames', () => {
  assert.deepEqual(
    validateLoginInput({ userName: ' Ada.L ', password: 'a-long-passphrase' }),
    { userName: 'ada.l', password: 'a-long-passphrase' },
  )
})

describe('authenticateUser', () => {
  before(async () => {
    user = {
      _id: new ObjectId(),
      firstName: 'Ada',
      lastName: 'Lovelace',
      userName: 'ada.l',
      passwordHash: await hashPassword(password),
      role: 'associationAdmin',
      associationId: new ObjectId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  })

  test('authenticates a matching password and returns a token without password data', async () => {
    const result = await authenticateUser(
      { userName: user.userName, password },
      user,
      signingKey,
    )

    assert.ok(result)
    assert.deepEqual(result.user, {
      userId: user._id.toHexString(),
      firstName: user.firstName,
      lastName: user.lastName,
      userName: user.userName,
      role: user.role,
      associationId: user.associationId.toHexString(),
    })
    assert.equal('passwordHash' in result.user, false)
    assert.deepEqual(await verifyAccessToken(result.accessToken, signingKey), result.user)
  })

  test('rejects an incorrect password', async () => {
    assert.equal(
      await authenticateUser({ userName: user.userName, password: 'wrong-password' }, user, signingKey),
      null,
    )
  })

  test('rejects a user that was not found', async () => {
    assert.equal(
      await authenticateUser({ userName: 'missing', password }, null, signingKey),
      null,
    )
  })
})

test('rejects incomplete or invalid login input', () => {
  assert.throws(() => validateLoginInput({ userName: '', password: 'secret' }), InvalidLoginInputError)
  assert.throws(() => validateLoginInput({ userName: 'ada.l', password: '' }), InvalidLoginInputError)
  assert.throws(
    () => validateLoginInput({ userName: 'ada.l', password: 'x'.repeat(73) }),
    /for lang/,
  )
})
