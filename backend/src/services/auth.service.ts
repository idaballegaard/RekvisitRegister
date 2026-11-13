import { ObjectId, type WithId } from 'mongodb'
import { ROLES, type UserDocument } from '../models/user.model.ts'
import {
  findUserById,
  findUserByUserName,
  updateUserPasswordHash,
  updateUserProfile,
} from '../repositories/user.repository.ts'
import {
  hashPassword,
  isValidEmail,
  normalizeEmail,
  normalizeUserName,
  verifyPassword,
} from './user.service.ts'
import { createAccessToken, type AuthenticatedUser } from './access-token.service.ts'

export interface LoginInput {
  userName: string
  password: string
}

export class InvalidLoginInputError extends Error {}
export class InvalidPasswordChangeInputError extends Error {}
export class PasswordChangeUserNotFoundError extends Error {}
export class IncorrectCurrentPasswordError extends Error {}
export class PasswordChangeConflictError extends Error {}
export class InvalidProfileInputError extends Error {}
export class ProfileUserNotFoundError extends Error {}

export interface ChangePasswordInput {
  currentPassword: string
  newPassword: string
}

export interface UpdateProfileInput {
  email: string
}

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
  return authenticateUser(input, user)
}

export function validateChangePasswordInput(input: unknown): ChangePasswordInput {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new InvalidPasswordChangeInputError('Adgangskodefelterne er ugyldige')
  }

  const { currentPassword, newPassword } = input as Record<string, unknown>
  if (
    typeof currentPassword !== 'string'
    || !currentPassword
    || typeof newPassword !== 'string'
    || !newPassword
  ) {
    throw new InvalidPasswordChangeInputError(
      'Nuværende og ny adgangskode skal udfyldes',
    )
  }

  const newPasswordBytes = Buffer.byteLength(newPassword, 'utf8')
  if (newPasswordBytes < 12 || newPasswordBytes > 72) {
    throw new InvalidPasswordChangeInputError(
      'Den nye adgangskode skal være mindst 12 og højst 72 bytes',
    )
  }

  if (Buffer.byteLength(currentPassword, 'utf8') > 72) {
    throw new InvalidPasswordChangeInputError('Den nuværende adgangskode er ugyldig')
  }

  return { currentPassword, newPassword }
}

export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
): Promise<void> {
  if (!/^[a-f\d]{24}$/i.test(userId)) {
    throw new PasswordChangeUserNotFoundError()
  }

  const user = await findUserById(new ObjectId(userId))
  if (!user) {
    throw new PasswordChangeUserNotFoundError()
  }

  if (!await verifyPassword(input.currentPassword, user.passwordHash)) {
    throw new IncorrectCurrentPasswordError()
  }

  if (input.currentPassword === input.newPassword) {
    throw new InvalidPasswordChangeInputError(
      'Den nye adgangskode skal være forskellig fra den nuværende',
    )
  }

  const newPasswordHash = await hashPassword(input.newPassword)
  const updated = await updateUserPasswordHash(
    user._id,
    user.passwordHash,
    newPasswordHash,
  )
  if (!updated) {
    throw new PasswordChangeConflictError()
  }
}

export function validateUpdateProfileInput(input: unknown): UpdateProfileInput {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new InvalidProfileInputError('Profiloplysningerne er ugyldige')
  }

  const { email } = input as Record<string, unknown>
  if (typeof email !== 'string' || !email.trim()) {
    throw new InvalidProfileInputError('E-mail skal udfyldes')
  }

  const normalizedEmail = normalizeEmail(email)
  if (!isValidEmail(normalizedEmail)) {
    throw new InvalidProfileInputError('Indtast en gyldig e-mailadresse')
  }

  return { email: normalizedEmail }
}

export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<void> {
  if (!/^[a-f\d]{24}$/i.test(userId)) {
    throw new ProfileUserNotFoundError()
  }

  const updated = await updateUserProfile(new ObjectId(userId), input)
  if (!updated) {
    throw new ProfileUserNotFoundError()
  }
}

export async function authenticateUser(
  input: LoginInput,
  user: WithId<UserDocument> | null,
  tokenKey?: Uint8Array,
): Promise<{
  accessToken: string
  user: AuthenticatedUser
} | null> {
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
    accessToken: await createAccessToken(authenticatedUser, tokenKey),
    user: authenticatedUser,
  }
}
