import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, eventScopeWhere, eventIdScopeWhere } from '@/lib/event-access'
import { handleApiError, notFound } from '@/lib/api-errors'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')
    const user = getRequestUser(request)
    const eventScope = await eventScopeWhere(user)
    const eventIds = eventId
      ? [eventId]
      : (await db.event.findMany({ where: eventScope, select: { id: true } })).map((e) => e.id)
    if (eventId && !(await db.event.findFirst({ where: { AND: [eventScope, { id: eventId }] } }))) {
      return notFound('الحدث غير موجود أو خارج صلاحيتك')
    }

    const [byConfirmed, totalAll, attended, sent] = await Promise.all([
      db.guest.count({ where: { eventId: { in: eventIds }, archivedAt: null, confirmed: 'confirmed' } }),
      db.guest.count({ where: { eventId: { in: eventIds }, archivedAt: null } }),
      db.checkin.count({ where: { eventId: { in: eventIds } } }),
      db.sendLog.count({ where: { eventId: { in: eventIds }, status: 'sent' } }),
    ])
    const totalCount = totalAll
    const confirmedCount = byConfirmed
    return NextResponse.json({
      eventCount: eventIds.length,
      totalGuests: totalCount,
      confirmedGuests: confirmedCount,
      attendedGuests: attended,
      sentMessages: sent,
      source: 'derivation',
    })
  } catch (error) {
    return handleApiError(error, 'Reports error:')
  }
}
