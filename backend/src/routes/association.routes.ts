import { Router } from 'express'
import {
  getCurrentAssociation,
  patchCurrentAssociation,
  patchCurrentAssociationStorageLocation,
  deleteCurrentAssociationStorageLocation,
  postCurrentAssociationStorageLocation,
} from '../controllers/association.controller.ts'
import { requireAuthentication, requirePermission } from '../middleware/auth.middleware.ts'
import { PERMISSIONS } from '../models/user.model.ts'

const associationRouter = Router()

associationRouter.get('/associations/current', requireAuthentication, getCurrentAssociation)
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
