import { readonly, ref } from 'vue'

export interface AuthenticatedUser {
  userId: string
  firstName: string
  lastName: string
  userName: string
  role: 'associationAdmin' | 'propManager' | 'searchUser'
  associationId: string
}

export interface CurrentUserProfile extends AuthenticatedUser {
  email: string
  emailVerified: boolean
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

interface ChangePasswordCredentials {
  currentPassword: string
  newPassword: string
}

interface ResetPasswordCredentials {
  token: string
  newPassword: string
}

interface AcceptInvitationCredentials {
  token: string
  newPassword: string
}

const ACCESS_TOKEN_KEY = 'rekvisit-register.access-token'
const userRole = ref<CurrentUserProfile['role'] | null>(null)

export const currentUserRole = readonly(userRole)

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
    && 'email' in value
    && typeof value.email === 'string'
    && 'emailVerified' in value
    && typeof value.emailVerified === 'boolean'
    && 'associationName' in value
    && typeof value.associationName === 'string'
}

export function hasAccessToken(): boolean {
  return Boolean(sessionStorage.getItem(ACCESS_TOKEN_KEY))
}

export function clearAuthSession(): void {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  userRole.value = null
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
  userRole.value = body.user.role
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

  if (sessionStorage.getItem(ACCESS_TOKEN_KEY) === accessToken) {
    userRole.value = body.user.role
  }
  return body.user
}

export async function changePassword(credentials: ChangePasswordCredentials): Promise<void> {
  const accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY)
  if (!accessToken) {
    throw new UnauthorizedError('Du er ikke logget ind.')
  }

  let response: Response
  try {
    response = await fetch('/api/auth/password', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
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
    throw new Error(`Adgangskoden kunne ikke opdateres (HTTP ${response.status}).`)
  }

  if (
    typeof body !== 'object'
    || body === null
    || !('message' in body)
    || typeof body.message !== 'string'
  ) {
    throw new Error('Serveren returnerede et ugyldigt svar.')
  }
}

export async function updateProfile(email: string): Promise<{ emailVerified: boolean }> {
  const accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY)
  if (!accessToken) {
    throw new UnauthorizedError('Du er ikke logget ind.')
  }

  let response: Response
  try {
    response = await fetch('/api/auth/profile', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
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
    throw new Error(`E-mailadressen kunne ikke opdateres (HTTP ${response.status}).`)
  }

  if (
    typeof body !== 'object'
    || body === null
    || !('message' in body)
    || typeof body.message !== 'string'
    || !('emailVerified' in body)
    || typeof body.emailVerified !== 'boolean'
  ) {
    throw new Error('Serveren returnerede et ugyldigt svar.')
  }
  return { emailVerified: body.emailVerified }
}

export async function requestEmailVerification(): Promise<void> {
  const accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY)
  if (!accessToken) {
    throw new UnauthorizedError('Du er ikke logget ind.')
  }

  let response: Response
  try {
    response = await fetch('/api/auth/email-verification', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch {
    throw new Error('Kunne ikke kontakte serveren. Kontrollér, at backend kører.')
  }

  const body: unknown = await parseResponseBody(response)
  if (response.status === 401) {
    clearAuthSession()
    throw new UnauthorizedError('Dit login er udløbet. Log ind igen.')
  }
  if (!response.ok) {
    throw responseError(body, `Bekræftelsesmailen kunne ikke sendes (HTTP ${response.status}).`)
  }
  requireResponseMessage(body)
}

export async function confirmEmail(token: string): Promise<void> {
  let response: Response
  try {
    response = await fetch('/api/auth/confirm-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
  } catch {
    throw new Error('Kunne ikke kontakte serveren. Kontrollér, at backend kører.')
  }

  const body: unknown = await parseResponseBody(response)
  if (!response.ok) {
    throw responseError(body, `E-mailadressen kunne ikke bekræftes (HTTP ${response.status}).`)
  }
  requireResponseMessage(body)
}

export async function requestPasswordReset(email: string): Promise<void> {
  let response: Response
  try {
    response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
  } catch {
    throw new Error('Kunne ikke kontakte serveren. Kontrollér, at backend kører.')
  }

  const body: unknown = await parseResponseBody(response)
  if (!response.ok) {
    throw responseError(body, `Anmodningen fejlede (HTTP ${response.status}).`)
  }
  requireResponseMessage(body)
}

export async function resetPassword(credentials: ResetPasswordCredentials): Promise<void> {
  let response: Response
  try {
    response = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    })
  } catch {
    throw new Error('Kunne ikke kontakte serveren. Kontrollér, at backend kører.')
  }

  const body: unknown = await parseResponseBody(response)
  if (!response.ok) {
    throw responseError(body, `Adgangskoden kunne ikke nulstilles (HTTP ${response.status}).`)
  }
  requireResponseMessage(body)
}

export async function acceptInvitation(
  credentials: AcceptInvitationCredentials,
): Promise<void> {
  let response: Response
  try {
    response = await fetch('/api/auth/accept-invitation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    })
  } catch {
    throw new Error('Kunne ikke kontakte serveren. Kontrollér, at backend kører.')
  }
  const body: unknown = await parseResponseBody(response)
  if (!response.ok) {
    throw responseError(body, `Kontoen kunne ikke aktiveres (HTTP ${response.status}).`)
  }
  requireResponseMessage(body)
}

async function parseResponseBody(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new Error('Serveren returnerede et ugyldigt svar.')
  }
}

function responseError(body: unknown, fallbackMessage: string): Error {
  if (
    typeof body === 'object'
    && body !== null
    && 'error' in body
    && typeof body.error === 'string'
  ) {
    return new Error(body.error)
  }
  return new Error(fallbackMessage)
}

function requireResponseMessage(body: unknown): void {
  if (
    typeof body !== 'object'
    || body === null
    || !('message' in body)
    || typeof body.message !== 'string'
  ) {
    throw new Error('Serveren returnerede et ugyldigt svar.')
  }
}
