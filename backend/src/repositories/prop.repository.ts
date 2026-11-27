import type { ClientSession, ObjectId, WithId } from 'mongodb'
import { getDatabase } from '../config/database.ts'
import type { PropDocument, UpdateAssociationPropInput } from '../models/prop.model.ts'

export async function createProp(prop: PropDocument): Promise<WithId<PropDocument>> {
  const result = await getDatabase().collection<PropDocument>('prop').insertOne(prop)
  return { ...prop, _id: result.insertedId }
}

export async function findPropsByAssociationId(
  associationId: ObjectId,
): Promise<WithId<PropDocument>[]> {
  return getDatabase()
    .collection<PropDocument>('prop')
    .find({ associationId })
    .sort({ name: 1, _id: 1 })
    .toArray()
}

export async function updatePropByIdForAssociation(
  propId: ObjectId,
  associationId: ObjectId,
  input: Omit<UpdateAssociationPropInput, 'storageLocationId'> & { storageLocationId: ObjectId },
): Promise<boolean> {
  const result = await getDatabase()
    .collection<PropDocument>('prop')
    .updateOne(
      { _id: propId, associationId },
      {
        $set: {
          name: input.name,
          description: input.description,
          storageLocationId: input.storageLocationId,
          availability: input.availability,
          dimensions: input.dimensions,
          quantity: input.quantity,
          colour: input.colour,
          placement: input.placement,
          tags: input.tags,
          condition: input.condition,
          historicalPeriod: input.historicalPeriod,
        },
      },
    )

  return result.matchedCount === 1
}

export async function deletePropByIdForAssociation(
  propId: ObjectId,
  associationId: ObjectId,
  session: ClientSession,
): Promise<WithId<PropDocument> | null> {
  return getDatabase()
    .collection<PropDocument>('prop')
    .findOneAndDelete({ _id: propId, associationId }, { session })
}
