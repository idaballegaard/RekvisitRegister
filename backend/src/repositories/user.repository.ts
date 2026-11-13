import type { ClientSession, WithId } from 'mongodb'
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