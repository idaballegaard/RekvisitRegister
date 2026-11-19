import { Router } from 'express'
import { getCurrentAssociation, patchCurrentAssociation } from '../controllers/association.controller.ts'
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

export default associationRouter
