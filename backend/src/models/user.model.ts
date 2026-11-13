import type { ObjectId } from 'mongodb'

export const ROLES = {
  ASSOCIATION_ADMIN: 'associationAdmin',
  PROP_MANAGER: 'propManager',
  SEARCH_USER: 'searchUser',
} as const

export type UserRole = (typeof ROLES)[keyof typeof ROLES]

export const PERMISSIONS = {
  CREATE_ASSOCIATION_USERS: 'createAssociationUsers',
  UPDATE_ASSOCIATION: 'updateAssociation',
  MANAGE_PROPS: 'manageProps',
  SEARCH_PROPS: 'searchProps',
  REQUEST_LOANS: 'requestLoans',
  APPROVE_LOANS: 'approveLoans',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  [ROLES.ASSOCIATION_ADMIN]: Object.values(PERMISSIONS),
  [ROLES.PROP_MANAGER]: [
    PERMISSIONS.MANAGE_PROPS,
    PERMISSIONS.SEARCH_PROPS,
    PERMISSIONS.REQUEST_LOANS,
    PERMISSIONS.APPROVE_LOANS,
  ],
  [ROLES.SEARCH_USER]: [PERMISSIONS.SEARCH_PROPS, PERMISSIONS.REQUEST_LOANS],
}

export interface UserDocument {
  firstName: string
  lastName: string
  userName: string
  passwordHash: string
  role: UserRole
  associationId: ObjectId
  createdAt: Date
  updatedAt: Date
}

export interface InitialAdminInput {
  associationName: unknown
  firstName: unknown
  lastName: unknown
  userName: unknown
  password: unknown
}

export interface ValidatedInitialAdminInput {
  associationName: string
  firstName: string
  lastName: string
  userName: string
  password: string
}