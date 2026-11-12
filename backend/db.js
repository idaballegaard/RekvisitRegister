const { MongoClient } = require('mongodb');

let client;
let database;

async function connectToDatabase() {
  const uri = process.env.MONGODB_URI;
  const databaseName = process.env.MONGODB_DB_NAME;

  if (!uri) {
    throw new Error('MONGODB_URI mangler i backend/.env');
  }

  if (!databaseName) {
    throw new Error('MONGODB_DB_NAME mangler i backend/.env');
  }

  client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();

  database = client.db(databaseName);
  await database.command({ ping: 1 });
  await initializeDatabase();

  console.log(`Forbundet til MongoDB-databasen "${databaseName}"`);
  return database;
}

async function initializeDatabase() {
  const users = getDatabase().collection('users');
  await users.createIndex({ userName: 1 }, { unique: true, name: 'unique_user_name' });
  await users.createIndex({ associationId: 1, role: 1 }, { name: 'users_by_association_and_role' });
}

function getDatabase() {
  if (!database) {
    throw new Error('MongoDB er ikke forbundet');
  }

  return database;
}

async function withTransaction(callback) {
  if (!client) {
    throw new Error('MongoDB er ikke forbundet');
  }

  const session = client.startSession();

  try {
    let result;
    await session.withTransaction(async () => {
      result = await callback(getDatabase(), session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

async function closeDatabase() {
  if (client) {
    await client.close();
    client = undefined;
    database = undefined;
  }
}

module.exports = { closeDatabase, connectToDatabase, getDatabase, withTransaction };