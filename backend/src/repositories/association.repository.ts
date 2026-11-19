import type { ClientSession, ObjectId, WithId } from 'mongodb'
import { getDatabase } from '../config/database.ts'
import type { AssociationDocument } from '../models/association.model.ts'

export async function countAssociations(session: ClientSession): Promise<number> {
  return getDatabase().collection<AssociationDocument>('associations').countDocuments({}, { session })
}

export async function createAssociation(
  association: AssociationDocument,
  session: ClientSession,
): Promise<ObjectId> {
  const result = await getDatabase()
    .collection<AssociationDocument>('associations')
    .insertOne(association, { session })

  return result.insertedId
}

export async function findAssociationById(
  associationId: ObjectId,
): Promise<WithId<AssociationDocument> | null> {
  return getDatabase()
    .collection<AssociationDocument>('associations')
    .findOne({ _id: associationId })
}