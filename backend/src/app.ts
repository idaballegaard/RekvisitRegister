import 'dotenv/config'
import express from 'express'
import { closeDatabase, connectToDatabase } from './config/database.ts'
import healthRouter from './routes/health.routes.ts'

const app = express()
const port = Number(process.env.PORT) || 3000

app.use(express.json())
app.get('/', (_request, response) => {
  response.send('Hej fra Express!')
})
app.use(healthRouter)

async function startServer(): Promise<void> {
  await connectToDatabase()

  app.listen(port, () => {
    console.log(`Serveren kører på http://localhost:${port}`)
  })
}

function shutdown(): void {
  void closeDatabase()
    .catch((error: unknown) => {
      console.error('Fejl ved lukning af MongoDB-forbindelsen:', error)
    })
    .finally(() => process.exit(0))
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)

startServer().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Ukendt fejl'
  console.error('Kunne ikke starte backend:', message)
  process.exit(1)
})