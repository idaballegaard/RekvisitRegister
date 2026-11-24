import type { ObjectId, WithId } from 'mongodb'
import { getDatabase } from '../config/database.ts'
import type { ReservationDocument } from '../models/reservation.model.ts'

export async function findReservationsForProp(
  associationId: ObjectId,
  propId: ObjectId,
): Promise<WithId<ReservationDocument>[]> {
  return getDatabase().collection<ReservationDocument>('reservation')
    .find({ associationId, propId })
    .sort({ startDate: 1, _id: 1 })
    .toArray()
}

export async function findOverlappingReservation(
  associationId: ObjectId,
  propId: ObjectId,
  startDate: Date,
  endDate: Date,
): Promise<boolean> {
  return Boolean(await getDatabase().collection<ReservationDocument>('reservation').findOne({
    associationId,
    propId,
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
  }, { projection: { _id: 1 } }))
}

export async function createReservation(
  reservation: ReservationDocument,
): Promise<WithId<ReservationDocument>> {
  const result = await getDatabase().collection<ReservationDocument>('reservation')
    .insertOne(reservation)
  return { ...reservation, _id: result.insertedId }
}

export async function deleteReservation(
  associationId: ObjectId,
  propId: ObjectId,
  reservationId: ObjectId,
): Promise<boolean> {
  const result = await getDatabase().collection<ReservationDocument>('reservation')
    .deleteOne({ _id: reservationId, associationId, propId })
  return result.deletedCount === 1
}

export async function deleteReservationsForProp(
  associationId: ObjectId,
  propId: ObjectId,
): Promise<void> {
  await getDatabase().collection<ReservationDocument>('reservation')
    .deleteMany({ associationId, propId })
}
