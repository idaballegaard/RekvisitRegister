import type { RequestHandler } from 'express'
import { getDatabase } from '../config/database.ts'

export const getHealth: RequestHandler = async (_request, response) => {
  try {
    await getDatabase().command({ ping: 1 })
    response.json({ status: 'ok', database: 'connected' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Ukendt fejl'
    console.error('MongoDB health check fejlede:', message)
    response.status(503).json({ status: 'error', database: 'unavailable' })
  }
}