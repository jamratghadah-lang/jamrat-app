import { db } from './db'

const WINDOW_MS = 15 * 60 * 1000
const MAX_FAILED_ATTEMPTS = 10

function keyFor(ip: string, email: string) {
  return `${ip || 'unknown'}:${email.trim().toLowerCase()}`
}

export async function isLoginRateLimited(ip: string, email: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MS)
  const key = keyFor(ip, email)
  const count = await db.loginAttempt.count({
    where: { key, success: false, createdAt: { gte: since } },
  })
  return count >= MAX_FAILED_ATTEMPTS
}

export async function recordLoginAttempt(params: {
  ip: string
  email: string
  success: boolean
}): Promise<void> {
  const key = keyFor(params.ip, params.email)
  await db.loginAttempt.create({
    data: { key, ipAddress: params.ip, email: params.email.trim().toLowerCase(), success: params.success },
  })
}

export { WINDOW_MS, MAX_FAILED_ATTEMPTS }
