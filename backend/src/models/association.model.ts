import type { ObjectId } from 'mongodb'

export interface AssociationDocument {
  name: string
  storageLocationIds?: ObjectId[]
  contactPerson?: {
    name: string
    email: string
    phone: string
  }
  createdAt: Date
  updatedAt: Date
}