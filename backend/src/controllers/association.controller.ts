import type { RequestHandler } from 'express'
import { getAuthenticatedUser } from '../middleware/auth.middleware.ts'
import {
  AssociationPropNotFoundError,
  AssociationPropStorageLocationNotFoundError,
  AssociationPropsError,
  createAssociationProp,
  getAssociationProps,
  InvalidAssociationPropInputError,
  updateAssociationProp,
  validateUpdateAssociationPropInput,
} from '../services/prop.service.ts'
import {
  AssociationNotFoundError,
  AssociationStorageLocationNotFoundError,
  AssociationStorageLocationsError,
  InvalidAssociationInputError,
  addAssociationStorageLocation,
  deleteAssociationStorageLocation,
  editAssociationStorageLocation,
  getAssociationProfile,
  updateAssociationProfile,
  validateCreateStorageLocationInput,
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
    if (error instanceof AssociationStorageLocationsError) {
      response.status(500).json({ error: 'En eller flere lageradresser kunne ikke hentes.' })
      return
    }
    next(error)
  }
}

export const getCurrentAssociationProps: RequestHandler = async (request, response, next) => {
  try {
    const user = getAuthenticatedUser(request)
    const props = await getAssociationProps(user.associationId)
    response.json({ props })
  } catch (error) {
    if (error instanceof AssociationPropsError) {
      response.status(500).json({ error: error.message })
      return
    }
    next(error)
  }
}

export const postCurrentAssociationProp: RequestHandler = async (request, response, next) => {
  try {
    const input = validateUpdateAssociationPropInput(request.body)
    const prop = await createAssociationProp(getAuthenticatedUser(request).associationId, input)
    response.status(201).json({ message: 'Rekvisitten er oprettet.', prop })
  } catch (error) {
    if (error instanceof InvalidAssociationPropInputError) {
      response.status(400).json({ error: error.message })
      return
    }
    if (error instanceof AssociationPropStorageLocationNotFoundError) {
      response.status(400).json({ error: 'Vælg en lageradresse fra din forening.' })
      return
    }
    if (error instanceof AssociationPropsError) {
      response.status(500).json({ error: error.message })
      return
    }
    next(error)
  }
}

export const patchCurrentAssociationProp: RequestHandler = async (request, response, next) => {
  let input
  try {
    input = validateUpdateAssociationPropInput(request.body)
  } catch (error) {
    if (error instanceof InvalidAssociationPropInputError) {
      response.status(400).json({ error: error.message })
      return
    }
    next(error)
    return
  }

  try {
    const user = getAuthenticatedUser(request)
    const prop = await updateAssociationProp(
      user.associationId,
      typeof request.params.propId === 'string' ? request.params.propId : '',
      input,
    )
    response.json({ message: 'Rekvisitten er opdateret.', prop })
  } catch (error) {
    if (error instanceof AssociationPropNotFoundError) {
      response.status(404).json({ error: 'Rekvisitten blev ikke fundet.' })
      return
    }
    if (error instanceof AssociationPropStorageLocationNotFoundError) {
      response.status(400).json({ error: 'Vælg en lageradresse fra din forening.' })
      return
    }
    if (error instanceof AssociationPropsError) {
      response.status(500).json({ error: error.message })
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
    if (error instanceof AssociationStorageLocationsError) {
      response.status(500).json({ error: 'En eller flere lageradresser kunne ikke hentes.' })
      return
    }
    next(error)
  }
}

export const postCurrentAssociationStorageLocation: RequestHandler = async (
  request,
  response,
  next,
) => {
  let input
  try {
    input = validateCreateStorageLocationInput(request.body)
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
    const association = await addAssociationStorageLocation(user.associationId, input)
    response.status(201).json({
      message: 'Lageradressen er tilføjet.',
      association,
    })
  } catch (error) {
    if (error instanceof AssociationNotFoundError) {
      response.status(404).json({ error: 'Foreningen blev ikke fundet.' })
      return
    }
    if (error instanceof AssociationStorageLocationsError) {
      response.status(500).json({ error: 'Lageradressen blev tilføjet, men kunne ikke hentes.' })
      return
    }
    next(error)
  }
}

export const patchCurrentAssociationStorageLocation: RequestHandler = async (
  request,
  response,
  next,
) => {
  let input
  try {
    input = validateCreateStorageLocationInput(request.body)
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
    const association = await editAssociationStorageLocation(
      user.associationId,
      typeof request.params.locationId === 'string' ? request.params.locationId : '',
      input,
    )
    response.json({
      message: 'Lageradressen er opdateret.',
      association,
    })
  } catch (error) {
    if (error instanceof AssociationStorageLocationNotFoundError) {
      response.status(404).json({ error: 'Lageradressen blev ikke fundet.' })
      return
    }
    if (error instanceof AssociationNotFoundError) {
      response.status(404).json({ error: 'Foreningen blev ikke fundet.' })
      return
    }
    if (error instanceof AssociationStorageLocationsError) {
      response.status(500).json({ error: 'Lageradressen blev opdateret, men kunne ikke hentes.' })
      return
    }
    next(error)
  }
}

export const deleteCurrentAssociationStorageLocation: RequestHandler = async (
  request,
  response,
  next,
) => {
  try {
    const user = getAuthenticatedUser(request)
    const association = await deleteAssociationStorageLocation(
      user.associationId,
      typeof request.params.locationId === 'string' ? request.params.locationId : '',
    )
    response.json({
      message: 'Lageradressen er fjernet.',
      association,
    })
  } catch (error) {
    if (error instanceof AssociationStorageLocationNotFoundError) {
      response.status(404).json({ error: 'Lageradressen blev ikke fundet.' })
      return
    }
    if (error instanceof AssociationNotFoundError) {
      response.status(404).json({ error: 'Foreningen blev ikke fundet.' })
      return
    }
    if (error instanceof AssociationStorageLocationsError) {
      response.status(500).json({ error: 'Lageradressen blev fjernet, men listen kunne ikke hentes.' })
      return
    }
    next(error)
  }
}
