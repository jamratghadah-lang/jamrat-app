// Centralised environment validation. Throws on startup if anything is
// missing or unsafe. Imported by anything that reads process.env.

interface RuntimeEnv {
  NODE_ENV: 'development' | 'test' | 'production'
  DATABASE_URL: string
  JWT_SECRET: string
  CRON_SECRET: string
}

let cached: RuntimeEnv | null = null

export function getEnv(): RuntimeEnv {
  if (cached) return cached

  const env = process.env
  const NODE_ENV = (env.NODE_ENV || 'development') as RuntimeEnv['NODE_ENV']

  const DATABASE_URL = env.DATABASE_URL?.trim()
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is required')
  }

  const JWT_SECRET = env.JWT_SECRET?.trim()
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is required. Set it in your environment.')
  }
  if (JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters (256 bits).')
  }
  // Forbid known placeholders people ship by accident.
  const PLACEHOLDERS = [
    'your-jwt-secret-change-this',
    'change-me',
    'secret',
    'jamrat-secret-key',
    'jwt-secret',
    'replace-me',
  ]
  if (PLACEHOLDERS.includes(JWT_SECRET.toLowerCase())) {
    throw new Error('JWT_SECRET is set to a known placeholder; rotate it.')
  }

  const CRON_SECRET = env.CRON_SECRET?.trim()
  if (!CRON_SECRET || CRON_SECRET.length < 32) {
    throw new Error('CRON_SECRET is required and must be at least 32 characters.')
  }

  cached = { NODE_ENV, DATABASE_URL, JWT_SECRET, CRON_SECRET }
  return cached
}

export function isProduction(): boolean {
  return getEnv().NODE_ENV === 'production'
}
