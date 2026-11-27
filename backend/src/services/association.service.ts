import { ObjectId } from 'mongodb'
import type { AssociationDocument } from '../models/association.model.ts'
import {
  createStorageLocationForAssociation,
  findAssociationById,
  findStorageLocationsByIds,
  removeStorageLocationFromAssociation,
  updateAssociationById,
  updateStorageLocationForAssociation,
} from '../repositories/association.repository.ts'
import { isValidEmail, normalizeEmail } from './user.service.ts'

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

export interface CreateStorageLocationInput {
  address: string
  postalCode: string
  city: string
}

export class AssociationNotFoundError extends Error {}
export class AssociationStorageLocationNotFoundError extends Error {}
export class AssociationStorageLocationsError extends Error {}
export class InvalidAssociationInputError extends Error {}

export function validateCreateStorageLocationInput(input: unknown): CreateStorageLocationInput {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new InvalidAssociationInputError('Lageradressens oplysninger er ugyldige.')
  }

  const { address, postalCode, city } = input as Record<string, unknown>
  if (typeof address !== 'string' || !address.trim() || address.trim().length > 200) {
    throw new InvalidAssociationInputError('Adressen skal udfyldes (maks. 200 tegn).')
  }
  if (typeof postalCode !== 'string' || !postalCode.trim() || postalCode.trim().length > 20) {
    throw new InvalidAssociationInputError('Postnummer skal udfyldes (maks. 20 tegn).')
  }
  if (typeof city !== 'string' || !city.trim() || city.trim().length > 100) {
    throw new InvalidAssociationInputError('By skal udfyldes (maks. 100 tegn).')
  }

  return {
    address: address.trim(),
    postalCode: postalCode.trim(),
    city: city.trim(),
  }
}

export function validateUpdateAssociationInput(input: unknown): UpdateAssociationInput {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new InvalidAssociationInputError('Foreningsoplysningerne er ugyldige.')
  }

  const { name, contactPerson } = input as Record<string, unknown>
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) {
    throw new InvalidAssociationInputError('Foreningens navn skal udfyldes (maks. 120 tegn).')
  }
  if (typeof contactPerson !== 'object' || contactPerson === null || Array.isArray(contactPerson)) {
    throw new InvalidAssociationInputError('Kontaktpersonens oplysninger er ugyldige.')
  }

  const contact = contactPerson as Record<string, unknown>
  if (typeof contact.name !== 'string' || !contact.name.trim() || contact.name.trim().length > 120) {
    throw new InvalidAssociationInputError('Kontaktpersonens navn skal udfyldes (maks. 120 tegn).')
  }
  if (typeof contact.email !== 'string') {
    throw new InvalidAssociationInputError('Kontaktpersonens e-mail skal udfyldes.')
  }
  const email = normalizeEmail(contact.email)
  if (!isValidEmail(email)) {
    throw new InvalidAssociationInputError('Kontaktpersonens e-mailadresse er ugyldig.')
  }
  if (typeof contact.phone !== 'string' || contact.phone.trim().length > 50) {
    throw new InvalidAssociationInputError('Telefonnummeret er ugyldigt (maks. 50 tegn).')
  }

  return {
    name: name.trim(),
    contactPerson: {
      name: contact.name.trim(),
      email,
      phone: contact.phone.trim(),
    },
  }
}

export async function getAssociationProfile(associationId: string): Promise<AssociationProfile> {
  const association = await findAssociation(associationId)
  return toAssociationProfile(association)
}

export async function updateAssociationProfile(
  associationId: string,
  input: UpdateAssociationInput,
): Promise<AssociationProfile> {
  const id = parseAssociationId(associationId)
  const updated = await updateAssociationById(id, input)
  if (!updated) {
    throw new AssociationNotFoundError()
  }
  return getAssociationProfile(associationId)
}

export async function addAssociationStorageLocation(
  associationId: string,
  input: CreateStorageLocationInput,
): Promise<AssociationProfile> {
  const id = parseAssociationId(associationId)
  const created = await createStorageLocationForAssociation(id, input)
  if (!created) {
    throw new AssociationNotFoundError()
  }
  return getAssociationProfile(associationId)
}

export async function editAssociationStorageLocation(
  associationId: string,
  storageLocationId: string,
  input: CreateStorageLocationInput,
): Promise<AssociationProfile> {
  const association = await findAssociation(associationId)
  const locationId = parseStorageLocationId(storageLocationId)
  if (!association.storageLocationIds?.some((id) => id.equals(locationId))) {
    throw new AssociationStorageLocationNotFoundError()
  }
  const updated = await updateStorageLocationForAssociation(association._id, locationId, input)
  if (!updated) {
    throw new AssociationStorageLocationNotFoundError()
  }
  return getAssociationProfile(associationId)
}

export async function deleteAssociationStorageLocation(
  associationId: string,
  storageLocationId: string,
): Promise<AssociationProfile> {
  const association = await findAssociation(associationId)
  const locationId = parseStorageLocationId(storageLocationId)
  const removed = await removeStorageLocationFromAssociation(association._id, locationId)
  if (!removed) {
    throw new AssociationStorageLocationNotFoundError()
  }
  return getAssociationProfile(associationId)
}

async function findAssociation(associationId: string): Promise<AssociationDocument & { _id: ObjectId }> {
  const association = await findAssociationById(parseAssociationId(associationId))
  if (!association) {
    throw new AssociationNotFoundError()
  }
  return association
}

function parseAssociationId(associationId: string): ObjectId {
  if (!/^[a-f\d]{24}$/i.test(associationId)) {
    throw new AssociationNotFoundError()
  }
  return new ObjectId(associationId)
}

function parseStorageLocationId(storageLocationId: string): ObjectId {
  if (!/^[a-f\d]{24}$/i.test(storageLocationId)) {
    throw new AssociationStorageLocationNotFoundError()
  }
  return new ObjectId(storageLocationId)
}

async function toAssociationProfile(
  association: AssociationDocument & { _id: ObjectId },
): Promise<AssociationProfile> {
  const ids = association.storageLocationIds ?? []
  if (!ids.every((id) => id instanceof ObjectId)) {
    throw new AssociationStorageLocationsError('Foreningens lagerreferencer er ugyldige.')
  }
  const storageLocations = await findStorageLocationsByIds(ids)
  const locationsById = new Map(
    storageLocations.map((location) => [location._id.toHexString(), location]),
  )

  const orderedStorageLocations = ids.map((id) => {
    const location = locationsById.get(id.toHexString())
    if (!location) {
      throw new AssociationStorageLocationsError(
        `Lageradressen ${id.toHexString()} findes ikke i storagelocation.`,
      )
    }
    return {
      id: location._id.toHexString(),
      address: location.address,
      postalCode: location.postalCode,
      city: location.city,
    }
  })

  return {
    name: association.name,
    contactPerson: association.contactPerson ?? null,
    storageLocations: orderedStorageLocations,
  }
}
