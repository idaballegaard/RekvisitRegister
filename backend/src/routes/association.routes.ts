import { Router, raw } from 'express'
import {
  getCurrentAssociation,
  getCurrentAssociationProps,
  postCurrentAssociationProp,
  patchCurrentAssociationProp,
  deleteCurrentAssociationProp,
  patchCurrentAssociation,
  patchCurrentAssociationStorageLocation,
  deleteCurrentAssociationStorageLocation,
  postCurrentAssociationStorageLocation,
} from '../controllers/association.controller.ts'
import { requireAuthentication, requirePermission } from '../middleware/auth.middleware.ts'
import { PERMISSIONS } from '../models/user.model.ts'
import { deleteImage, getImage, imageErrorHandler, uploadImage } from '../controllers/prop-image.controller.ts'
import {
  deleteCurrentPropReservation,
  getCurrentPropReservations,
  postCurrentPropReservation,
} from '../controllers/reservation.controller.ts'
import {
  getCurrentAssociationUsers,
  postCurrentAssociationUser,
  postCurrentAssociationUserInvitation,
} from '../controllers/association-user.controller.ts'

const associationRouter = Router()

associationRouter.get('/associations/current', requireAuthentication, getCurrentAssociation)
associationRouter.get(
  '/associations/current/users',
  requireAuthentication,
  requirePermission(PERMISSIONS.CREATE_ASSOCIATION_USERS),
  getCurrentAssociationUsers,
)
associationRouter.post(
  '/associations/current/users',
  requireAuthentication,
  requirePermission(PERMISSIONS.CREATE_ASSOCIATION_USERS),
  postCurrentAssociationUser,
)
associationRouter.post(
  '/associations/current/users/:userId/invitation',
  requireAuthentication,
  requirePermission(PERMISSIONS.CREATE_ASSOCIATION_USERS),
  postCurrentAssociationUserInvitation,
)
associationRouter.get(
  '/associations/current/props',
  requireAuthentication,
  requirePermission(PERMISSIONS.SEARCH_PROPS),
  getCurrentAssociationProps,
)
associationRouter.post(
  '/associations/current/props',
  requireAuthentication,
  requirePermission(PERMISSIONS.MANAGE_PROPS),
  postCurrentAssociationProp,
)
associationRouter.post(
  '/associations/current/props/:propId/images',
  requireAuthentication,
  requirePermission(PERMISSIONS.MANAGE_PROPS),
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
  requirePermission(PERMISSIONS.MANAGE_PROPS),
  deleteImage,
  imageErrorHandler,
)
associationRouter.patch(
  '/associations/current/props/:propId',
  requireAuthentication,
  requirePermission(PERMISSIONS.MANAGE_PROPS),
  patchCurrentAssociationProp,
)
associationRouter.delete(
  '/associations/current/props/:propId',
  requireAuthentication,
  requirePermission(PERMISSIONS.MANAGE_PROPS),
  deleteCurrentAssociationProp,
)
associationRouter.get(
  '/associations/current/props/:propId/reservations',
  requireAuthentication,
  requirePermission(PERMISSIONS.MANAGE_PROPS),
  getCurrentPropReservations,
)
associationRouter.post(
  '/associations/current/props/:propId/reservations',
  requireAuthentication,
  requirePermission(PERMISSIONS.MANAGE_PROPS),
  postCurrentPropReservation,
)
associationRouter.delete(
  '/associations/current/props/:propId/reservations/:reservationId',
  requireAuthentication,
  requirePermission(PERMISSIONS.MANAGE_PROPS),
  deleteCurrentPropReservation,
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
