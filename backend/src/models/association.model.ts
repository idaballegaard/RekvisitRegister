export interface AssociationDocument {
  name: string
  contactPerson?: {
    name: string
    email: string
    phone: string
  }
  createdAt: Date
  updatedAt: Date
}