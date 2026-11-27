import type { RequestHandler } from 'express'
import { getAuthenticatedUser } from '../middleware/auth.middleware.ts'
import {
  AssociationUserConflictError,
  AssociationUserInvitationDeliveryError,
  getAssociationUsers,
  InvalidInvitationError,
  InvalidAssociationUserInputError,
  inviteAssociationUser,
  resendAssociationUserInvitation,
  type CreateAssociationUserInput,
  validateCreateAssociationUserInput,
} from '../services/association-user.service.ts'
import { assertEmailDeliveryConfigured, EmailConfigurationError } from '../services/email.service.ts'

export const getCurrentAssociationUsers: RequestHandler = async (request, response, next) => {
  try {
    const users = await getAssociationUsers(getAuthenticatedUser(request).associationId)
    response.json({ users })
  } catch (error) {
    next(error)
  }
}

export const postCurrentAssociationUser: RequestHandler = async (request, response, next) => {
  let input: CreateAssociationUserInput
  try {
    input = validateCreateAssociationUserInput(request.body)
    assertEmailDeliveryConfigured()
  } catch (error) {
    if (error instanceof InvalidAssociationUserInputError) {
      response.status(400).json({
        error: error.message || 'Brugeroplysningerne er ugyldige.',
      })
      return
    }
    if (error instanceof EmailConfigurationError) {
      response.status(503).json({
        error: 'E-mailinvitationer er ikke konfigureret. Kontakt administratoren.',
      })
      return
    }
    next(error)
    return
  }

  try {
    const user = getAuthenticatedUser(request)
    const createdUser = await inviteAssociationUser(user.associationId, input)
    response.status(201).json({
      message: 'Brugeren er oprettet, og en invitation er sendt.',
      user: createdUser,
    })
  } catch (error) {
    if (error instanceof AssociationUserConflictError) {
      response.status(409).json({ error: error.message })
      return
    }
    if (error instanceof AssociationUserInvitationDeliveryError) {
      response.status(503).json({ error: error.message })
      return
    }
    next(error)
  }
}

export const postCurrentAssociationUserInvitation: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    assertEmailDeliveryConfigured()
  } catch (error) {
    if (error instanceof EmailConfigurationError) {
      response.status(503).json({
        error: 'E-mailinvitationer er ikke konfigureret. Kontakt administratoren.',
      })
      return
    }
    next(error)
    return
  }

  try {
    const user = getAuthenticatedUser(request)
    const userId = typeof request.params.userId === 'string' ? request.params.userId : ''
    await resendAssociationUserInvitation(user.associationId, userId)
    response.json({ message: 'Invitationen er sendt igen.' })
  } catch (error) {
    if (error instanceof InvalidInvitationError) {
      response.status(404).json({
        error: 'Den afventende bruger blev ikke fundet i foreningen.',
      })
      return
    }
    if (error instanceof AssociationUserInvitationDeliveryError) {
      response.status(503).json({ error: error.message })
      return
    }
    next(error)
  }
}
