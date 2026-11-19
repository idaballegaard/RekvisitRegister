import nodemailer from 'nodemailer'

export class EmailConfigurationError extends Error {}
export class EmailDeliveryError extends Error {}

interface SmtpConfiguration {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  from: string
  frontendBaseUrl: string
}

function getSmtpConfiguration(): SmtpConfiguration {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM, FRONTEND_BASE_URL } =
    process.env
  const port = Number(SMTP_PORT)
  let frontendUrl: URL

  try {
    frontendUrl = new URL(FRONTEND_BASE_URL ?? '')
  } catch {
    throw new EmailConfigurationError('FRONTEND_BASE_URL skal være en gyldig URL')
  }

  if (
    !SMTP_HOST
    || !Number.isInteger(port)
    || port < 1
    || port > 65535
    || !SMTP_USER
    || !SMTP_PASSWORD
    || !SMTP_FROM
    || !['http:', 'https:'].includes(frontendUrl.protocol)
  ) {
    throw new EmailConfigurationError(
      'SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM og FRONTEND_BASE_URL skal konfigureres',
    )
  }

  return {
    host: SMTP_HOST,
    port,
    secure: port === 465,
    user: SMTP_USER,
    password: SMTP_PASSWORD,
    from: SMTP_FROM,
    frontendBaseUrl: frontendUrl.origin,
  }
}

export function assertEmailDeliveryConfigured(): void {
  getSmtpConfiguration()
}

export function createPasswordResetUrl(token: string): string {
  const { frontendBaseUrl } = getSmtpConfiguration()
  const url = new URL('/reset-password', frontendBaseUrl)
  url.searchParams.set('token', token)
  return url.toString()
}

export function createEmailVerificationUrl(token: string): string {
  const { frontendBaseUrl } = getSmtpConfiguration()
  const url = new URL('/verify-email', frontendBaseUrl)
  url.searchParams.set('token', token)
  return url.toString()
}

async function sendEmail(options: {
  to: string
  subject: string
  text: string
  html: string
}): Promise<void> {
  const configuration = getSmtpConfiguration()
  const transporter = nodemailer.createTransport({
    host: configuration.host,
    port: configuration.port,
    secure: configuration.secure,
    auth: {
      user: configuration.user,
      pass: configuration.password,
    },
  })

  try {
    await transporter.sendMail({ from: configuration.from, ...options })
  } catch (error) {
    throw new EmailDeliveryError('SMTP-serveren kunne ikke sende e-mailen', { cause: error })
  }
}

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: 'Nulstil din adgangskode til Rekvisit Register',
    text: [
      'Vi har modtaget en anmodning om at nulstille adgangskoden til din konto.',
      `Brug dette link inden for 30 minutter: ${resetUrl}`,
      'Hvis du ikke har bedt om nulstillingen, kan du ignorere denne e-mail.',
    ].join('\n\n'),
    html: `<p>Vi har modtaget en anmodning om at nulstille adgangskoden til din konto.</p><p><a href="${resetUrl}">Vælg en ny adgangskode</a></p><p>Linket udløber om 30 minutter. Hvis du ikke har bedt om nulstillingen, kan du ignorere denne e-mail.</p>`,
  })
}

export async function sendEmailVerification(email: string, verificationUrl: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: 'Bekræft din e-mail til Rekvisit Register',
    text: [
      'Bekræft, at denne e-mailadresse tilhører dig.',
      `Brug dette link inden for 24 timer: ${verificationUrl}`,
      'Hvis du ikke har bedt om bekræftelse, kan du ignorere denne e-mail.',
    ].join('\n\n'),
    html: `<p>Bekræft, at denne e-mailadresse tilhører dig.</p><p><a href="${verificationUrl}">Bekræft e-mailadresse</a></p><p>Linket udløber om 24 timer. Hvis du ikke har bedt om bekræftelse, kan du ignorere denne e-mail.</p>`,
  })
}
