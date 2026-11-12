require('dotenv').config();

const { closeDatabase, connectToDatabase, withTransaction } = require('../db');
const { hashPassword, ROLES, validateInitialAdminInput } = require('../user');

async function main() {
  const input = validateInitialAdminInput({
    associationName: process.env.INITIAL_ASSOCIATION_NAME,
    firstName: process.env.INITIAL_ADMIN_FIRST_NAME,
    lastName: process.env.INITIAL_ADMIN_LAST_NAME,
    userName: process.env.INITIAL_ADMIN_USERNAME,
    password: process.env.INITIAL_ADMIN_PASSWORD,
  });

  const passwordHash = await hashPassword(input.password);
  await connectToDatabase();

  const created = await withTransaction(async (database, session) => {
    const users = database.collection('users');
    const associations = database.collection('associations');

    const existingUsers = await users.countDocuments({}, { session });
    const existingAssociations = await associations.countDocuments({}, { session });
    if (existingUsers > 0 || existingAssociations > 0) {
      throw new Error('Bootstrap stoppet: der findes allerede brugere eller foreninger i databasen');
    }

    const now = new Date();
    const association = {
      name: input.associationName,
      createdAt: now,
      updatedAt: now,
    };
    const associationResult = await associations.insertOne(association, { session });

    const user = {
      firstName: input.firstName,
      lastName: input.lastName,
      userName: input.userName,
      passwordHash,
      role: ROLES.ASSOCIATION_ADMIN,
      associationId: associationResult.insertedId,
      createdAt: now,
      updatedAt: now,
    };
    await users.insertOne(user, { session });

    return { associationName: association.name, userName: user.userName };
  });

  console.log(`Oprettede foreningen "${created.associationName}" og brugeren "${created.userName}".`);
}

main()
  .catch((error) => {
    console.error('Kunne ikke oprette første foreningsansvarlige:', error.message);
    process.exitCode = 1;
  })
  .finally(closeDatabase);