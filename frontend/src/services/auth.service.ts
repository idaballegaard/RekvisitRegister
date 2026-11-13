export interface AuthenticatedUser {
  userId: string
  firstName: string
  lastName: string
  userName: string
  role: 'associationAdmin' | 'propManager' | 'searchUser'
  associationId: string
}

export interface CurrentUserProfile extends AuthenticatedUser {
  associationName: string
}

interface LoginResponse {
  tokenType: 'Bearer'
  expiresIn: number
  accessToken: string
  user: AuthenticatedUser
}

interface LoginCredentials {
  userName: string
  password: string
}

const ACCESS_TOKEN_KEY = 'rekvisit-register.access-token'

export class UnauthorizedError extends Error {}

function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const user = value as Partial<AuthenticatedUser>
  return typeof user.userId === 'string'
    && typeof user.firstName === 'string'
    && typeof user.lastName === 'string'
    && typeof user.userName === 'string'
    && typeof user.role === 'string'
    && ['associationAdmin', 'propManager', 'searchUser'].includes(user.role)
    && typeof user.associationId === 'string'
}

function isCurrentUserProfile(value: unknown): value is CurrentUserProfile {
  return isAuthenticatedUser(value)
    && 'associationName' in value
    && typeof value.associationName === 'string'
}

export function hasAccessToken(): boolean {
  return Boolean(sessionStorage.getItem(ACCESS_TOKEN_KEY))
}

export function clearAuthSession(): void {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
}

function isLoginResponse(value: unknown): value is LoginResponse {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const response = value as Partial<LoginResponse>
  const user = response.user
  return response.tokenType === 'Bearer'
    && typeof response.expiresIn === 'number'
    && typeof response.accessToken === 'string'
    && typeof user === 'object'
    && user !== null
    && typeof user.userId === 'string'
    && typeof user.firstName === 'string'
    && typeof user.lastName === 'string'
    && typeof user.userName === 'string'
    && ['associationAdmin', 'propManager', 'searchUser'].includes(user.role)
    && typeof user.associationId === 'string'
}

export async function login(credentials: LoginCredentials): Promise<LoginResponse> {
  let response: Response
  try {
    response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    })
  } catch {
    throw new Error('Kunne ikke kontakte serveren. Kontrollér, at backend kører.')
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new Error('Serveren returnerede et ugyldigt svar.')
  }

  if (!response.ok) {
    if (
      typeof body === 'object'
      && body !== null
      && 'error' in body
      && typeof body.error === 'string'
    ) {
      throw new Error(body.error)
    }
    throw new Error(`Login fejlede (HTTP ${response.status}).`)
  }

  if (!isLoginResponse(body)) {
    throw new Error('Serveren returnerede et ugyldigt login-svar.')
  }

  sessionStorage.setItem(ACCESS_TOKEN_KEY, body.accessToken)
  return body
}

export async function getCurrentUser(): Promise<CurrentUserProfile> {
  const accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY)
  if (!accessToken) {
    throw new UnauthorizedError('Du er ikke logget ind.')
  }

  let response: Response
  try {
    response = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch {
    throw new Error('Kunne ikke kontakte serveren. Kontrollér, at backend kører.')
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new Error('Serveren returnerede et ugyldigt svar.')
  }

  if (response.status === 401) {
    clearAuthSession()
    throw new UnauthorizedError('Dit login er udløbet. Log ind igen.')
  }

  if (!response.ok) {
    if (
      typeof body === 'object'
      && body !== null
      && 'error' in body
      && typeof body.error === 'string'
    ) {
      throw new Error(body.error)
    }
    throw new Error(`Kunne ikke hente profilen (HTTP ${response.status}).`)
  }

  if (
    typeof body !== 'object'
    || body === null
    || !('user' in body)
    || !isCurrentUserProfile(body.user)
  ) {
    throw new Error('Serveren returnerede ugyldige profiloplysninger.')
  }

  return body.user
}
