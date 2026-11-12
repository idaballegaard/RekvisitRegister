import type { Request, RequestHandler } from 'express'
import {
  getAccessTokenKey,
  InvalidAccessTokenError,
  verifyAccessToken,
  type AuthenticatedUser,
} from '../services/access-token.service.ts'

declare global {
  namespace Express {
    interface Request {
      authenticatedUser?: AuthenticatedUser
    }
  }
}

export const requireAuthentication: RequestHandler = async (request, response, next) => {
  const authorization = request.get('authorization')
  const match = authorization?.match(/^Bearer ([^\s]+)$/i)

  if (!match) {
    response.status(401).json({ error: 'Login er påkrævet' })
    return
  }

  const key = getAccessTokenKey()
  try {
    request.authenticatedUser = await verifyAccessToken(match[1], key)
    next()
  } catch (error) {
    if (!(error instanceof InvalidAccessTokenError)) {
      next(error)
      return
    }
    response.status(401).json({ error: 'Login er ugyldigt eller udløbet' })
  }
}

export function getAuthenticatedUser(request: Request): AuthenticatedUser {
  if (!request.authenticatedUser) {
    throw new Error('Autentificeret bruger mangler efter middleware')
  }
  return request.authenticatedUser
}
