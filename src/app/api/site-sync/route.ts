// Site sync status endpoint — returns REAL counts of records that would
// be synced to the public site. No fake setTimeout, no placeholder data.
// The "sync" itself is a no-op in this build (no external site wired up),
// but the counts returned are real, taken from the database.
//
// Every "sync" call records a row in operation_logs so the audit trail
// reflects actual user activity.

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, resolveRequestUserName } from '@/lib/event-access'
import { recordAudit } from '@/lib/audit'
import { getRequestIp } from '@/lib/hooks'
import { handleApiError, unauthorized } from '@/lib/api-errors'

export const runtime = 'nodejs'

interface SyncEntity {
  key: string
  label: string
  count: () => Promise<number>
}

const ENTITIES: SyncEntity[] = [
  { key: 'events', label: 'المناسبات', count: () => db.event.count({ where: { status: { not: 'archived' } } }) },
  { key: 'guests', label: 'الضيوف', count: () => db.guest.count({ where: { archivedAt: null } }) },
  { key: 'confirmations', label: 'تأكيدات الحضور', count: () => db.guest.count({ where: { confirmed: 'confirmed', archivedAt: null } }) },
  { key: 'companions', label: 'المرافقين', count: async () => {
    const r = await db.guest.aggregate({ where: { archivedAt: null }, _sum: { companions: true } })
    return r._sum.companions || 0
  } },
  { key: 'qr', label: 'أكواد QR', count: () => db.guest.count({ where: { hasQR: true, archivedAt: null } }) },
  { key: 'attendance', label: 'سجل الحضور', count: () => db.checkin.count() },
  { key: 'guest-cards', label: 'بطاقات الضيوف', count: () => db.guest.count({ where: { hasQR: true, archivedAt: null } }) },
]

// GET — returns current counts (used to populate the table before any sync)
export async function GET(request: NextRequest) {
  try {
    const user = getRequestUser(request)
    if (!user.id) {
      return unauthorized('غير مصرح')
    }

    const items = await Promise.all(
      ENTITIES.map(async (e) => ({
        key: e.key,
        label: e.label,
        count: await e.count(),
      })),
    )

    return NextResponse.json({
      items,
      siteUrl: process.env.SITE_URL || '',
      // The sync feature is not wired to a real external site in this build.
      // We expose this flag honestly so the UI can show an accurate badge.
      syncEnabled: false,
      lastFullSync: null,
    })
  } catch (error) {
    return handleApiError(error, 'Site sync status error:')
  }
}

// POST — performs the "sync" (records audit log entry; no external call).
// The dashboard's sync buttons hit this endpoint so user activity is
// tracked honestly in the audit log instead of fake setTimeout animations.
export async function POST(request: NextRequest) {
  try {
    const user = getRequestUser(request)
    if (!user.id) {
      return unauthorized('غير مصرح')
    }

    const body = await request.json().catch(() => ({})) as { entity?: string; eventId?: string }
    const targetEntity = typeof body.entity === 'string' ? body.entity : ''
    const targetEventId = typeof body.eventId === 'string' ? body.eventId : ''

    // Record the sync attempt in the audit log so there's a real,
    // persistent record that the user pressed the sync button.
    await recordAudit({
      eventId: targetEventId || undefined,
      userId: user.id,
      userName: await resolveRequestUserName(user),
      text: targetEntity
        ? `محاولة مزامنة ${targetEntity} مع الموقع العام`
        : 'محاولة مزامنة شاملة مع الموقع العام',
      entity: 'site_sync',
      entityId: targetEntity || 'all',
      action: 'site_sync_attempt',
      oldValue: '',
      newValue: targetEntity ? JSON.stringify({ entity: targetEntity }) : JSON.stringify({ entity: 'all' }),
      ipAddress: getRequestIp(request),
    })

    // Return honest status: sync is not wired to a real external site.
    return NextResponse.json({
      success: false,
      syncEnabled: false,
      message: 'ميزة المزامنة مع الموقع العام غير مفعّلة في هذه النسخة. تم تسجيل المحاولة في سجل العمليات.',
      auditRecorded: true,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return handleApiError(error, 'Site sync POST error:')
  }
}
