import { rateLimit } from 'express-rate-limit'
import { Router } from 'express'
import {
  getCurrentUser,
  patchPassword,
  patchProfile,
  postConfirmEmail,
  postAcceptInvitation,
  postForgotPassword,
  postRequestEmailVerification,
  postLogin,
  postResetPassword,
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
const passwordResetRequestRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_request, response) => {
    response.status(429).json({ error: 'For mange forsøg. Prøv igen senere.' })
  },
})
const passwordResetCompletionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_request, response) => {
    response.status(429).json({ error: 'For mange forsøg. Prøv igen senere.' })
  },
})
const invitationAcceptanceRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_request, response) => {
    response.status(429).json({ error: 'For mange forsøg. Prøv igen senere.' })
  },
})
const emailVerificationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_request, response) => {
    response.status(429).json({ error: 'For mange forsøg. Prøv igen senere.' })
  },
})

authRouter.post('/auth/login', loginRateLimit, postLogin)
authRouter.post('/auth/forgot-password', passwordResetRequestRateLimit, postForgotPassword)
authRouter.post('/auth/reset-password', passwordResetCompletionRateLimit, postResetPassword)
authRouter.post('/auth/accept-invitation', invitationAcceptanceRateLimit, postAcceptInvitation)
authRouter.post(
  '/auth/email-verification',
  requireAuthentication,
  emailVerificationRateLimit,
  postRequestEmailVerification,
)
authRouter.post(
  '/auth/confirm-email',
  emailVerificationRateLimit,
  postConfirmEmail,
)
authRouter.get('/auth/me', requireAuthentication, getCurrentUser)
authRouter.patch('/auth/profile', requireAuthentication, patchProfile)
authRouter.patch('/auth/password', requireAuthentication, patchPassword)

export default authRouter
