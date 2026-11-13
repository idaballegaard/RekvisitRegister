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

export async function updateUserPasswordHash(
  userId: ObjectId,
  currentPasswordHash: string,
  newPasswordHash: string,
): Promise<boolean> {
  const result = await getDatabase().collection<UserDocument>('users').updateOne(
    { _id: userId, passwordHash: currentPasswordHash },
    { $set: { passwordHash: newPasswordHash, updatedAt: new Date() } },
  )

  return result.modifiedCount === 1
}

export async function updateUserProfile(
  userId: ObjectId,
  profile: Pick<UserDocument, 'email'>,
): Promise<boolean> {
  const result = await getDatabase().collection<UserDocument>('users').updateOne(
    { _id: userId },
    { $set: { email: profile.email, updatedAt: new Date() } },
  )

  return result.matchedCount === 1
}