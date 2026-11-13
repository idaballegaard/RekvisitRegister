import assert from 'node:assert/strict'
import test from 'node:test'
import bcrypt from 'bcryptjs'
import { PERMISSIONS, ROLES } from '../models/user.model.ts'
import {
  hasPermission,
  hashPassword,
  normalizeUserName,
  validateInitialAdminInput,
} from './user.service.ts'

const validInput = {
  associationName: 'Esbjerg Amatørteater Råd',
  firstName: 'Ada',
  lastName: 'Lovelace',
  userName: ' Ada.L ',
  password: 'a-long-passphrase',
}

test('normalizes usernames consistently', () => {
  assert.equal(normalizeUserName(' Ada.L '), 'ada.l')
})

test('validates bootstrap data and assigns the association admin role', () => {
  const user = validateInitialAdminInput(validInput)

  assert.equal(user.userName, 'ada.l')
  assert.equal(ROLES.ASSOCIATION_ADMIN, 'associationAdmin')
})

test('rejects short passwords', () => {
  assert.throws(
    () => validateInitialAdminInput({ ...validInput, password: 'short' }),
    /mindst 12/,
  )
})

test('hashes passwords so only the hash is stored', async () => {
  const password = 'a-long-passphrase'
  const passwordHash = await hashPassword(password)

  assert.notEqual(passwordHash, password)
  assert.equal(await bcrypt.compare(password, passwordHash), true)
})

test('rejects unsupported usernames', () => {
  assert.throws(
    () => validateInitialAdminInput({ ...validInput, userName: 'Ada Lovelace' }),
    /userName skal være/,
  )
})

test('grants each role only its defined capabilities', () => {
  assert.equal(hasPermission(ROLES.ASSOCIATION_ADMIN, PERMISSIONS.CREATE_ASSOCIATION_USERS), true)
  assert.equal(hasPermission(ROLES.ASSOCIATION_ADMIN, PERMISSIONS.UPDATE_ASSOCIATION), true)
  assert.equal(hasPermission(ROLES.PROP_MANAGER, PERMISSIONS.MANAGE_PROPS), true)
  assert.equal(hasPermission(ROLES.PROP_MANAGER, PERMISSIONS.APPROVE_LOANS), true)
  assert.equal(hasPermission(ROLES.SEARCH_USER, PERMISSIONS.REQUEST_LOANS), true)
  assert.equal(hasPermission(ROLES.SEARCH_USER, PERMISSIONS.APPROVE_LOANS), false)
  assert.equal(hasPermission('unknownRole', PERMISSIONS.SEARCH_PROPS), false)
})