import type { RequestHandler } from 'express'
import { ObjectId } from 'mongodb'
import { findAssociationById } from '../repositories/association.repository.ts'
import { ACCESS_TOKEN_TTL_SECONDS } from '../services/access-token.service.ts'
import {
  InvalidLoginInputError,
  login,
  type LoginInput,
  validateLoginInput,
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
