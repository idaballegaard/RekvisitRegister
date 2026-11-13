import type { Request, RequestHandler } from 'express'
import {
  getAccessTokenKey,
  InvalidAccessTokenError,
  verifyAccessToken,
  type AuthenticatedUser,
} from '../services/access-token.service.ts'
import { hasPermission } from '../services/user.service.ts'
import type { Permission } from '../models/user.model.ts'

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

export function requirePermission(permission: Permission): RequestHandler {
  return (request, response, next) => {
    const user = request.authenticatedUser
    if (!user) {
      response.status(401).json({ error: 'Login er påkrævet' })
      return
    }

    if (!hasPermission(user.role, permission)) {
      response.status(403).json({ error: 'Du har ikke adgang til denne handling' })
      return
    }

    next()
  }
}

export function getAuthenticatedUser(request: Request): AuthenticatedUser {
  if (!request.authenticatedUser) {
    throw new Error('Autentificeret bruger mangler efter middleware')
  }
  return request.authenticatedUser
}
