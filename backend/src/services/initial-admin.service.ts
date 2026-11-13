import { withTransaction } from '../config/database.ts'
import type { AssociationDocument } from '../models/association.model.ts'
import { ROLES, type UserDocument } from '../models/user.model.ts'
import { createAssociation, countAssociations } from '../repositories/association.repository.ts'
import { countUsers, createUser } from '../repositories/user.repository.ts'
import type { InitialAdminInput } from '../models/user.model.ts'
import { hashPassword, validateInitialAdminInput } from './user.service.ts'

export async function createInitialAdmin(input: InitialAdminInput): Promise<{
  associationName: string
  userName: string
}> {
  const validatedInput = validateInitialAdminInput(input)
  const passwordHash = await hashPassword(validatedInput.password)

  return withTransaction(async (_database, session) => {
    const existingUsers = await countUsers(session)
    const existingAssociations = await countAssociations(session)
    if (existingUsers > 0 || existingAssociations > 0) {
      throw new Error('Bootstrap stoppet: der findes allerede brugere eller foreninger i databasen')
    }

    const now = new Date()
    const association: AssociationDocument = {
      name: validatedInput.associationName,
      createdAt: now,
      updatedAt: now,
    }
    const associationId = await createAssociation(association, session)

    const user: UserDocument = {
      firstName: validatedInput.firstName,
      lastName: validatedInput.lastName,
      userName: validatedInput.userName,
      email: validatedInput.email,
      passwordHash,
      role: ROLES.ASSOCIATION_ADMIN,
      associationId,
      createdAt: now,
      updatedAt: now,
    }
    await createUser(user, session)

    return { associationName: association.name, userName: user.userName }
  })
}