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

export interface UpdateAssociationInput {
  name: string
  contactPerson: AssociationContactPerson
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

async function requestAssociation(
  method: 'GET' | 'PATCH',
  input?: UpdateAssociationInput,
): Promise<AssociationProfile> {
  const accessToken = sessionStorage.getItem('rekvisit-register.access-token')
  if (!accessToken) {
    throw new UnauthorizedError('Du er ikke logget ind.')
  }

  let response: Response
  try {
    response = await fetch('/api/associations/current', {
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
    throw new Error(`Foreningsoplysningerne kunne ikke hentes (HTTP ${response.status}).`)
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

export function updateCurrentAssociation(
  input: UpdateAssociationInput,
): Promise<AssociationProfile> {
  return requestAssociation('PATCH', input)
}
