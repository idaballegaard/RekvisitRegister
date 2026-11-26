import type { RequestHandler } from 'express'
import { getAuthenticatedUser } from '../middleware/auth.middleware.ts'
import {
  AssociationLoanNotFoundError,
  AssociationLoansError,
  getAssociationLoan,
  getAssociationLoans,
} from '../services/loan.service.ts'

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

export const getCurrentAssociationLoan: RequestHandler = async (request, response, next) => {
  try {
    const loan = await getAssociationLoan(getAuthenticatedUser(request).associationId, String(request.params.loanId))
    response.json({ loan })
  } catch (error) {
    if (error instanceof AssociationLoanNotFoundError) {
      response.status(404).json({ error: error.message })
      return
    }
    if (error instanceof AssociationLoansError) {
      response.status(500).json({ error: error.message })
      return
    }
    next(error)
  }
}
