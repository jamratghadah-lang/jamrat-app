import crypto from 'node:crypto'
import { getEnv } from './env'

export function hasValidCronSecret(request: Request): boolean {
  const configured = getEnv().CRON_SECRET
  const supplied = request.headers.get('X-Cron-Secret') || ''
  if (!configured || !supplied) return false
  const a = Buffer.from(configured)
  const b = Buffer.from(supplied)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
