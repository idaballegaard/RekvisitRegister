import { Router } from 'express'
import { getHealth } from '../controllers/health.controller.ts'

const healthRouter = Router()

healthRouter.get('/health', getHealth)

export default healthRouter