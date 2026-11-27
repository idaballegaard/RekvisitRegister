import { createHash, randomBytes } from 'node:crypto'
import { MongoServerError, ObjectId, type WithId } from 'mongodb'
import type { UserDocument } from '../models/user.model.ts'
import { ROLES } from '../models/user.model.ts'
import { withTransaction } from '../config/database.ts'
import {
  acceptUserInvitation,
  createUser,
  deleteUserById,
  findPendingUserByIdForAssociation,
  findUserByInvitationToken,
  listUsersByAssociation,
  replaceUserInvitationToken,
  restoreUserInvitationToken,
} from '../repositories/user.repository.ts'
import {
  createInvitationUrl,
  sendUserInvitation,
} from './email.service.ts'
import { hashPassword, isValidEmail, normalizeEmail, normalizeUserName } from './user.service.ts'

export type AssociationManagedRole = typeof ROLES.PROP_MANAGER | typeof ROLES.SEARCH_USER

export interface CreateAssociationUserInput {
  firstName: string
  lastName: string
  userName: string
  email: string
  role: AssociationManagedRole
}

export interface AssociationUser {
  id: string
  firstName: string
  lastName: string
  userName: string
  email: string
  role: UserDocument['role']
  status: 'active' | 'pending' | 'unverified'
  createdAt: string
}

export interface AcceptInvitationInput {
  token: string
  newPassword: string
}

export class InvalidAssociationUserInputError extends Error {}
export class InvalidInvitationInputError extends Error {}
export class AssociationUserConflictError extends Error {}
export class AssociationUserInvitationDeliveryError extends Error {}
export class InvalidInvitationError extends Error {}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function toAssociationUser(user: WithId<UserDocument>): AssociationUser {
  return {
    id: user._id.toHexString(),
    firstName: user.firstName,
    lastName: user.lastName,
    userName: user.userName,
    email: user.email,
    role: user.role,
    status: user.emailVerifiedAt
      ? 'active'
      : user.invitationTokenHash
        ? 'pending'
        : 'unverified',
    createdAt: user.createdAt.toISOString(),
  }
}

function requireTrimmedString(value: unknown, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new InvalidAssociationUserInputError()
  }
  return value.trim()
}

export function validateCreateAssociationUserInput(input: unknown): CreateAssociationUserInput {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new InvalidAssociationUserInputError()
  }
  const value = input as Record<string, unknown>
  const firstName = requireTrimmedString(value.firstName, 120)
  const lastName = requireTrimmedString(value.lastName, 120)
  const userName = normalizeUserName(requireTrimmedString(value.userName, 32))
  const email = normalizeEmail(requireTrimmedString(value.email, 254))
  if (!/^[a-z0-9._-]{3,32}$/.test(userName)) {
    throw new InvalidAssociationUserInputError(
      'Brugernavnet skal være 3-32 tegn: bogstaver, tal, punktum, _ eller -.',
    )
  }
  if (!isValidEmail(email)) {
    throw new InvalidAssociationUserInputError('Indtast en gyldig e-mailadresse.')
  }
  if (value.role !== ROLES.PROP_MANAGER && value.role !== ROLES.SEARCH_USER) {
    throw new InvalidAssociationUserInputError('Vælg en gyldig brugerrolle.')
  }
  return { firstName, lastName, userName, email, role: value.role }
}

export function validateAcceptInvitationInput(input: unknown): AcceptInvitationInput {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new InvalidInvitationInputError()
  }
  const { token, newPassword } = input as Record<string, unknown>
  if (typeof token !== 'string' || !/^[a-f\d]{64}$/i.test(token)
    || typeof newPassword !== 'string') {
    throw new InvalidInvitationInputError()
  }
  const passwordBytes = Buffer.byteLength(newPassword, 'utf8')
  if (passwordBytes < 12 || passwordBytes > 72) {
    throw new InvalidInvitationInputError(
      'Adgangskoden skal være mindst 12 og højst 72 bytes.',
    )
  }
  return { token, newPassword }
}

export async function getAssociationUsers(associationId: string): Promise<AssociationUser[]> {
  if (!/^[a-f\d]{24}$/i.test(associationId)) {
    throw new Error('Brugerens foreningsreference er ugyldig.')
  }
  const users = await listUsersByAssociation(new ObjectId(associationId))
  return users.map(toAssociationUser)
}

export async function inviteAssociationUser(
  associationId: string,
  input: CreateAssociationUserInput,
  sendInvitation: (email: string, invitationUrl: string) => Promise<void> = sendUserInvitation,
): Promise<AssociationUser> {
  if (!/^[a-f\d]{24}$/i.test(associationId)) {
    throw new Error('Brugerens foreningsreference er ugyldig.')
  }
  const associationObjectId = new ObjectId(associationId)
  const invitationToken = randomBytes(32).toString('hex')
  const invitationTokenHash = hashToken(invitationToken)
  const invitationUrl = createInvitationUrl(invitationToken)
  const now = new Date()
  const userId = new ObjectId()
  const temporaryPasswordHash = await hashPassword(randomBytes(32).toString('hex'))
  const user: UserDocument & { _id: ObjectId } = {
    _id: userId,
    ...input,
    associationId: associationObjectId,
    passwordHash: temporaryPasswordHash,
    invitationTokenHash,
    invitationExpiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    createdAt: now,
    updatedAt: now,
  }

  try {
    await withTransaction(async (_database, session) => {
      await createUser(user, session)
    })
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      throw new AssociationUserConflictError(
        'Brugernavnet eller e-mailadressen er allerede i brug.',
      )
    }
    throw error
  }

  try {
    await sendInvitation(input.email, invitationUrl)
  } catch (error) {
    try {
      await deleteUserById(userId)
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'Invitationen kunne ikke sendes, og den afventende brugerkonto kunne ikke ryddes op.',
      )
    }
    throw new AssociationUserInvitationDeliveryError(
      'Invitationen kunne ikke sendes. Brugeren blev ikke oprettet.',
      { cause: error },
    )
  }

  return toAssociationUser({ ...user })
}

export async function resendAssociationUserInvitation(
  associationId: string,
  userId: string,
  sendInvitation: (email: string, invitationUrl: string) => Promise<void> = sendUserInvitation,
): Promise<void> {
  if (!/^[a-f\d]{24}$/i.test(associationId) || !/^[a-f\d]{24}$/i.test(userId)) {
    throw new InvalidAssociationUserInputError()
  }
  const associationObjectId = new ObjectId(associationId)
  const user = await findPendingUserByIdForAssociation(
    new ObjectId(userId),
    associationObjectId,
  )
  if (!user || !user.invitationTokenHash) {
    throw new InvalidInvitationError()
  }

  const token = randomBytes(32).toString('hex')
  const tokenHash = hashToken(token)
  const invitationUrl = createInvitationUrl(token)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const updated = await replaceUserInvitationToken(
    user._id,
    associationObjectId,
    user.invitationTokenHash,
    tokenHash,
    expiresAt,
  )
  if (!updated) {
    throw new InvalidInvitationError()
  }

  try {
    await sendInvitation(user.email, invitationUrl)
  } catch (error) {
    try {
      const restored = await restoreUserInvitationToken(
        user._id,
        associationObjectId,
        tokenHash,
        user.invitationTokenHash,
        user.invitationExpiresAt,
      )
      if (!restored) {
        throw new Error('Invitationslinket kunne ikke gendannes.')
      }
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'Invitationen kunne ikke sendes, og det tidligere invitationslink kunne ikke gendannes.',
      )
    }
    throw new AssociationUserInvitationDeliveryError(
      'Invitationen kunne ikke sendes.',
      { cause: error },
    )
  }
}

export async function acceptAssociationUserInvitation(
  token: string,
  newPassword: string,
): Promise<void> {
  const tokenHash = hashToken(token)
  const now = new Date()
  const user = await findUserByInvitationToken(tokenHash, now)
  if (!user) {
    throw new InvalidInvitationError()
  }
  const passwordHash = await hashPassword(newPassword)
  if (!await acceptUserInvitation(user._id, tokenHash, passwordHash, now)) {
    throw new InvalidInvitationError()
  }
}
