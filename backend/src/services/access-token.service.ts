import { jwtVerify, SignJWT, type JWTPayload } from 'jose'
import { ROLES, type UserDocument, type UserRole } from '../models/user.model.ts'

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60

const TOKEN_ISSUER = 'rekvisit-register-api'
const TOKEN_AUDIENCE = 'rekvisit-register-client'

export interface AuthenticatedUser {
  userId: string
  firstName: string
  lastName: string
  userName: string
  role: UserDocument['role']
  associationId: string
}

export class InvalidAccessTokenError extends Error {}

function isUserRole(role: unknown): role is UserRole {
  return Object.values(ROLES).some((supportedRole) => supportedRole === role)
}

export function getAccessTokenKey(): Uint8Array {
  const secret = process.env.AUTH_TOKEN_SECRET
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
    throw new Error('AUTH_TOKEN_SECRET skal være mindst 32 bytes og konfigureret i backend/.env')
  }

  return new TextEncoder().encode(secret)
}

export async function createAccessToken(
  user: AuthenticatedUser,
  key: Uint8Array = getAccessTokenKey(),
): Promise<string> {
  return new SignJWT({
    firstName: user.firstName,
    lastName: user.lastName,
    userName: user.userName,
    role: user.role,
    associationId: user.associationId,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(TOKEN_ISSUER)
    .setAudience(TOKEN_AUDIENCE)
    .setSubject(user.userId)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(key)
}

export async function verifyAccessToken(
  token: string,
  key: Uint8Array = getAccessTokenKey(),
): Promise<AuthenticatedUser> {
  let payload: JWTPayload
  try {
    const verified = await jwtVerify(token, key, {
      algorithms: ['HS256'],
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    })
    payload = verified.payload
  } catch (error) {
    throw new InvalidAccessTokenError('Login er ugyldigt eller udløbet', { cause: error })
  }

  if (
    typeof payload.sub !== 'string'
    || typeof payload.firstName !== 'string'
    || typeof payload.lastName !== 'string'
    || typeof payload.userName !== 'string'
    || !isUserRole(payload.role)
    || typeof payload.associationId !== 'string'
    || typeof payload.exp !== 'number'
  ) {
    throw new InvalidAccessTokenError('Loginoplysningerne i token er ugyldige')
  }

  return {
    userId: payload.sub,
    firstName: payload.firstName,
    lastName: payload.lastName,
    userName: payload.userName,
    role: payload.role,
    associationId: payload.associationId,
  }
}
