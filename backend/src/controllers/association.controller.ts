import type { RequestHandler } from 'express'
import { getAuthenticatedUser } from '../middleware/auth.middleware.ts'
import {
  AssociationNotFoundError,
  InvalidAssociationInputError,
  getAssociationProfile,
  updateAssociationProfile,
  validateUpdateAssociationInput,
} from '../services/association.service.ts'

export const getCurrentAssociation: RequestHandler = async (request, response, next) => {
  try {
    const user = getAuthenticatedUser(request)
    const association = await getAssociationProfile(user.associationId)
    response.json({ association })
  } catch (error) {
    if (error instanceof AssociationNotFoundError) {
      response.status(404).json({ error: 'Foreningen blev ikke fundet.' })
      return
    }
    next(error)
  }
}

export const patchCurrentAssociation: RequestHandler = async (request, response, next) => {
  let input
  try {
    input = validateUpdateAssociationInput(request.body)
  } catch (error) {
    if (error instanceof InvalidAssociationInputError) {
      response.status(400).json({ error: error.message })
      return
    }
    next(error)
    return
  }

  try {
    const user = getAuthenticatedUser(request)
    const association = await updateAssociationProfile(user.associationId, input)
    response.json({
      message: 'Foreningens oplysninger er opdateret.',
      association,
    })
  } catch (error) {
    if (error instanceof AssociationNotFoundError) {
      response.status(404).json({ error: 'Foreningen blev ikke fundet.' })
      return
    }
    next(error)
  }
}
