import type { ClientSession, ObjectId, WithId } from 'mongodb'
import { getDatabase } from '../config/database.ts'
import type { AssociationDocument } from '../models/association.model.ts'
import type { StorageLocationDocument } from '../models/storage-location.model.ts'

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

export async function updateAssociationById(
  associationId: ObjectId,
  association: Pick<AssociationDocument, 'name' | 'contactPerson'>,
): Promise<boolean> {
  const result = await getDatabase()
    .collection<AssociationDocument>('associations')
    .updateOne(
      { _id: associationId },
      {
        $set: {
          name: association.name,
          contactPerson: association.contactPerson,
          updatedAt: new Date(),
        },
      },
    )

  return result.matchedCount === 1
}

export async function findStorageLocationsByIds(
  ids: ObjectId[],
): Promise<WithId<StorageLocationDocument>[]> {
  if (ids.length === 0) {
    return []
  }
  return getDatabase()
    .collection<StorageLocationDocument>('storagelocation')
    .find({ _id: { $in: ids } })
    .toArray()
}