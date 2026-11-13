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
  const email = normalizeEmail(requireString(input, 'email'))
  const password = requireString(input, 'password')

  const userName = normalizeUserName(userNameInput)
  if (!/^[a-z0-9._-]{3,32}$/.test(userName)) {
    throw new Error('userName skal være 3-32 tegn: bogstaver, tal, punktum, _ eller -')
  }

  if (!isValidEmail(email)) {
    throw new Error('email skal være en gyldig e-mailadresse')
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
    email,
    password,
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash)
}

export { PERMISSIONS }
export type { Permission }