import { ObjectId, type WithId } from 'mongodb'
import { withTransaction } from '../config/database.ts'
import { LOAN_STATUSES, type AssociationLoan, type AssociationLoanDetail, type LoanDocument } from '../models/loan.model.ts'
import { findLoanForAssociation, findLoanReferences, findLoansForAssociation, findOverlappingApprovedLoan } from '../repositories/loan.repository.ts'
import { findOverlappingReservation, lockPropForLoan } from '../repositories/reservation.repository.ts'

export class AssociationLoansError extends Error {}
export class AssociationLoanNotFoundError extends Error {}
export class InvalidLoanDecisionError extends Error {}
export class LoanDecisionConflictError extends Error {}

export type LoanDecision = 'Godkendt' | 'Afvist'

export function validateLoanDecision(input: unknown): LoanDecision {
  if (typeof input !== 'object' || input === null || Array.isArray(input)
    || !('status' in input) || (input.status !== 'Godkendt' && input.status !== 'Afvist')) {
    throw new InvalidLoanDecisionError('Vælg en gyldig afgørelse for lånet.')
  }
  return input.status
}

function isValidLoan(loan: WithId<LoanDocument>): boolean {
  return loan._id instanceof ObjectId
    && loan.propId instanceof ObjectId
    && loan.ownerAssociationId instanceof ObjectId
    && loan.borrowerAssociationId instanceof ObjectId
    && !loan.ownerAssociationId.equals(loan.borrowerAssociationId)
    && loan.startDate instanceof Date && Number.isFinite(loan.startDate.getTime())
    && loan.endDate instanceof Date && Number.isFinite(loan.endDate.getTime())
    && loan.startDate <= loan.endDate
    && /^\d{4}-/.test(loan.startDate.toISOString())
    && /^\d{4}-/.test(loan.endDate.toISOString())
    && LOAN_STATUSES.includes(loan.status)
}

function parseAssociationId(associationId: string): ObjectId {
  if (!/^[a-f\d]{24}$/i.test(associationId)) {
    throw new AssociationLoansError('Forenings-id’et er ugyldigt.')
  }
  return new ObjectId(associationId)
}

async function mapAssociationLoans(
  loans: WithId<LoanDocument>[],
  id: ObjectId,
): Promise<AssociationLoan[]> {
  if (!loans.every(isValidLoan)) {
    throw new AssociationLoansError('Et eller flere lån indeholder ugyldige oplysninger.')
  }
  const { props, associations } = await findLoanReferences(
    loans.map((loan) => loan.propId),
    loans.map((loan) => loan.ownerAssociationId.equals(id)
      ? loan.borrowerAssociationId
      : loan.ownerAssociationId),
  )
  const propsById = new Map(props.map((prop) => [prop._id.toHexString(), prop]))
  const associationsById = new Map(associations.map((association) => [
    association._id.toHexString(), association,
  ]))

  return loans.map((loan) => {
    const isOwner = loan.ownerAssociationId.equals(id)
    const prop = propsById.get(loan.propId.toHexString())
    const otherAssociation = associationsById.get(
      (isOwner ? loan.borrowerAssociationId : loan.ownerAssociationId).toHexString(),
    )
    if (!prop || typeof prop.name !== 'string' || !prop.name.trim()
      || !(prop.associationId instanceof ObjectId)
      || !prop.associationId.equals(loan.ownerAssociationId)
      || !otherAssociation || typeof otherAssociation.name !== 'string'
      || !otherAssociation.name.trim()) {
      throw new AssociationLoansError('En rekvisit eller forening tilknyttet et lån kunne ikke findes.')
    }
    return {
      id: loan._id.toHexString(),
      type: isOwner ? 'lending' : 'loan',
      propName: prop.name,
      associationName: otherAssociation.name,
      startDate: loan.startDate.toISOString().slice(0, 10),
      endDate: loan.endDate.toISOString().slice(0, 10),
      status: loan.status,
    }
  })
}

export async function getAssociationLoans(associationId: string): Promise<AssociationLoan[]> {
  const id = parseAssociationId(associationId)
  return mapAssociationLoans(await findLoansForAssociation(id), id)
}

export async function getAssociationLoan(associationId: string, loanId: string): Promise<AssociationLoanDetail> {
  const id = parseAssociationId(associationId)
  if (!/^[a-f\d]{24}$/i.test(loanId)) {
    throw new AssociationLoanNotFoundError('Lånet blev ikke fundet.')
  }
  const loan = await findLoanForAssociation(new ObjectId(loanId), id)
  if (!loan) throw new AssociationLoanNotFoundError('Lånet blev ikke fundet.')
  if (loan.borrowerMessage !== undefined && typeof loan.borrowerMessage !== 'string') {
    throw new AssociationLoansError('Lånets besked indeholder ugyldige oplysninger.')
  }
  const [detail] = await mapAssociationLoans([loan], id)
  if (!detail) throw new AssociationLoansError('Lånet kunne ikke indlæses.')
  return { ...detail, borrowerMessage: loan.borrowerMessage ?? null }
}

export async function decideAssociationLoan(
  associationId: string,
  loanId: string,
  decision: LoanDecision,
): Promise<void> {
  const ownerId = parseAssociationId(associationId)
  if (!/^[a-f\d]{24}$/i.test(loanId)) {
    throw new AssociationLoanNotFoundError('Lånet blev ikke fundet.')
  }
  const id = new ObjectId(loanId)
  await withTransaction(async (database, session) => {
    const loans = database.collection<LoanDocument>('loan')
    const loan = await loans.findOne({ _id: id, ownerAssociationId: ownerId }, { session })
    if (!loan) throw new AssociationLoanNotFoundError('Lånet blev ikke fundet.')
    if (!isValidLoan(loan)) throw new AssociationLoansError('Lånet indeholder ugyldige oplysninger.')
    if (loan.status !== 'Afventer svar') {
      throw new LoanDecisionConflictError('Lånet afventer ikke længere svar. Opdatér lånet for at se den aktuelle status.')
    }
    if (decision === 'Godkendt') {
      if (!await lockPropForLoan(ownerId, loan.propId, session)) {
        throw new LoanDecisionConflictError('Rekvisitten til lånet blev ikke fundet.')
      }
      const start = new Date(`${loan.startDate.toISOString().slice(0, 10)}T00:00:00.000Z`)
      const end = new Date(`${loan.endDate.toISOString().slice(0, 10)}T00:00:00.000Z`)
      if (await findOverlappingReservation(ownerId, loan.propId, start, end, session)
        || await findOverlappingApprovedLoan(loan.propId, start, end, session)) {
        throw new LoanDecisionConflictError('Rekvisitten er allerede reserveret eller udlånt i den valgte periode.')
      }
    }
    const result = await loans.updateOne(
      { _id: id, ownerAssociationId: ownerId, status: 'Afventer svar' },
      { $set: { status: decision } },
      { session },
    )
    if (result.matchedCount !== 1) {
      throw new LoanDecisionConflictError('Lånet afventer ikke længere svar. Opdatér lånet for at se den aktuelle status.')
    }
  })
}
