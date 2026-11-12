const bcrypt = require('bcryptjs');

const ROLES = Object.freeze({
  ASSOCIATION_ADMIN: 'associationAdmin',
  PROP_MANAGER: 'propManager',
  SEARCH_USER: 'searchUser',
});

const PERMISSIONS = Object.freeze({
  CREATE_ASSOCIATION_USERS: 'createAssociationUsers',
  UPDATE_ASSOCIATION: 'updateAssociation',
  MANAGE_PROPS: 'manageProps',
  SEARCH_PROPS: 'searchProps',
  REQUEST_LOANS: 'requestLoans',
  APPROVE_LOANS: 'approveLoans',
});

const ROLE_PERMISSIONS = Object.freeze({
  [ROLES.ASSOCIATION_ADMIN]: Object.freeze(Object.values(PERMISSIONS)),
  [ROLES.PROP_MANAGER]: Object.freeze([
    PERMISSIONS.MANAGE_PROPS,
    PERMISSIONS.SEARCH_PROPS,
    PERMISSIONS.REQUEST_LOANS,
    PERMISSIONS.APPROVE_LOANS,
  ]),
  [ROLES.SEARCH_USER]: Object.freeze([
    PERMISSIONS.SEARCH_PROPS,
    PERMISSIONS.REQUEST_LOANS,
  ]),
});

function normalizeUserName(userName) {
  return userName.trim().toLowerCase();
}

function hasPermission(role, permission) {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

function validateInitialAdminInput(input) {
  const requiredFields = [
    'associationName',
    'firstName',
    'lastName',
    'userName',
    'password',
  ];

  for (const field of requiredFields) {
    if (typeof input[field] !== 'string' || input[field].trim().length === 0) {
      throw new Error(`${field} mangler eller er tom`);
    }
  }

  const userName = normalizeUserName(input.userName);
  if (!/^[a-z0-9._-]{3,32}$/.test(userName)) {
    throw new Error('userName skal være 3-32 tegn: bogstaver, tal, punktum, _ eller -');
  }

  const passwordBytes = Buffer.byteLength(input.password, 'utf8');
  if (passwordBytes < 12 || passwordBytes > 72) {
    throw new Error('Adgangskoden skal være mindst 12 og højst 72 bytes');
  }

  return {
    associationName: input.associationName.trim(),
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    userName,
    password: input.password,
  };
}

function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

module.exports = {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLES,
  hasPermission,
  hashPassword,
  normalizeUserName,
  validateInitialAdminInput,
};