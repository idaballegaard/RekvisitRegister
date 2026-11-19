import type { ClientSession, ObjectId, WithId } from 'mongodb'
import { getDatabase } from '../config/database.ts'
import type { UserDocument } from '../models/user.model.ts'

export async function countUsers(session: ClientSession): Promise<number> {
  return getDatabase().collection<UserDocument>('users').countDocuments({}, { session })
}

export async function createUser(user: UserDocument, session: ClientSession): Promise<void> {
  await getDatabase().collection<UserDocument>('users').insertOne(user, { session })
}

export async function findUserByUserName(userName: string): Promise<WithId<UserDocument> | null> {
  return getDatabase().collection<UserDocument>('users').findOne({ userName })
}

export async function findUserById(userId: ObjectId): Promise<WithId<UserDocument> | null> {
  return getDatabase().collection<UserDocument>('users').findOne({ _id: userId })
}

export async function findUserByEmail(email: string): Promise<WithId<UserDocument> | null> {
  return getDatabase().collection<UserDocument>('users').findOne(
    { email },
    { collation: { locale: 'en', strength: 2 } },
  )
}

export async function storePasswordResetToken(
  userId: ObjectId,
  tokenHash: string,
  expiresAt: Date,
): Promise<boolean> {
  const result = await getDatabase().collection<UserDocument>('users').updateOne(
    { _id: userId },
    { $set: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt } },
  )

  return result.matchedCount === 1
}

export async function clearPasswordResetToken(
  userId: ObjectId,
  tokenHash: string,
): Promise<void> {
  await getDatabase().collection<UserDocument>('users').updateOne(
    { _id: userId, passwordResetTokenHash: tokenHash },
    { $unset: { passwordResetTokenHash: '', passwordResetExpiresAt: '' } },
  )
}

export async function findUserByPasswordResetToken(
  tokenHash: string,
  now: Date,
): Promise<WithId<UserDocument> | null> {
  return getDatabase().collection<UserDocument>('users').findOne({
    passwordResetTokenHash: tokenHash,
    passwordResetExpiresAt: { $gt: now },
  })
}

export async function storeEmailVerificationToken(
  userId: ObjectId,
  tokenHash: string,
  expiresAt: Date,
): Promise<boolean> {
  const result = await getDatabase().collection<UserDocument>('users').updateOne(
    { _id: userId },
    { $set: { emailVerificationTokenHash: tokenHash, emailVerificationExpiresAt: expiresAt } },
  )

  return result.matchedCount === 1
}

export async function clearEmailVerificationToken(
  userId: ObjectId,
  tokenHash: string,
): Promise<void> {
  await getDatabase().collection<UserDocument>('users').updateOne(
    { _id: userId, emailVerificationTokenHash: tokenHash },
    { $unset: { emailVerificationTokenHash: '', emailVerificationExpiresAt: '' } },
  )
}

export async function findUserByEmailVerificationToken(
  tokenHash: string,
  now: Date,
): Promise<WithId<UserDocument> | null> {
  return getDatabase().collection<UserDocument>('users').findOne({
    emailVerificationTokenHash: tokenHash,
    emailVerificationExpiresAt: { $gt: now },
  })
}

export async function confirmUserEmail(
  userId: ObjectId,
  tokenHash: string,
  now: Date,
): Promise<boolean> {
  const result = await getDatabase().collection<UserDocument>('users').updateOne(
    {
      _id: userId,
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: { $gt: now },
    },
    {
      $set: { emailVerifiedAt: now, updatedAt: now },
      $unset: {
        emailVerificationTokenHash: '',
        emailVerificationExpiresAt: '',
      },
    },
  )

  return result.modifiedCount === 1
}

export async function updatePasswordWithResetToken(
  userId: ObjectId,
  tokenHash: string,
  newPasswordHash: string,
  now: Date,
): Promise<boolean> {
  const result = await getDatabase().collection<UserDocument>('users').updateOne(
    {
      _id: userId,
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: now },
    },
    {
      $set: { passwordHash: newPasswordHash, updatedAt: now },
      $unset: { passwordResetTokenHash: '', passwordResetExpiresAt: '' },
    },
  )

  return result.modifiedCount === 1
}

export async function updateUserPasswordHash(
  userId: ObjectId,
  currentPasswordHash: string,
  newPasswordHash: string,
): Promise<boolean> {
  const result = await getDatabase().collection<UserDocument>('users').updateOne(
    { _id: userId, passwordHash: currentPasswordHash },
    {
      $set: { passwordHash: newPasswordHash, updatedAt: new Date() },
      $unset: { passwordResetTokenHash: '', passwordResetExpiresAt: '' },
    },
  )

  return result.modifiedCount === 1
}

export async function updateUserProfile(
  userId: ObjectId,
  profile: Pick<UserDocument, 'email'>,
  currentEmail: string,
): Promise<boolean> {
  const emailChanged = profile.email !== currentEmail
  const collection = getDatabase().collection<UserDocument>('users')
  const result = emailChanged
    ? await collection.updateOne(
        { _id: userId, email: currentEmail },
        {
          $set: { email: profile.email, updatedAt: new Date() },
          $unset: {
            emailVerifiedAt: '',
            emailVerificationTokenHash: '',
            emailVerificationExpiresAt: '',
            passwordResetTokenHash: '',
            passwordResetExpiresAt: '',
          },
        },
      )
    : await collection.updateOne(
        { _id: userId, email: currentEmail },
        { $set: { email: profile.email, updatedAt: new Date() } },
      )

  return result.matchedCount === 1
}