import { rateLimit } from 'express-rate-limit'
import { Router } from 'express'
import {
  getCurrentUser,
  patchPassword,
  patchProfile,
  postLogin,
} from '../controllers/auth.controller.ts'
import { requireAuthentication } from '../middleware/auth.middleware.ts'

const authRouter = Router()
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_request, response) => {
    response.status(429).json({ error: 'For mange loginforsøg. Prøv igen senere.' })
  },
})

authRouter.post('/auth/login', loginRateLimit, postLogin)
authRouter.get('/auth/me', requireAuthentication, getCurrentUser)
authRouter.patch('/auth/profile', requireAuthentication, patchProfile)
authRouter.patch('/auth/password', requireAuthentication, patchPassword)

export default authRouter
