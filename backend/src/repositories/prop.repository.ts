import type { ObjectId, WithId } from 'mongodb'
import { getDatabase } from '../config/database.ts'
import type { PropDocument } from '../models/prop.model.ts'

export async function findPropsByAssociationId(
  associationId: ObjectId,
): Promise<WithId<PropDocument>[]> {
  return getDatabase()
    .collection<PropDocument>('prop')
    .find({ associationId })
    .sort({ name: 1, _id: 1 })
    .toArray()
}
