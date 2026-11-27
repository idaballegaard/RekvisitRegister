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

export async function createStorageLocationForAssociation(
  associationId: ObjectId,
  storageLocation: StorageLocationDocument,
): Promise<boolean> {
  const locations = getDatabase().collection<StorageLocationDocument>('storagelocation')
  const associations = getDatabase().collection<AssociationDocument>('associations')
  const { insertedId } = await locations.insertOne(storageLocation)

  try {
    const result = await associations.updateOne(
      { _id: associationId },
      {
        $push: { storageLocationIds: insertedId },
        $set: { updatedAt: new Date() },
      },
    )
    if (result.matchedCount === 1) {
      return true
    }
  } catch (error) {
    try {
      await locations.deleteOne({ _id: insertedId })
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'Lageradressen kunne ikke knyttes til foreningen, og oprydning fejlede.',
      )
    }
    throw error
  }

  await locations.deleteOne({ _id: insertedId })
  return false
}

export async function updateStorageLocationForAssociation(
  associationId: ObjectId,
  storageLocationId: ObjectId,
  storageLocation: StorageLocationDocument,
): Promise<boolean> {
  const associations = getDatabase().collection<AssociationDocument>('associations')
  const locations = getDatabase().collection<StorageLocationDocument>('storagelocation')
  const { insertedId } = await locations.insertOne(storageLocation)
  let result
  try {
    result = await associations.updateOne(
      { _id: associationId, storageLocationIds: storageLocationId },
      {
        $set: {
          'storageLocationIds.$': insertedId,
          updatedAt: new Date(),
        },
      },
    )
  } catch (error) {
    try {
      await locations.deleteOne({ _id: insertedId })
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'Lageradressen kunne ikke opdateres, og oprydning fejlede.',
      )
    }
    throw error
  }
  if (result.matchedCount !== 1) {
    await locations.deleteOne({ _id: insertedId })
    return false
  }

  const stillReferenced = await associations.findOne({ storageLocationIds: storageLocationId })
  if (!stillReferenced) {
    await locations.deleteOne({ _id: storageLocationId })
  }
  return true
}

export async function removeStorageLocationFromAssociation(
  associationId: ObjectId,
  storageLocationId: ObjectId,
): Promise<boolean> {
  const database = getDatabase()
  const associations = database.collection<AssociationDocument>('associations')
  const result = await associations.updateOne(
    { _id: associationId, storageLocationIds: storageLocationId },
    {
      $pull: { storageLocationIds: storageLocationId },
      $set: { updatedAt: new Date() },
    },
  )
  if (result.matchedCount !== 1) {
    return false
  }

  const stillReferenced = await associations.findOne({ storageLocationIds: storageLocationId })
  if (!stillReferenced) {
    await database.collection<StorageLocationDocument>('storagelocation')
      .deleteOne({ _id: storageLocationId })
  }
  return true
}