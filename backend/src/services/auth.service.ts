import { ObjectId } from 'mongodb'
import { ROLES } from '../models/user.model.ts'
import { findUserByUserName } from '../repositories/user.repository.ts'
import { normalizeUserName, verifyPassword } from './user.service.ts'
import { createAccessToken, type AuthenticatedUser } from './access-token.service.ts'

export interface LoginInput {
  userName: string
  password: string
}

export class InvalidLoginInputError extends Error {}

export function validateLoginInput(input: unknown): LoginInput {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new InvalidLoginInputError('Login-oplysningerne er ugyldige')
  }

  const { userName, password } = input as Record<string, unknown>
  if (
    typeof userName !== 'string'
    || typeof password !== 'string'
    || !userName.trim()
    || !password
  ) {
    throw new InvalidLoginInputError('Brugernavn og adgangskode skal udfyldes')
  }

  const normalizedUserName = normalizeUserName(userName)
  if (!/^[a-z0-9._-]{3,32}$/.test(normalizedUserName)) {
    throw new InvalidLoginInputError('Brugernavn eller adgangskode er ugyldigt')
  }

  if (Buffer.byteLength(password, 'utf8') > 72) {
    throw new InvalidLoginInputError('Adgangskoden er for lang')
  }

  return { userName: normalizedUserName, password }
}

export async function login(input: LoginInput): Promise<{
  accessToken: string
  user: AuthenticatedUser
} | null> {
  const user = await findUserByUserName(input.userName)
  if (!user || !await verifyPassword(input.password, user.passwordHash)) {
    return null
  }

  if (
    typeof user.firstName !== 'string'
    || !user.firstName.trim()
    || typeof user.lastName !== 'string'
    || !user.lastName.trim()
    || typeof user.userName !== 'string'
    || !user.userName.trim()
  ) {
    throw new Error('Brugerens profiloplysninger er ugyldige')
  }
  if (!(user.associationId instanceof ObjectId)) {
    throw new Error('Brugerens foreningsreference er ugyldig')
  }
  if (!Object.values(ROLES).includes(user.role)) {
    throw new Error('Brugerens rolle er ugyldig')
  }

  const authenticatedUser: AuthenticatedUser = {
    userId: user._id.toHexString(),
    firstName: user.firstName,
    lastName: user.lastName,
    userName: user.userName,
    role: user.role,
    associationId: user.associationId.toHexString(),
  }

  return {
    accessToken: await createAccessToken(authenticatedUser),
    user: authenticatedUser,
  }
}
