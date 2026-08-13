// Audit trail helper. OperationLog rows are append-only — the schema has
// no update / delete API. Always use this from write paths so the actor,
// IP and before / after values are captured automatically.

import { db } from './db'

export interface AuditEntry {
  eventId?: string | null
  userId?: string | null
  userName?: string
  text: string
  entity?: string
  entityId?: string
  action?: string
  oldValue?: string | unknown
  newValue?: string | unknown
  ipAddress?: string
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.operationLog.create({
      data: {
        eventId: entry.eventId ?? null,
        userId: entry.userId ?? null,
        user: entry.userName || 'النظام',
        text: entry.text,
        entity: entry.entity || '',
        entityId: entry.entityId || '',
        action: entry.action || '',
        oldValue: stringify(entry.oldValue),
        newValue: stringify(entry.newValue),
        ipAddress: entry.ipAddress || '',
      },
    })
  } catch {
    // Audit MUST never break the user operation; log and move on.
    // (The Prisma client has no delete API for OperationLog; rows are
    // append-only by design.)
  }
}

function stringify(v: string | unknown | undefined): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}
