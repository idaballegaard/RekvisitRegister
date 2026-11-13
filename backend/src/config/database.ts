import { MongoClient, type ClientSession, type Db } from 'mongodb'

let client: MongoClient | undefined
let database: Db | undefined

export async function connectToDatabase(): Promise<Db> {
  const uri = process.env.MONGODB_URI
  const databaseName = process.env.MONGODB_DB_NAME

  if (!uri) {
    throw new Error('MONGODB_URI mangler i backend/.env')
  }

  if (!databaseName) {
    throw new Error('MONGODB_DB_NAME mangler i backend/.env')
  }

  client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 })

  try {
    await client.connect()
    database = client.db(databaseName)
    await database.command({ ping: 1 })

    const users = database.collection('users')
    await users.createIndex({ userName: 1 }, { unique: true, name: 'unique_user_name' })
    await users.createIndex(
      { associationId: 1, role: 1 },
      { name: 'users_by_association_and_role' },
    )

    console.log(`Forbundet til MongoDB-databasen "${databaseName}"`)
    return database
  } catch (error) {
    await client.close()
    client = undefined
    database = undefined
    throw error
  }
}

export function getDatabase(): Db {
  if (!database) {
    throw new Error('MongoDB er ikke forbundet')
  }

  return database
}

export async function withTransaction<T>(
  callback: (database: Db, session: ClientSession) => Promise<T>,
): Promise<T> {
  if (!client) {
    throw new Error('MongoDB er ikke forbundet')
  }

  const session = client.startSession()

  try {
    let result!: T
    await session.withTransaction(async () => {
      result = await callback(getDatabase(), session)
    })
    return result
  } finally {
    await session.endSession()
  }
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.close()
    client = undefined
    database = undefined
  }
}