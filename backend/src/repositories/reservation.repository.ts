import type { ClientSession, ObjectId, WithId } from 'mongodb'
import { getDatabase } from '../config/database.ts'
import type { PropDocument } from '../models/prop.model.ts'
import type { ReservationDocument } from '../models/reservation.model.ts'

export async function lockPropForLoan(
  associationId: ObjectId,
  propId: ObjectId,
  session: ClientSession,
): Promise<boolean> {
  const result = await getDatabase().collection<PropDocument>('prop').updateOne(
    { _id: propId, associationId },
    { $inc: { reservationRevision: 1 } },
    { session },
  )
  return result.matchedCount === 1
}

export async function lockPropForReservation(
  associationId: ObjectId,
  propId: ObjectId,
  session: ClientSession,
): Promise<'available' | 'unavailable' | 'not-found'> {
  const props = getDatabase().collection<PropDocument>('prop')
  const result = await props.updateOne(
    { _id: propId, associationId, availability: true },
    { $inc: { reservationRevision: 1 } },
    { session },
  )
  if (result.matchedCount === 1) {
    return 'available'
  }

  const prop = await props.findOne(
    { _id: propId, associationId },
    { session, projection: { _id: 1 } },
  )
  return prop ? 'unavailable' : 'not-found'
}

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
  session: ClientSession,
): Promise<boolean> {
  const endExclusive = new Date(endDate)
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1)
  return Boolean(await getDatabase().collection<ReservationDocument>('reservation').findOne({
    associationId,
    propId,
    startDate: { $lt: endExclusive },
    endDate: { $gte: startDate },
  }, { session, projection: { _id: 1 } }))
}

export async function createReservation(
  reservation: ReservationDocument,
  session: ClientSession,
): Promise<WithId<ReservationDocument>> {
  const result = await getDatabase().collection<ReservationDocument>('reservation')
    .insertOne(reservation, { session })
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
  session: ClientSession,
): Promise<void> {
  await getDatabase().collection<ReservationDocument>('reservation')
    .deleteMany({ associationId, propId }, { session })
}
