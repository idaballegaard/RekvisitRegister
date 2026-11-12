import bcrypt from 'bcryptjs'
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  type InitialAdminInput,
  type Permission,
  type ValidatedInitialAdminInput,
} from '../models/user.model.ts'

function requireString(input: InitialAdminInput, field: keyof InitialAdminInput): string {
  const value = input[field]
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${field} mangler eller er tom`)
  }

  return value
}

export function normalizeUserName(userName: string): string {
  return userName.trim().toLowerCase()
}

export function hasPermission(role: string, permission: Permission): boolean {
  return (ROLE_PERMISSIONS as Partial<Record<string, readonly Permission[]>>)[role]
    ?.includes(permission) ?? false
}

export function validateInitialAdminInput(input: InitialAdminInput): ValidatedInitialAdminInput {
  const associationName = requireString(input, 'associationName')
  const firstName = requireString(input, 'firstName')
  const lastName = requireString(input, 'lastName')
  const userNameInput = requireString(input, 'userName')
  const password = requireString(input, 'password')

  const userName = normalizeUserName(userNameInput)
  if (!/^[a-z0-9._-]{3,32}$/.test(userName)) {
    throw new Error('userName skal være 3-32 tegn: bogstaver, tal, punktum, _ eller -')
  }

  const passwordBytes = Buffer.byteLength(password, 'utf8')
  if (passwordBytes < 12 || passwordBytes > 72) {
    throw new Error('Adgangskoden skal være mindst 12 og højst 72 bytes')
  }

  return {
    associationName: associationName.trim(),
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    userName,
    password,
  }
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export { PERMISSIONS }
export type { Permission }