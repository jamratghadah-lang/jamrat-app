// Single helper: resolve the calling staff identity from the session and
// expose it on the request. Every check-in / QR / audit code path must
// use this so the operator is always the authenticated user, never a
// caller-supplied field.

import { db } from './db'
import { getAuthedUser } from './access'

export interface ResolvedSession {
  userId: string
  role: string
  email: string
  name: string
}

export async function resolveSession(request: Request): Promise<ResolvedSession | null> {
  const u = getAuthedUser(request)
  if (!u.id) return null
  const row = await db.user.findUnique({
    where: { id: u.id },
    select: { id: true, role: true, email: true, name: true, status: true },
  })
  if (!row || row.status !== 'active') return null
  return { userId: row.id, role: row.role, email: row.email, name: row.name }
}
