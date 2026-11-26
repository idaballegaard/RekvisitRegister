import type { ObjectId } from 'mongodb'

export const LOAN_STATUSES = [
  'Afventer svar',
  'Godkendt',
  'Afvist',
  'Afleveret',
  'Annulleret',
] as const

export type LoanStatus = (typeof LOAN_STATUSES)[number]

export interface LoanDocument {
  propId: ObjectId
  ownerAssociationId: ObjectId
  borrowerAssociationId: ObjectId
  startDate: Date
  endDate: Date
  status: LoanStatus
  borrowerMessage?: string
}

export interface AssociationLoan {
  id: string
  type: 'loan' | 'lending'
  propName: string
  associationName: string
  startDate: string
  endDate: string
  status: LoanStatus
}
