import type { ObjectId } from 'mongodb'

export interface PropDimensions {
  height: number
  width: number
  depth: number
  unit: string
}

export interface PropDocument {
  name: string
  description: string
  associationId: ObjectId
  storageLocationId: ObjectId
  availability: boolean
  dimensions: PropDimensions
  quantity: number
  colour: string
  placement: string
  tags: string[]
  condition: string
  historicalPeriod: string
  imageIds?: string[]
  reservationRevision?: number
}

export interface AssociationProp {
  id: string
  name: string
  description: string
  storageLocationId: string
  availability: boolean
  dimensions: PropDimensions
  quantity: number
  colour: string
  placement: string
  tags: string[]
  condition: string
  historicalPeriod: string
  imageIds?: string[]
}

export type UpdateAssociationPropInput = Omit<PropDocument, 'associationId' | 'storageLocationId' | 'imageIds'> & {
  storageLocationId: string
}
