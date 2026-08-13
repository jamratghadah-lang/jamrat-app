// Centralised IDOR + event-isolation checks. Every API route that touches
// an event MUST go through these helpers — no ad-hoc `if` checks.

import { NextResponse } from 'next/server'
import { db } from './db'
import { canAccessEvent } from './event-access'

export interface AuthedUser {
  id: string
  role: string
  email: string
  /** Real display name — fetched from DB via `resolveAuthedUserName`.
   *  Empty until you call that helper. Avoid using `email` as the
   *  audit-trail actor name. */
  name: string
}

export function getAuthedUser(request: Request): AuthedUser {
  return {
    id: (request as Request & { headers: Headers }).headers.get('X-User-Id') || '',
    role: (request as Request & { headers: Headers }).headers.get('X-User-Role') || '',
    email: (request as Request & { headers: Headers }).headers.get('X-User-Email') || (request as Request & { headers: Headers }).headers.get('X-User-Name') || '',
    name: '', // populated on demand by resolveAuthedUserName
  }
}

/** Fetches the user's real display name from DB. Use this before
 *  calling `recordAudit({ userName: ... })` so the audit trail shows
 *  "أ. سارة" instead of "admin" / "staff". */
export async function resolveAuthedUserName(user: AuthedUser): Promise<string> {
  if (!user.id) return 'النظام'
  if (user.name) return user.name
  const row = await db.user.findUnique({
    where: { id: user.id },
    select: { name: true, email: true },
  })
  user.name = row?.name || row?.email || user.email || user.role || 'النظام'
  return user.name
}

/** Throws an HttpError-like { status, body } if the user can't touch the event. */
export function assertEventAccess(user: AuthedUser, eventId: string): { ok: true } | { ok: false; response: NextResponse } {
  if (!eventId) return { ok: false, response: NextResponse.json({ error: 'معرف الحدث مطلوب' }, { status: 400 }) }
  if (!user.id) return { ok: false, response: NextResponse.json({ error: 'غير مصرح' }, { status: 401 }) }
  return { ok: true } // defer to async check below
}


export async function requireEventAccess(
  user: AuthedUser,
  eventId: string,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const pre = assertEventAccess(user, eventId)
  if (!pre.ok) return pre
  const allowed = await canAccessEvent(user, eventId)
  if (!allowed) return { ok: false, response: NextResponse.json({ error: 'ليس لديك صلاحية الوصول لهذا الحدث' }, { status: 403 }) }
  return { ok: true }
}

/** Ensures the caller is admin. */
export function requireAdminRole(user: AuthedUser): { ok: true } | { ok: false; response: NextResponse } {
  if (user.role !== 'admin') {
    return { ok: false, response: NextResponse.json({ error: 'هذا القسم للمدير فقط' }, { status: 403 }) }
  }
  return { ok: true }
}

// Backwards-compatible scope helpers built on top of the DB.
export async function eventScopeWhere(user: AuthedUser): Promise<Record<string, unknown>> {
  if (user.role === 'admin') return {}
  const owns = await db.event.findMany({ where: { createdById: user.id }, select: { id: true } })
  const assigned = await db.eventAssignment.findMany({ where: { userId: user.id }, select: { eventId: true } })
  const ids = new Set<string>([...owns.map((e) => e.id), ...assigned.map((a) => a.eventId)])
  return { id: { in: Array.from(ids) } }
}

export async function eventIdScopeWhere(user: AuthedUser): Promise<Record<string, unknown>> {
  if (user.role === 'admin') return {}
  const owns = await db.event.findMany({ where: { createdById: user.id }, select: { id: true } })
  const assigned = await db.eventAssignment.findMany({ where: { userId: user.id }, select: { eventId: true } })
  const ids = new Set<string>([...owns.map((e) => e.id), ...assigned.map((a) => a.eventId)])
  return { eventId: { in: Array.from(ids) } }
}
