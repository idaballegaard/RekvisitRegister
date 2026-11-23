import { Router, raw } from 'express'
import {
  getCurrentAssociation,
  getCurrentAssociationProps,
  postCurrentAssociationProp,
  patchCurrentAssociationProp,
  patchCurrentAssociation,
  patchCurrentAssociationStorageLocation,
  deleteCurrentAssociationStorageLocation,
  postCurrentAssociationStorageLocation,
} from '../controllers/association.controller.ts'
import { requireAuthentication, requirePermission } from '../middleware/auth.middleware.ts'
import { PERMISSIONS } from '../models/user.model.ts'
import { deleteImage, getImage, imageErrorHandler, uploadImage } from '../controllers/prop-image.controller.ts'

const associationRouter = Router()

associationRouter.get('/associations/current', requireAuthentication, getCurrentAssociation)
associationRouter.get(
  '/associations/current/props',
  requireAuthentication,
  requirePermission(PERMISSIONS.SEARCH_PROPS),
  getCurrentAssociationProps,
)
associationRouter.post(
  '/associations/current/props',
  requireAuthentication,
  requirePermission(PERMISSIONS.UPDATE_ASSOCIATION),
  postCurrentAssociationProp,
)
associationRouter.post(
  '/associations/current/props/:propId/images',
  requireAuthentication,
  requirePermission(PERMISSIONS.UPDATE_ASSOCIATION),
  raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: 5 * 1024 * 1024 }),
  uploadImage,
  imageErrorHandler,
)
associationRouter.get(
  '/associations/current/props/:propId/images/:imageId',
  requireAuthentication,
  requirePermission(PERMISSIONS.SEARCH_PROPS),
  getImage,
  imageErrorHandler,
)
associationRouter.delete(
  '/associations/current/props/:propId/images/:imageId',
  requireAuthentication,
  requirePermission(PERMISSIONS.UPDATE_ASSOCIATION),
  deleteImage,
  imageErrorHandler,
)
associationRouter.patch(
  '/associations/current/props/:propId',
  requireAuthentication,
  requirePermission(PERMISSIONS.UPDATE_ASSOCIATION),
  patchCurrentAssociationProp,
)
associationRouter.patch(
  '/associations/current',
  requireAuthentication,
  requirePermission(PERMISSIONS.UPDATE_ASSOCIATION),
  patchCurrentAssociation,
)
associationRouter.post(
  '/associations/current/storage-locations',
  requireAuthentication,
  requirePermission(PERMISSIONS.UPDATE_ASSOCIATION),
  postCurrentAssociationStorageLocation,
)
associationRouter.patch(
  '/associations/current/storage-locations/:locationId',
  requireAuthentication,
  requirePermission(PERMISSIONS.UPDATE_ASSOCIATION),
  patchCurrentAssociationStorageLocation,
)
associationRouter.delete(
  '/associations/current/storage-locations/:locationId',
  requireAuthentication,
  requirePermission(PERMISSIONS.UPDATE_ASSOCIATION),
  deleteCurrentAssociationStorageLocation,
)

export default associationRouter
