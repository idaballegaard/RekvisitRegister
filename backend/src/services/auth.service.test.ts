import assert from 'node:assert/strict'
import test from 'node:test'
import { InvalidLoginInputError, validateLoginInput } from './auth.service.ts'

test('normalizes login usernames', () => {
  assert.deepEqual(
    validateLoginInput({ userName: ' Ada.L ', password: 'a-long-passphrase' }),
    { userName: 'ada.l', password: 'a-long-passphrase' },
  )
})

test('rejects incomplete or invalid login input', () => {
  assert.throws(() => validateLoginInput({ userName: '', password: 'secret' }), InvalidLoginInputError)
  assert.throws(() => validateLoginInput({ userName: 'ada.l', password: '' }), InvalidLoginInputError)
  assert.throws(
    () => validateLoginInput({ userName: 'ada.l', password: 'x'.repeat(73) }),
    /for lang/,
  )
})
