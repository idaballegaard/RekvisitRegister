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

export async function updateCurrentAssociationProp(
  propId: string,
  input: UpdateAssociationPropInput,
): Promise<AssociationProp> {
  const accessToken = sessionStorage.getItem('rekvisit-register.access-token')
  if (!accessToken) {
    throw new UnauthorizedError('Du er ikke logget ind.')
  }

  let response: Response
  try {
    response = await fetch(
      `/api/associations/current/props/${encodeURIComponent(propId)}`,
      {
        method: 'PATCH',
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
