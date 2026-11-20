import { ObjectId, type WithId } from 'mongodb'
import type { AssociationProp, PropDocument } from '../models/prop.model.ts'
import { findPropsByAssociationId } from '../repositories/prop.repository.ts'

export class AssociationPropsError extends Error {}

export async function getAssociationProps(associationId: string): Promise<AssociationProp[]> {
  if (!/^[a-f\d]{24}$/i.test(associationId)) {
    throw new AssociationPropsError('Forenings-id’et er ugyldigt.')
  }
  const props = await findPropsByAssociationId(new ObjectId(associationId))
  if (!props.every(isValidProp)) {
    throw new AssociationPropsError('En eller flere rekvisitter har ugyldige databaseoplysninger.')
  }
  return props.map(toAssociationProp)
}

function isValidProp(value: unknown): value is WithId<PropDocument> {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const prop = value as Partial<WithId<PropDocument>>
  const dimensions = prop.dimensions
  return prop._id instanceof ObjectId
    && typeof prop.name === 'string'
    && typeof prop.description === 'string'
    && prop.associationId instanceof ObjectId
    && prop.storageLocationId instanceof ObjectId
    && typeof prop.availability === 'boolean'
    && typeof dimensions === 'object'
    && dimensions !== null
    && typeof dimensions.height === 'number'
    && Number.isFinite(dimensions.height)
    && typeof dimensions.width === 'number'
    && Number.isFinite(dimensions.width)
    && typeof dimensions.depth === 'number'
    && Number.isFinite(dimensions.depth)
    && typeof dimensions.unit === 'string'
    && typeof prop.quantity === 'number'
    && Number.isFinite(prop.quantity)
    && typeof prop.colour === 'string'
    && typeof prop.placement === 'string'
    && Array.isArray(prop.tags)
    && prop.tags.every((tag) => typeof tag === 'string')
    && typeof prop.condition === 'string'
    && typeof prop.historicalPeriod === 'string'
}

function toAssociationProp(prop: WithId<PropDocument>): AssociationProp {
  return {
    id: prop._id.toHexString(),
    name: prop.name,
    description: prop.description,
    storageLocationId: prop.storageLocationId.toHexString(),
    availability: prop.availability,
    dimensions: prop.dimensions,
    quantity: prop.quantity,
    colour: prop.colour,
    placement: prop.placement,
    tags: prop.tags,
    condition: prop.condition,
    historicalPeriod: prop.historicalPeriod,
  }
}
