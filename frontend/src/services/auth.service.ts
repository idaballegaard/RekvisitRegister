export interface AuthenticatedUser {
  userId: string
  firstName: string
  lastName: string
  userName: string
  role: 'associationAdmin' | 'propManager' | 'searchUser'
  associationId: string
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
