import { NextRequest } from 'next/server'
import { db } from './db'

export interface RequestUser {
  id: string
  role: string
  email: string
  /** Real display name — populated by resolveRequestUserName(). */
  name: string
}

/**
 * Reads the identity the middleware already verified (JWT + tokenVersion)
 * and attached to the request headers. Never trust a userId/role coming
 * from the request body or query string for access-control decisions.
 */
export function getRequestUser(request: NextRequest): RequestUser {
  return {
    id: request.headers.get('X-User-Id') || '',
    role: request.headers.get('X-User-Role') || '',
    email: request.headers.get('X-User-Email') || '',
    name: '', // populated on demand by resolveRequestUserName
  }
}

/** Fetches the user's real display name from DB. Use this before
 *  calling `recordAudit({ userName: ... })`. */
export async function resolveRequestUserName(user: RequestUser): Promise<string> {
  if (!user.id) return 'النظام'
  if (user.name) return user.name
  const row = await db.user.findUnique({
    where: { id: user.id },
    select: { name: true, email: true },
  })
  user.name = row?.name || row?.email || user.email || user.role || 'النظام'
  return user.name
}

/**
 * Returns the list of event IDs a user is allowed to see:
 * - admin: null (meaning "no restriction, all events")
 * - everyone else: events they created OR were explicitly assigned to
 */
export async function getAccessibleEventIds(user: RequestUser): Promise<string[] | null> {
  if (user.role === 'admin') return null

  const [created, assigned] = await Promise.all([
    db.event.findMany({ where: { createdById: user.id }, select: { id: true } }),
    db.eventAssignment.findMany({ where: { userId: user.id }, select: { eventId: true } }),
  ])

  const ids = new Set<string>()
  created.forEach((e) => ids.add(e.id))
  assigned.forEach((a) => ids.add(a.eventId))
  return Array.from(ids)
}

/**
 * Checks whether a user may access one specific event.
 */
export async function canAccessEvent(user: RequestUser, eventId: string): Promise<boolean> {
  if (user.role === 'admin') return true
  if (!eventId) return false

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { createdById: true },
  })
  if (!event) return false
  if (event.createdById === user.id) return true

  const assignment = await db.eventAssignment.findUnique({
    where: { eventId_userId: { eventId, userId: user.id } },
  })
  return !!assignment
}

/**
 * Builds a Prisma `where` fragment restricting an Event query to what the
 * user can see. Spread the result into your existing `where` object.
 * Returns {} for admin (no restriction).
 */
export async function eventScopeWhere(user: RequestUser): Promise<Record<string, unknown>> {
  const ids = await getAccessibleEventIds(user)
  if (ids === null) return {}
  return { id: { in: ids } }
}

/**
 * Same idea but for models that hang off an event via an `eventId` field
 * (guests, checkins, send logs, ...). Returns {} for admin.
 */
export async function eventIdScopeWhere(user: RequestUser): Promise<Record<string, unknown>> {
  const ids = await getAccessibleEventIds(user)
  if (ids === null) return {}
  return { eventId: { in: ids } }
}

/**
 * Trash items are special: a trashed *event* no longer exists as a live
 * Event row (its eventId FK is intentionally left null to avoid cascade
 * deletion), so we can't scope it purely through eventId like other
 * models. We fall back to the createdById snapshot taken at delete time.
 * A trashed *guest* still has a live parent event, so eventId scoping
 * also applies for those and correctly respects current assignments.
 * Returns {} for admin.
 */
export async function trashScopeWhere(user: RequestUser): Promise<Record<string, unknown>> {
  if (user.role === 'admin') return {}
  const ids = await getAccessibleEventIds(user)
  return {
    OR: [
      { createdById: user.id },
      { eventId: { in: ids ?? [] } },
    ],
  }
}

/**
 * Whether a user may act on one specific trash item.
 */
export async function canAccessTrashItem(
  user: RequestUser,
  item: { createdById: string | null; eventId: string | null }
): Promise<boolean> {
  if (user.role === 'admin') return true
  if (item.createdById && item.createdById === user.id) return true
  if (item.eventId && (await canAccessEvent(user, item.eventId))) return true
  return false
}

export async function getEventAccessRole(user: RequestUser, eventId: string): Promise<string | null> {
  if (!user.id || !eventId) return null
  if (user.role === 'admin') return 'admin'
  const event = await db.event.findUnique({ where: { id: eventId }, select: { createdById: true } })
  if (!event) return null
  if (event.createdById === user.id) return user.role
  const assignment = await db.eventAssignment.findUnique({ where: { eventId_userId: { eventId, userId: user.id } }, select: { role: true } })
  return assignment?.role || null
}

export async function canPerformEventAction(user: RequestUser, eventId: string, action: 'manage' | 'checkin' | 'send' | 'read'): Promise<boolean> {
  const role = await getEventAccessRole(user, eventId)
  if (!role) return false
  if (role === 'admin') return true
  if (action === 'read') return true
  if (action === 'manage') return role === 'staff'
  if (action === 'checkin') return role === 'staff' || role === 'checkin'
  if (action === 'send') return role === 'staff' || role === 'sender'
  return false
}
