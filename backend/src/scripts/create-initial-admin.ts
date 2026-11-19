import 'dotenv/config'
import { closeDatabase, connectToDatabase } from '../config/database.ts'
import { createInitialAdmin } from '../services/initial-admin.service.ts'
import { validateInitialAdminInput } from '../services/user.service.ts'

async function main(): Promise<void> {
  const input = validateInitialAdminInput({
    associationName: process.env.INITIAL_ASSOCIATION_NAME,
    firstName: process.env.INITIAL_ADMIN_FIRST_NAME,
    lastName: process.env.INITIAL_ADMIN_LAST_NAME,
    userName: process.env.INITIAL_ADMIN_USERNAME,
    email: process.env.INITIAL_ADMIN_EMAIL,
    password: process.env.INITIAL_ADMIN_PASSWORD,
  })

  await connectToDatabase()
  const created = await createInitialAdmin(input)

  console.log(`Oprettede foreningen "${created.associationName}" og brugeren "${created.userName}".`)
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Ukendt fejl'
    console.error('Kunne ikke oprette første foreningsansvarlige:', message)
    process.exitCode = 1
  })
  .finally(closeDatabase)