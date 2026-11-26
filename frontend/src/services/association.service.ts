import { clearAuthSession, UnauthorizedError } from './auth.service'

export interface AssociationContactPerson {
  name: string
  email: string
  phone: string
}

export interface AssociationProfile {
  name: string
  contactPerson: AssociationContactPerson | null
  storageLocations: StorageLocation[]
}

export interface StorageLocation {
  id: string
  address: string
  postalCode: string
  city: string
}

export interface AssociationProp {
  id: string
  name: string
  description: string
  storageLocationId: string
  availability: boolean
  dimensions: {
    height: number
    width: number
    depth: number
    unit: string
  }
  quantity: number
  colour: string
  placement: string
  tags: string[]
  condition: string
  historicalPeriod: string
  imageIds?: string[]
}

export interface AssociationReservation {
  id: string
  propId: string
  startDate: string
  endDate: string
  createdAt: string
}

export interface AssociationLoan {
  id: string
  type: 'loan' | 'lending'
  propName: string
  associationName: string
  startDate: string
  endDate: string
  status: 'Afventer svar' | 'Godkendt' | 'Afvist' | 'Afleveret' | 'Annulleret'
}

export interface AssociationUser {
  id: string
  firstName: string
  lastName: string
  userName: string
  email: string
  role: 'associationAdmin' | 'propManager' | 'searchUser'
  status: 'active' | 'pending' | 'unverified'
  createdAt: string
}

export interface CreateAssociationUserInput {
  firstName: string
  lastName: string
  userName: string
  email: string
  role: 'propManager' | 'searchUser'
}

export type UpdateAssociationPropInput = Omit<AssociationProp, 'id' | 'imageIds'>

export interface UpdateAssociationInput {
  name: string
  contactPerson: AssociationContactPerson
}

export interface CreateStorageLocationInput {
  address: string
  postalCode: string
  city: string
}

function isAssociationContactPerson(value: unknown): value is AssociationContactPerson {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const contactPerson = value as Partial<AssociationContactPerson>
  return typeof contactPerson.name === 'string'
    && typeof contactPerson.email === 'string'
    && typeof contactPerson.phone === 'string'
}

function isAssociationProfile(value: unknown): value is AssociationProfile {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const association = value as Partial<AssociationProfile>
  return typeof association.name === 'string'
    && Array.isArray(association.storageLocations)
    && association.storageLocations.every(isStorageLocation)
    && (
      association.contactPerson === null
      || isAssociationContactPerson(association.contactPerson)
    )
}

function isStorageLocation(value: unknown): value is StorageLocation {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const location = value as Partial<StorageLocation>
  return typeof location.id === 'string'
    && typeof location.address === 'string'
    && typeof location.postalCode === 'string'
    && typeof location.city === 'string'
}

function isAssociationProp(value: unknown): value is AssociationProp {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const prop = value as Partial<AssociationProp>
  const dimensions = prop.dimensions
  return typeof prop.id === 'string'
    && typeof prop.name === 'string'
    && typeof prop.description === 'string'
    && typeof prop.storageLocationId === 'string'
    && typeof prop.availability === 'boolean'
    && typeof dimensions === 'object'
    && dimensions !== null
    && typeof dimensions.height === 'number'
    && Number.isFinite(dimensions.height)
    && typeof dimensions.width === 'number'
    && Number.isFinite(dimensions.width)
    && typeof dimensions.depth === 'number'
    && Number.isFinite(dimensions.depth)
    && typeof dimensions.unit === 'string'
    && typeof prop.quantity === 'number'
    && Number.isFinite(prop.quantity)
    && typeof prop.colour === 'string'
    && typeof prop.placement === 'string'
    && Array.isArray(prop.tags)
    && prop.tags.every((tag) => typeof tag === 'string')
    && typeof prop.condition === 'string'
    && typeof prop.historicalPeriod === 'string'
    && (prop.imageIds === undefined || (
      Array.isArray(prop.imageIds)
      && prop.imageIds.every((id) => typeof id === 'string' && /^[a-f\d]{24}$/.test(id))
    ))
}

function isAssociationReservation(value: unknown): value is AssociationReservation {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const reservation = value as Partial<AssociationReservation>
  return typeof reservation.id === 'string'
    && typeof reservation.propId === 'string'
    && typeof reservation.startDate === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(reservation.startDate)
    && typeof reservation.endDate === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(reservation.endDate)
    && typeof reservation.createdAt === 'string'
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

function isAssociationLoan(value: unknown): value is AssociationLoan {
  if (typeof value !== 'object' || value === null) return false
  const loan = value as Partial<AssociationLoan>
  return typeof loan.id === 'string' && /^[a-f\d]{24}$/i.test(loan.id)
    && (loan.type === 'loan' || loan.type === 'lending')
    && typeof loan.propName === 'string' && loan.propName.trim().length > 0
    && typeof loan.associationName === 'string' && loan.associationName.trim().length > 0
    && isDateOnly(loan.startDate) && isDateOnly(loan.endDate)
    && loan.startDate <= loan.endDate
    && ['Afventer svar', 'Godkendt', 'Afvist', 'Afleveret', 'Annulleret'].includes(loan.status ?? '')
}

export async function getCurrentAssociationLoans(): Promise<AssociationLoan[]> {
  const accessToken = sessionStorage.getItem('rekvisit-register.access-token')
  if (!accessToken) throw new UnauthorizedError('Du er ikke logget ind.')
  let response: Response
  try {
    response = await fetch('/api/associations/current/loans', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch {
    throw new Error('Lån og udlån kunne ikke hentes. Kontrollér forbindelsen, og prøv igen.')
  }
  if (response.status === 401) {
    clearAuthSession()
    throw new UnauthorizedError('Dit login er udløbet. Log ind igen.')
  }
  let body: unknown
  try {
    body = await response.json()
  } catch {
    throw new Error('Lån og udlån kunne ikke hentes. Prøv igen senere.')
  }
  if (!response.ok) {
    if (typeof body === 'object' && body !== null && 'error' in body
      && typeof body.error === 'string') throw new Error(body.error)
    throw new Error(`Lån og udlån kunne ikke hentes (HTTP ${response.status}).`)
  }
  if (typeof body !== 'object' || body === null || !('loans' in body)
    || !Array.isArray(body.loans) || !body.loans.every(isAssociationLoan)) {
    throw new Error('Lån og udlån kunne ikke indlæses. Kontakt teknisk support.')
  }
  return body.loans
}

function isAssociationUser(value: unknown): value is AssociationUser {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const user = value as Partial<AssociationUser>
  return typeof user.id === 'string'
    && typeof user.firstName === 'string'
    && typeof user.lastName === 'string'
    && typeof user.userName === 'string'
    && typeof user.email === 'string'
    && ['associationAdmin', 'propManager', 'searchUser'].includes(user.role ?? '')
    && ['active', 'pending', 'unverified'].includes(user.status ?? '')
    && typeof user.createdAt === 'string'
    && Number.isFinite(Date.parse(user.createdAt))
}

async function requestAssociationUsers(
  method: 'GET' | 'POST',
  input?: CreateAssociationUserInput,
  userId?: string,
): Promise<unknown> {
  const accessToken = sessionStorage.getItem('rekvisit-register.access-token')
  if (!accessToken) throw new UnauthorizedError('Du er ikke logget ind.')

  let response: Response
  try {
    const endpoint = userId
      ? `/api/associations/current/users/${encodeURIComponent(userId)}/invitation`
      : '/api/associations/current/users'
    response = await fetch(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(input ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(input ? { body: JSON.stringify(input) } : {}),
    })
  } catch {
    throw new Error('Kunne ikke kontakte serveren. Kontrollér, at backend kører.')
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    if (method === 'GET') {
      throw new Error('Brugerlisten kunne ikke indlæses. Prøv igen senere.')
    }
    if (userId) {
      throw new Error('Invitationen kunne ikke sendes igen. Prøv igen senere.')
    }
    throw new Error(
      'Brugeroprettelsen kunne ikke gennemføres på grund af en teknisk fejl. '
      + 'Kontrollér, om brugeren allerede står på listen, før du prøver igen.',
    )
  }
  if (response.status === 401) {
    clearAuthSession()
    throw new UnauthorizedError('Dit login er udløbet. Log ind igen.')
  }
  if (!response.ok) {
    if (typeof body === 'object' && body !== null && 'error' in body
      && typeof body.error === 'string') {
      throw new Error(body.error)
    }
    throw new Error(`Brugerne kunne ikke behandles (HTTP ${response.status}).`)
  }
  return body
}

export async function getCurrentAssociationUsers(): Promise<AssociationUser[]> {
  const body = await requestAssociationUsers('GET')
  if (typeof body !== 'object' || body === null || !('users' in body)
    || !Array.isArray(body.users) || !body.users.every(isAssociationUser)) {
    throw new Error('Serveren returnerede ugyldige brugeroplysninger.')
  }
  return body.users
}

export async function createCurrentAssociationUser(
  input: CreateAssociationUserInput,
): Promise<AssociationUser> {
  const body = await requestAssociationUsers('POST', input)
  if (typeof body !== 'object' || body === null || !('user' in body)
    || !isAssociationUser(body.user) || !('message' in body)
    || body.message !== 'Brugeren er oprettet, og en invitation er sendt.') {
    throw new Error('Serveren returnerede ugyldige brugeroplysninger.')
  }
  return body.user
}

export async function resendCurrentAssociationUserInvitation(userId: string): Promise<void> {
  const body = await requestAssociationUsers('POST', undefined, userId)
  if (typeof body !== 'object' || body === null || !('message' in body)
    || body.message !== 'Invitationen er sendt igen.') {
    throw new Error('Serveren returnerede et ugyldigt invitationssvar.')
  }
}

async function imageRequest(
  propId: string,
  method: 'GET' | 'POST' | 'DELETE',
  imageId?: string,
  file?: File,
): Promise<Response> {
  const accessToken = sessionStorage.getItem('rekvisit-register.access-token')
  if (!accessToken) throw new UnauthorizedError('Du er ikke logget ind.')
  const path = `/api/associations/current/props/${encodeURIComponent(propId)}/images`
  let response: Response
  try {
    response = await fetch(imageId ? `${path}/${encodeURIComponent(imageId)}` : path, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(file ? { 'Content-Type': file.type } : {}),
      },
      ...(file ? { body: file } : {}),
    })
  } catch {
    throw new Error('Kunne ikke kontakte serveren. Kontrollér, at backend kører.')
  }
  if (response.status === 401) {
    clearAuthSession()
    throw new UnauthorizedError('Dit login er udløbet. Log ind igen.')
  }
  if (!response.ok) {
    let message = `Billedet kunne ikke behandles (HTTP ${response.status}).`
    try {
      const body: unknown = await response.json()
      if (typeof body === 'object' && body !== null && 'error' in body
        && typeof body.error === 'string') {
        message = body.error
      }
    } catch {
      // Some server errors do not have a JSON response.
    }
    throw new Error(message)
  }
  return response
}

export async function uploadPropImage(propId: string, file: File): Promise<string> {
  const response = await imageRequest(propId, 'POST', undefined, file)
  const body: unknown = await response.json()
  if (typeof body !== 'object' || body === null || !('imageId' in body)
    || typeof body.imageId !== 'string' || !/^[a-f\d]{24}$/.test(body.imageId)) {
    throw new Error('Serveren returnerede et ugyldigt billed-id.')
  }
  return body.imageId
}

export async function getPropImage(propId: string, imageId: string): Promise<Blob> {
  const response = await imageRequest(propId, 'GET', imageId)
  return response.blob()
}

export async function deletePropImage(propId: string, imageId: string): Promise<void> {
  await imageRequest(propId, 'DELETE', imageId)
}

export async function deleteCurrentAssociationProp(propId: string): Promise<void> {
  const accessToken = sessionStorage.getItem('rekvisit-register.access-token')
  if (!accessToken) {
    throw new UnauthorizedError('Du er ikke logget ind.')
  }

  let response: Response
  try {
    response = await fetch(`/api/associations/current/props/${encodeURIComponent(propId)}`, {
      method: 'DELETE',
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
    if (typeof body === 'object' && body !== null && 'error' in body
      && typeof body.error === 'string') {
      throw new Error(body.error)
    }
    throw new Error(`Rekvisitten kunne ikke slettes (HTTP ${response.status}).`)
  }
  if (typeof body !== 'object' || body === null || !('message' in body)
    || body.message !== 'Rekvisitten er slettet.') {
    throw new Error('Serveren returnerede et ugyldigt svar.')
  }
}

async function requestAssociation(
  method: 'GET' | 'PATCH' | 'POST' | 'DELETE',
  input?: UpdateAssociationInput | CreateStorageLocationInput,
  locationId?: string,
): Promise<AssociationProfile> {
  const accessToken = sessionStorage.getItem('rekvisit-register.access-token')
  if (!accessToken) {
    throw new UnauthorizedError('Du er ikke logget ind.')
  }

  const endpoint = locationId
    ? `/api/associations/current/storage-locations/${encodeURIComponent(locationId)}`
    : method === 'POST'
      ? '/api/associations/current/storage-locations'
      : '/api/associations/current'
  let response: Response
  try {
    response = await fetch(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(input ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(input ? { body: JSON.stringify(input) } : {}),
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
    throw new Error(`Foreningsoplysningerne kunne ikke behandles (HTTP ${response.status}).`)
  }
  if (
    typeof body !== 'object'
    || body === null
    || !('association' in body)
    || !isAssociationProfile(body.association)
  ) {
    throw new Error('Serveren returnerede ugyldige foreningsoplysninger.')
  }

  return body.association
}

export function getCurrentAssociation(): Promise<AssociationProfile> {
  return requestAssociation('GET')
}

export async function getCurrentAssociationProps(): Promise<AssociationProp[]> {
  const accessToken = sessionStorage.getItem('rekvisit-register.access-token')
  if (!accessToken) {
    throw new UnauthorizedError('Du er ikke logget ind.')
  }

  let response: Response
  try {
    response = await fetch('/api/associations/current/props', {
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
    throw new Error(`Rekvisitterne kunne ikke hentes (HTTP ${response.status}).`)
  }
  if (
    typeof body !== 'object'
    || body === null
    || !('props' in body)
    || !Array.isArray(body.props)
    || !body.props.every(isAssociationProp)
  ) {
    throw new Error('Serveren returnerede ugyldige rekvisitoplysninger.')
  }

  return body.props
}

export async function getCurrentPropReservations(propId: string): Promise<AssociationReservation[]> {
  const body = await requestPropReservations(propId, 'GET')
  if (typeof body !== 'object' || body === null || !('reservations' in body)
    || !Array.isArray(body.reservations) || !body.reservations.every(isAssociationReservation)) {
    throw new Error('Serveren returnerede ugyldige reservationsoplysninger.')
  }
  return body.reservations
}

export async function createCurrentPropReservation(
  propId: string,
  dates: { startDate: string; endDate: string },
): Promise<AssociationReservation> {
  const body = await requestPropReservations(propId, 'POST', dates)
  if (typeof body !== 'object' || body === null || !('reservation' in body)
    || !isAssociationReservation(body.reservation)) {
    throw new Error('Serveren returnerede ugyldige reservationsoplysninger.')
  }
  return body.reservation
}

export async function deleteCurrentPropReservation(
  propId: string,
  reservationId: string,
): Promise<void> {
  const body = await requestPropReservations(propId, 'DELETE', undefined, reservationId)
  if (typeof body !== 'object' || body === null || !('message' in body)
    || body.message !== 'Reservationen er fjernet.') {
    throw new Error('Serveren returnerede et ugyldigt svar.')
  }
}

async function requestPropReservations(
  propId: string,
  method: 'GET' | 'POST' | 'DELETE',
  dates?: { startDate: string; endDate: string },
  reservationId?: string,
): Promise<unknown> {
  const accessToken = sessionStorage.getItem('rekvisit-register.access-token')
  if (!accessToken) {
    throw new UnauthorizedError('Du er ikke logget ind.')
  }
  const path = `/api/associations/current/props/${encodeURIComponent(propId)}/reservations`
  const endpoint = reservationId ? `${path}/${encodeURIComponent(reservationId)}` : path
  let response: Response
  try {
    response = await fetch(endpoint, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(dates ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(dates ? { body: JSON.stringify(dates) } : {}),
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
    if (typeof body === 'object' && body !== null && 'error' in body
      && typeof body.error === 'string') {
      throw new Error(body.error)
    }
    throw new Error(`Reservationen kunne ikke behandles (HTTP ${response.status}).`)
  }
  return body
}

export async function updateCurrentAssociationProp(
  propId: string,
  input: UpdateAssociationPropInput,
): Promise<AssociationProp> {
  return saveCurrentAssociationProp('PATCH', input, propId)
}

export async function createCurrentAssociationProp(
  input: UpdateAssociationPropInput,
): Promise<AssociationProp> {
  return saveCurrentAssociationProp('POST', input)
}

async function saveCurrentAssociationProp(
  method: 'POST' | 'PATCH',
  input: UpdateAssociationPropInput,
  propId?: string,
): Promise<AssociationProp> {
  const accessToken = sessionStorage.getItem('rekvisit-register.access-token')
  if (!accessToken) {
    throw new UnauthorizedError('Du er ikke logget ind.')
  }

  let response: Response
  try {
    response = await fetch(
      propId
        ? `/api/associations/current/props/${encodeURIComponent(propId)}`
        : '/api/associations/current/props',
      {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      },
    )
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
    throw new Error(`Rekvisitten kunne ikke gemmes (HTTP ${response.status}).`)
  }
  if (
    typeof body !== 'object'
    || body === null
    || !('prop' in body)
    || !isAssociationProp(body.prop)
  ) {
    throw new Error('Serveren returnerede ugyldige rekvisitoplysninger.')
  }

  return body.prop
}

export function updateCurrentAssociation(
  input: UpdateAssociationInput,
): Promise<AssociationProfile> {
  return requestAssociation('PATCH', input)
}

export function createAssociationStorageLocation(
  input: CreateStorageLocationInput,
): Promise<AssociationProfile> {
  return requestAssociation('POST', input)
}

export function updateAssociationStorageLocation(
  locationId: string,
  input: CreateStorageLocationInput,
): Promise<AssociationProfile> {
  return requestAssociation('PATCH', input, locationId)
}

export function deleteAssociationStorageLocation(locationId: string): Promise<AssociationProfile> {
  return requestAssociation('DELETE', undefined, locationId)
}
