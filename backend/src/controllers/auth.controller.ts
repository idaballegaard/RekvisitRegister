import type { RequestHandler } from 'express'
import { ObjectId } from 'mongodb'
import { findAssociationById } from '../repositories/association.repository.ts'
import { ACCESS_TOKEN_TTL_SECONDS } from '../services/access-token.service.ts'
import {
  changePassword,
  IncorrectCurrentPasswordError,
  InvalidPasswordChangeInputError,
  InvalidLoginInputError,
  login,
  PasswordChangeConflictError,
  PasswordChangeUserNotFoundError,
  type ChangePasswordInput,
  type LoginInput,
  validateLoginInput,
  validateChangePasswordInput,
} from '../services/auth.service.ts'
import { getAuthenticatedUser } from '../middleware/auth.middleware.ts'

export const postLogin: RequestHandler = async (request, response, next) => {
  let input: LoginInput
  try {
    input = validateLoginInput(request.body)
  } catch (error) {
    if (error instanceof InvalidLoginInputError) {
      response.status(400).json({ error: error.message })
      return
    }
    next(error)
    return
  }

  try {
    const result = await login(input)
    if (!result) {
      response.status(401).json({ error: 'Brugernavn eller adgangskode er forkert' })
      return
    }

    response.json({
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      accessToken: result.accessToken,
      user: result.user,
    })
  } catch (error) {
    next(error)
  }
}

export const getCurrentUser: RequestHandler = async (request, response) => {
  const user = getAuthenticatedUser(request)
  const association = await findAssociationById(new ObjectId(user.associationId))
  if (!association) {
    response.status(404).json({ error: 'Brugerens forening blev ikke fundet' })
    return
  }

  response.json({ user: { ...user, associationName: association.name } })
}

export const patchPassword: RequestHandler = async (request, response, next) => {
  let input: ChangePasswordInput
  try {
    input = validateChangePasswordInput(request.body)
  } catch (error) {
    if (error instanceof InvalidPasswordChangeInputError) {
      response.status(400).json({ error: error.message })
      return
    }
    next(error)
    return
  }

  try {
    const user = getAuthenticatedUser(request)
    await changePassword(user.userId, input)
    response.json({ message: 'Adgangskoden er opdateret.' })
  } catch (error) {
    if (error instanceof InvalidPasswordChangeInputError) {
      response.status(400).json({ error: error.message })
      return
    }
    if (error instanceof IncorrectCurrentPasswordError) {
      response.status(400).json({ error: 'Den nuværende adgangskode er forkert.' })
      return
    }
    if (error instanceof PasswordChangeUserNotFoundError) {
      response.status(404).json({ error: 'Brugeren blev ikke fundet.' })
      return
    }
    if (error instanceof PasswordChangeConflictError) {
      response.status(409).json({
        error: 'Adgangskoden blev ændret samtidig. Prøv igen.',
      })
      return
    }
    next(error)
  }
}
