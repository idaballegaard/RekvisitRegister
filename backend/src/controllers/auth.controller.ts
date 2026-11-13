import type { RequestHandler } from 'express'
import { ObjectId } from 'mongodb'
import { findAssociationById } from '../repositories/association.repository.ts'
import { findUserById } from '../repositories/user.repository.ts'
import { ACCESS_TOKEN_TTL_SECONDS } from '../services/access-token.service.ts'
import { isValidEmail } from '../services/user.service.ts'
import {
  changePassword,
  EmailAlreadyInUseError,
  IncorrectCurrentPasswordError,
  InvalidProfileInputError,
  InvalidPasswordChangeInputError,
  InvalidLoginInputError,
  login,
  PasswordChangeConflictError,
  PasswordChangeUserNotFoundError,
  ProfileUserNotFoundError,
  type ChangePasswordInput,
  type LoginInput,
  type UpdateProfileInput,
  updateProfile,
  validateLoginInput,
  validateChangePasswordInput,
  validateUpdateProfileInput,
} from '../services/auth.service.ts'
import { getAuthenticatedUser } from '../middleware/auth.middleware.ts'

export const postLogin: RequestHandler = async (request, response, next) => {
  let input: LoginInput
  try {
    input = validateLoginInput(request.body)
  } catch (error) {
    if (error instanceof InvalidLoginInputError) {
      response.status(400).json({ error: error.message })
      return
    }
    next(error)
    return
  }

  try {
    const result = await login(input)
    if (!result) {
      response.status(401).json({ error: 'Brugernavn eller adgangskode er forkert' })
      return
    }

    response.json({
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      accessToken: result.accessToken,
      user: result.user,
    })
  } catch (error) {
    next(error)
  }
}

export const getCurrentUser: RequestHandler = async (request, response) => {
  const authenticatedUser = getAuthenticatedUser(request)
  const user = await findUserById(new ObjectId(authenticatedUser.userId))
  if (!user) {
    response.status(404).json({ error: 'Brugeren blev ikke fundet.' })
    return
  }
  if (!(user.associationId instanceof ObjectId)) {
    throw new Error('Brugerens foreningsreference er ugyldig')
  }
  if (typeof user.email !== 'string' || !isValidEmail(user.email)) {
    throw new Error('Brugerens e-mail mangler eller er ugyldig')
  }

  const association = await findAssociationById(user.associationId)
  if (!association) {
    response.status(404).json({ error: 'Brugerens forening blev ikke fundet' })
    return
  }

  response.json({
    user: {
      userId: user._id.toHexString(),
      firstName: user.firstName,
      lastName: user.lastName,
      userName: user.userName,
      email: user.email,
      role: user.role,
      associationId: user.associationId.toHexString(),
      associationName: association.name,
    },
  })
}

export const patchProfile: RequestHandler = async (request, response, next) => {
  let input: UpdateProfileInput
  try {
    input = validateUpdateProfileInput(request.body)
  } catch (error) {
    if (error instanceof InvalidProfileInputError) {
      response.status(400).json({ error: error.message })
      return
    }
    next(error)
    return
  }

  try {
    const user = getAuthenticatedUser(request)
    await updateProfile(user.userId, input)
    response.json({ message: 'E-mailadressen er opdateret.' })
  } catch (error) {
    if (error instanceof EmailAlreadyInUseError) {
      response.status(409).json({ error: 'E-mailadressen er allerede knyttet til en anden bruger.' })
      return
    }
    if (error instanceof ProfileUserNotFoundError) {
      response.status(404).json({ error: 'Brugeren blev ikke fundet.' })
      return
    }
    next(error)
  }
}

export const patchPassword: RequestHandler = async (request, response, next) => {
  let input: ChangePasswordInput
  try {
    input = validateChangePasswordInput(request.body)
  } catch (error) {
    if (error instanceof InvalidPasswordChangeInputError) {
      response.status(400).json({ error: error.message })
      return
    }
    next(error)
    return
  }

  try {
    const user = getAuthenticatedUser(request)
    await changePassword(user.userId, input)
    response.json({ message: 'Adgangskoden er opdateret.' })
  } catch (error) {
    if (error instanceof InvalidPasswordChangeInputError) {
      response.status(400).json({ error: error.message })
      return
    }
    if (error instanceof IncorrectCurrentPasswordError) {
      response.status(400).json({ error: 'Den nuværende adgangskode er forkert.' })
      return
    }
    if (error instanceof PasswordChangeUserNotFoundError) {
      response.status(404).json({ error: 'Brugeren blev ikke fundet.' })
      return
    }
    if (error instanceof PasswordChangeConflictError) {
      response.status(409).json({
        error: 'Adgangskoden blev ændret samtidig. Prøv igen.',
      })
      return
    }
    next(error)
  }
}
