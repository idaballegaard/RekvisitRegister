import { ObjectId, type WithId } from 'mongodb'
import type { AssociationReservation, ReservationDocument } from '../models/reservation.model.ts'
import type { PropDocument } from '../models/prop.model.ts'
import { getDatabase, withTransaction } from '../config/database.ts'
import {
  createReservation,
  deleteReservation,
  findOverlappingReservation,
  findReservationsForProp,
  lockPropForReservation,
} from '../repositories/reservation.repository.ts'
import { findOverlappingApprovedLoan } from '../repositories/loan.repository.ts'

export class ReservationNotFoundError extends Error {}
export class InvalidReservationInputError extends Error {}
export class ReservationConflictError extends Error {}
export class PropUnavailableError extends Error {}

export interface ReservationDateInput {
  startDate: string
  endDate: string
}

export function validateReservationDateInput(input: unknown): ReservationDateInput {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new InvalidReservationInputError('Reservationsperioden er ugyldig.')
  }
  const value = input as Record<string, unknown>
  if (!isDateOnly(value.startDate) || !isDateOnly(value.endDate)) {
    throw new InvalidReservationInputError('Angiv en gyldig start- og slutdato.')
  }
  if (value.startDate > value.endDate) {
    throw new InvalidReservationInputError('Slutdatoen skal være samme dag som eller efter startdatoen.')
  }
  return { startDate: value.startDate, endDate: value.endDate }
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function parseId(value: string): ObjectId {
  if (!/^[a-f\d]{24}$/i.test(value)) {
    throw new ReservationNotFoundError()
  }
  return new ObjectId(value)
}

function toAssociationReservation(
  reservation: WithId<ReservationDocument>,
): AssociationReservation {
  return {
    id: reservation._id.toHexString(),
    propId: reservation.propId.toHexString(),
    startDate: reservation.startDate.toISOString().slice(0, 10),
    endDate: reservation.endDate.toISOString().slice(0, 10),
    createdAt: reservation.createdAt.toISOString(),
  }
}

async function findPropAvailability(associationId: ObjectId, propId: ObjectId): Promise<boolean> {
  const prop = await getDatabase().collection<PropDocument>('prop')
    .findOne({ _id: propId, associationId }, { projection: { availability: 1 } })
  if (!prop) {
    throw new ReservationNotFoundError()
  }
  return prop.availability
}

export async function getPropReservations(
  associationId: string,
  propId: string,
): Promise<AssociationReservation[]> {
  const associationObjectId = parseId(associationId)
  const propObjectId = parseId(propId)
  await findPropAvailability(associationObjectId, propObjectId)
  return (await findReservationsForProp(associationObjectId, propObjectId))
    .map(toAssociationReservation)
}

export async function reservePropPeriod(
  associationId: string,
  propId: string,
  userId: string,
  input: ReservationDateInput,
): Promise<AssociationReservation> {
  const associationObjectId = parseId(associationId)
  const propObjectId = parseId(propId)
  const startDate = new Date(`${input.startDate}T00:00:00.000Z`)
  const endDate = new Date(`${input.endDate}T00:00:00.000Z`)
  return withTransaction(async (_database, session) => {
    const propStatus = await lockPropForReservation(
      associationObjectId,
      propObjectId,
      session,
    )
    if (propStatus === 'not-found') {
      throw new ReservationNotFoundError()
    }
    if (propStatus === 'unavailable') {
      throw new PropUnavailableError()
    }
    if (await findOverlappingReservation(
      associationObjectId,
      propObjectId,
      startDate,
      endDate,
      session,
    )) {
      throw new ReservationConflictError(
        'Rekvisitten er allerede reserveret i den valgte periode.',
      )
    }
    if (await findOverlappingApprovedLoan(propObjectId, startDate, endDate, session)) {
      throw new ReservationConflictError(
        'Rekvisitten er allerede udlånt i den valgte periode.',
      )
    }
    const reservation = await createReservation({
      associationId: associationObjectId,
      propId: propObjectId,
      startDate,
      endDate,
      createdByUserId: userId,
      createdAt: new Date(),
    }, session)
    return toAssociationReservation(reservation)
  })
}

export async function removePropReservation(
  associationId: string,
  propId: string,
  reservationId: string,
): Promise<void> {
  const associationObjectId = parseId(associationId)
  const propObjectId = parseId(propId)
  const reservationObjectId = parseId(reservationId)
  if (!await deleteReservation(associationObjectId, propObjectId, reservationObjectId)) {
    throw new ReservationNotFoundError()
  }
}
