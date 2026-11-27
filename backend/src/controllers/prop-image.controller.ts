import type { ErrorRequestHandler, RequestHandler } from 'express'
import { getAuthenticatedUser } from '../middleware/auth.middleware.ts'
import {
  deletePropImage,
  ImageInputError,
  ImageLimitError,
  ImageNotFoundError,
  readPropImage,
  uploadPropImage,
} from '../services/prop-image.service.ts'

function routeParam(value: string | string[] | undefined): string {
  return typeof value === 'string' ? value : ''
}

export const uploadImage: RequestHandler = async (request, response, next) => {
  try {
    const imageId = await uploadPropImage(
      getAuthenticatedUser(request).associationId,
      routeParam(request.params.propId),
      request.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? '',
      request.body,
    )
    response.status(201).json({ imageId })
  } catch (error) {
    next(error)
  }
}

export const getImage: RequestHandler = async (request, response, next) => {
  try {
    const image = await readPropImage(
      getAuthenticatedUser(request).associationId,
      routeParam(request.params.propId),
      routeParam(request.params.imageId),
    )
    response.set({
      'Content-Type': 'image/webp',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    }).send(image)
  } catch (error) {
    next(error)
  }
}

export const deleteImage: RequestHandler = async (request, response, next) => {
  try {
    await deletePropImage(
      getAuthenticatedUser(request).associationId,
      routeParam(request.params.propId),
      routeParam(request.params.imageId),
    )
    response.json({ message: 'Billedet er fjernet.' })
  } catch (error) {
    next(error)
  }
}

export const imageErrorHandler: ErrorRequestHandler = (error: unknown, _request, response, next) => {
  if (error instanceof ImageNotFoundError) {
    response.status(404).json({ error: 'Billedet eller rekvisitten blev ikke fundet.' })
  } else if (error instanceof ImageInputError || error instanceof ImageLimitError) {
    response.status(400).json({ error: error.message })
  } else if (
    typeof error === 'object' && error !== null && 'type' in error
    && error.type === 'entity.too.large'
  ) {
    response.status(413).json({ error: 'Billedet må højst være 5 MB.' })
  } else {
    next(error)
  }
}
