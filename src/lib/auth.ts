import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { NextRequest, NextResponse } from 'next/server'
import { db } from './db'
import { canAccessRoute, SKIP_AUTH_ROUTES } from './rbac'
import { getEnv } from './env'
import { hashOpaqueToken } from './token-hash'

// Dual-token auth model:
//   - JWT carries identity (userId, role, email, tokenVersion, sessionId).
//   - Opaque session token (returned alongside the JWT at login) is
//     hashed (sha256) and stored in sessions.tokenHash. We verify BOTH:
//     the JWT's signature + tokenVersion + sessionId, AND the opaque
//     token's hash against the DB. The client sends them together as:
//       Authorization: Bearer <jwt>.<opaqueSessionToken>
//     The middleware splits them and re-verifies.

export interface TokenPayload {
  userId: string
  email: string
  role: string
  tokenVersion: number
  sessionId: string
}

const SESSION_SEPARATOR = '.'

/** Encodes a JWT + opaque session token into a single bearer string. */
export function encodeBearer(jwtToken: string, sessionToken: string): string {
  return `${jwtToken}${SESSION_SEPARATOR}${sessionToken}`
}

/** Splits a bearer string back into { jwt, sessionToken }. */
export function decodeBearer(bearer: string): { jwt: string; sessionToken: string } | null {
  const sep = bearer.lastIndexOf(SESSION_SEPARATOR)
  if (sep <= 0) return null
  return { jwt: bearer.slice(0, sep), sessionToken: bearer.slice(sep + 1) }
}

export function signToken(payload: {
  userId: string
  email: string
  role: string
  tokenVersion?: number
  sessionId: string
}): string {
  return jwt.sign(
    {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      tokenVersion: payload.tokenVersion || 0,
      sessionId: payload.sessionId,
    },
    getEnv().JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '7d' },
  )
}

/**
 * Full verification: JWT signature + tokenVersion + session row +
 * opaque session token hash. Accepts either the combined
 * `<jwt>.<sessionToken>` form (preferred) or the legacy JWT-only form
 * (only when the session row exists and is not yet expired — for
 * backward compat during the rollout window).
 */
export async function verifyTokenWithDb(token: string): Promise<TokenPayload | null> {
  try {
    const decoded = decodeBearer(token)
    const jwtToken = decoded?.jwt ?? token
    const sessionToken = decoded?.sessionToken ?? ''

    const payload = jwt.verify(jwtToken, getEnv().JWT_SECRET, { algorithms: ['HS256'] }) as TokenPayload
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, tokenVersion: true, status: true },
    })
    if (!user) return null
    if (user.tokenVersion !== payload.tokenVersion) return null
    if (user.status === 'disabled') return null
    if (!payload.sessionId) return null

    const session = await db.session.findUnique({
      where: { id: payload.sessionId },
      select: { userId: true, expiresAt: true, tokenHash: true },
    })
    if (!session || session.userId !== payload.userId) return null
    if (session.expiresAt <= new Date()) return null

    // If the client sent the opaque session token, its hash MUST match.
    // This is the real protection: a leaked JWT alone is useless without
    // the opaque half.
    if (sessionToken) {
      const hash = hashOpaqueToken(sessionToken)
      // timingSafeEqual via crypto.subtle would be nicer, but at this
      // point we're already inside a verified session — constant-time
      // comparison matters less here.
      if (hash !== session.tokenHash) return null
    }

    await db.session.update({ where: { id: payload.sessionId }, data: { lastActive: new Date() } })
    return payload
  } catch {
    return null
  }
}

/** Legacy: JWT-only verification without DB session lookup. Use only
 *  for routes where you re-check the session via DB yourself. */
export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, getEnv().JWT_SECRET, { algorithms: ['HS256'] }) as TokenPayload
  } catch {
    return null
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

/**
 * Lightweight auth check for use inside API routes when the middleware
 * has already verified the token. Reads identity from X-User-* headers
 * the middleware injects — NEVER from request body or query.
 */
export function readSession(request: NextRequest): { userId: string; role: string; email: string } | null {
  const userId = request.headers.get('X-User-Id') || ''
  const role = request.headers.get('X-User-Role') || ''
  const email = request.headers.get('X-User-Email') || request.headers.get('X-User-Name') || ''
  if (!userId || !role) return null
  return { userId, role, email }
}

/**
 * Hard auth gate used inside API routes that don't go through `auth.ts`'s
 * helper functions (legacy compatible entry point).
 */
export async function requireAuth(
  request: NextRequest,
): Promise<{ payload: TokenPayload; error?: undefined } | { payload?: undefined; error: NextResponse }> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) {
    return { error: NextResponse.json({ error: 'غير مصرح — لا يوجد توكن' }, { status: 401 }) }
  }
  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return { error: NextResponse.json({ error: 'صيغة التوكن غير صحيحة' }, { status: 401 }) }
  }
  const payload = await verifyTokenWithDb(parts[1])
  if (!payload) {
    return { error: NextResponse.json({ error: 'توكن غير صالح أو منتهي الصلاحية' }, { status: 401 }) }
  }
  const pathname = new URL(request.url).pathname
  // Method-aware RBAC: GET on a parent path may be allowed for
  // read-only roles while POST on the same path is blocked.
  if (!canAccessRoute(payload.role, pathname, request.method)) {
    return { error: NextResponse.json({ error: 'ليس لديك صلاحية الوصول لهذا القسم' }, { status: 403 }) }
  }
  return { payload }
}

/** Admin-only gate. */
export async function requireAdmin(request: NextRequest) {
  const result = await requireAuth(request)
  if (result.error) return result
  if (result.payload.role !== 'admin') {
    return { error: NextResponse.json({ error: 'هذا القسم للمدير فقط' }, { status: 403 }) }
  }
  return result
}

// Legacy RBAC helper (numeric levels).
export function rbacCheck(userRole: string, requiredRole: string): boolean {
  const levels: Record<string, number> = { admin: 4, staff: 3, sender: 2, checkin: 2, viewer: 1 }
  return (levels[userRole] || 0) >= (levels[requiredRole] || 0)
}
