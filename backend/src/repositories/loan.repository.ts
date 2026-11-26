import type { ClientSession, ObjectId, WithId } from 'mongodb'
import { getDatabase } from '../config/database.ts'
import type { AssociationDocument } from '../models/association.model.ts'
import type { LoanDocument } from '../models/loan.model.ts'
import type { PropDocument } from '../models/prop.model.ts'

export async function findLoansForAssociation(associationId: ObjectId): Promise<WithId<LoanDocument>[]> {
  return getDatabase().collection<LoanDocument>('loan')
    .find({ $or: [{ ownerAssociationId: associationId }, { borrowerAssociationId: associationId }] })
    .sort({ startDate: -1, _id: 1 })
    .toArray()
}

export async function findLoanForAssociation(
  loanId: ObjectId,
  associationId: ObjectId,
): Promise<WithId<LoanDocument> | null> {
  return getDatabase().collection<LoanDocument>('loan').findOne({
    _id: loanId,
    $or: [{ ownerAssociationId: associationId }, { borrowerAssociationId: associationId }],
  })
}

export async function findOverlappingApprovedLoan(
  propId: ObjectId,
  startDate: Date,
  endDate: Date,
  session: ClientSession,
): Promise<boolean> {
  const endExclusive = new Date(endDate)
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1)
  return Boolean(await getDatabase().collection<LoanDocument>('loan').findOne({
    propId,
    status: 'Godkendt',
    startDate: { $lt: endExclusive },
    endDate: { $gte: startDate },
  }, { session, projection: { _id: 1 } }))
}

export async function findLoanReferences(propIds: ObjectId[], associationIds: ObjectId[]): Promise<{
  props: WithId<Pick<PropDocument, 'name' | 'associationId'>>[]
  associations: WithId<Pick<AssociationDocument, 'name'>>[]
}> {
  const database = getDatabase()
  const [props, associations] = await Promise.all([
    database.collection<PropDocument>('prop').find({ _id: { $in: propIds } })
      .project<WithId<Pick<PropDocument, 'name' | 'associationId'>>>({ name: 1, associationId: 1 }).toArray(),
    database.collection<AssociationDocument>('associations').find({ _id: { $in: associationIds } })
      .project<WithId<Pick<AssociationDocument, 'name'>>>({ name: 1 }).toArray(),
  ])
  return { props, associations }
}
