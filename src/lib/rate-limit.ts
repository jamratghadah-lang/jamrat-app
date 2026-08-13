// In-memory rate limiter for public (unauthenticated) endpoints.
//
// Why in-memory: the project is currently single-node. For multi-node
// deployments, replace this with a Redis-backed limiter.
//
// Usage:
//   import { rateLimit } from '@/lib/rate-limit'
//   if (!rateLimit(getIp(request), { max: 30, windowMs: 15 * 60 * 1000 })) {
//     return NextResponse.json({ error: 'تجاوزتِ عدد الطلبات' }, { status: 429 })
//   }

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

interface RateLimitOptions {
  /** Max requests allowed in the window. Default 60. */
  max?: number
  /** Window in milliseconds. Default 15 minutes. */
  windowMs?: number
}

/**
 * Returns true if the request is allowed, false if rate-limited.
 * Cleans up expired buckets opportunistically.
 */
export function rateLimit(
  key: string,
  opts: RateLimitOptions = {},
): boolean {
  sweepExpiredBuckets()
  const max = opts.max ?? 60
  const windowMs = opts.windowMs ?? 15 * 60 * 1000
  const now = Date.now()

  const b = buckets.get(key)
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (b.count >= max) return false
  b.count++
  return true
}

/** Reads the request IP from common proxy headers. */
export function getRequestIpFromRequest(request: Request): string {
  const headers = (request as Request & { headers: Headers }).headers
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') ||
    'unknown'
  )
}

// Periodic cleanup of expired buckets (called lazily on each request,
// plus a sweep every ~1000 calls). Prevents memory growth.
let sweepCounter = 0
export function sweepExpiredBuckets(): void {
  sweepCounter++
  if (sweepCounter < 1000) return
  sweepCounter = 0
  const now = Date.now()
  for (const [k, b] of buckets) {
    if (b.resetAt < now) buckets.delete(k)
  }
}
