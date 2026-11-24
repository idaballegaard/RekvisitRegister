import type { ObjectId } from 'mongodb'

export interface ReservationDocument {
  associationId: ObjectId
  propId: ObjectId
  startDate: Date
  endDate: Date
  createdByUserId: string
  createdAt: Date
}

export interface AssociationReservation {
  id: string
  propId: string
  startDate: string
  endDate: string
  createdAt: string
}
