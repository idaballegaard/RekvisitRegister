import type { RequestHandler } from 'express'
import { getAuthenticatedUser } from '../middleware/auth.middleware.ts'
import {
  getPropReservations,
  InvalidReservationInputError,
  PropUnavailableError,
  removePropReservation,
  ReservationConflictError,
  ReservationNotFoundError,
  reservePropPeriod,
  validateReservationDateInput,
} from '../services/reservation.service.ts'

function routeParam(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : ''
}

export const getCurrentPropReservations: RequestHandler = async (request, response, next) => {
  try {
    const reservations = await getPropReservations(
      getAuthenticatedUser(request).associationId,
      routeParam(request.params.propId),
    )
    response.json({ reservations })
  } catch (error) {
    if (error instanceof ReservationNotFoundError) {
      response.status(404).json({ error: 'Rekvisitten blev ikke fundet.' })
      return
    }
    next(error)
  }
}

export const postCurrentPropReservation: RequestHandler = async (request, response, next) => {
  try {
    const user = getAuthenticatedUser(request)
    const input = validateReservationDateInput(request.body)
    const reservation = await reservePropPeriod(
      user.associationId,
      routeParam(request.params.propId),
      user.userId,
      input,
    )
    response.status(201).json({ message: 'Reservationen er oprettet.', reservation })
  } catch (error) {
    if (error instanceof InvalidReservationInputError) {
      response.status(400).json({ error: error.message })
      return
    }
    if (error instanceof ReservationNotFoundError) {
      response.status(404).json({ error: 'Rekvisitten blev ikke fundet.' })
      return
    }
    if (error instanceof PropUnavailableError) {
      response.status(409).json({ error: 'Rekvisitten er markeret som utilgængelig.' })
      return
    }
    if (error instanceof ReservationConflictError) {
      response.status(409).json({ error: error.message })
      return
    }
    next(error)
  }
}

export const deleteCurrentPropReservation: RequestHandler = async (request, response, next) => {
  try {
    await removePropReservation(
      getAuthenticatedUser(request).associationId,
      routeParam(request.params.propId),
      routeParam(request.params.reservationId),
    )
    response.json({ message: 'Reservationen er fjernet.' })
  } catch (error) {
    if (error instanceof ReservationNotFoundError) {
      response.status(404).json({ error: 'Reservationen blev ikke fundet.' })
      return
    }
    next(error)
  }
}
