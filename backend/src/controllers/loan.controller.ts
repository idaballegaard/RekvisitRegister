import type { RequestHandler } from 'express'
import { getAuthenticatedUser } from '../middleware/auth.middleware.ts'
import { AssociationLoansError, getAssociationLoans } from '../services/loan.service.ts'

export const getCurrentAssociationLoans: RequestHandler = async (request, response, next) => {
  try {
    const loans = await getAssociationLoans(getAuthenticatedUser(request).associationId)
    response.json({ loans })
  } catch (error) {
    if (error instanceof AssociationLoansError) {
      response.status(500).json({ error: error.message })
      return
    }
    next(error)
  }
}
