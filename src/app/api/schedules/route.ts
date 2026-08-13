import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, canAccessEvent, canPerformEventAction, eventIdScopeWhere, resolveRequestUserName } from '@/lib/event-access'
import { recordAudit } from '@/lib/audit'
import { getRequestIp } from '@/lib/hooks'
import { CreateScheduleInput, formatZodIssues } from '@/lib/validation'
import { badRequest, forbidden, handleApiError, unauthorized } from '@/lib/api-errors'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')
    const user = getRequestUser(request)
    if (eventId && !(await canAccessEvent(user, eventId))) {
      return forbidden('ليس لديك صلاحية الوصول لهذا الحدث')
    }
    const scope = await eventIdScopeWhere(user)
    // Build the where clause:
    //  - If a specific eventId is requested, filter on it (after the
    //    canAccessEvent check above).
    //  - Otherwise, if the user is non-admin (scope non-empty), apply
    //    their event-id scope. Spread `scope` directly so we don't
    //    accidentally pick the wrong key (the previous code did
    //    `where.eventId = scope.eventId`, which works for
    //    `{ eventId: { in: [...] } }` but is fragile if scope shape
    //    ever changes).
    //  - Admin (scope {}) → no filter, sees everything.
    const where: Record<string, unknown> = {}
    if (eventId) {
      where.eventId = eventId
    } else if (Object.keys(scope).length) {
      Object.assign(where, scope)
    }
    const page = Math.max(1, Number(searchParams.get('page') || '1') || 1)
    const pageSize = Math.min(200, Math.max(1, Number(searchParams.get('pageSize') || '50') || 50))
    const [rows, total] = await Promise.all([
      // v10.7: include `event: { select: { name: true } }` so the UI
      // can render the event name column in SchedulePage.tsx without a
      // second round-trip. The TS interface in SchedulePage declares
      // `eventName: string` on the row, but the API never returned it,
      // so the column was always blank.
      db.scheduledMessage.findMany({
        where: Object.keys(where).length ? where : undefined,
        orderBy: { scheduleAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { event: { select: { name: true } } },
      }),
      db.scheduledMessage.count({ where: Object.keys(where).length ? where : undefined }),
    ])
    // Flatten `event.name` to `eventName` so the UI doesn't need to
    // change its type definition (it already expects `eventName: string`).
    const flattened = rows.map(({ event, ...row }) => ({
      ...row,
      eventName: event?.name || '',
    }))
    const response = NextResponse.json(flattened)
    response.headers.set('X-Pagination', JSON.stringify({ page, pageSize, total, pages: Math.ceil(total / pageSize) }))
    return response
  } catch (error) {
    return handleApiError(error, 'Get schedules error:')
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = CreateScheduleInput.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(formatZodIssues(parsed.error), { status: 400 })
    }
    const { eventId, recipientType, channel, content, templateId, guestIds, scheduleAt } = parsed.data
    const scheduleAtDate = typeof scheduleAt === 'string' ? new Date(scheduleAt) : scheduleAt
    if (Number.isNaN(scheduleAtDate.getTime()) || scheduleAtDate.getTime() <= Date.now()) {
      return badRequest('وقت الجدولة يجب أن يكون في المستقبل')
    }
    const user = getRequestUser(request)
    if (!user.id) {
      return unauthorized('غير مصرح')
    }
    if (!(await canAccessEvent(user, eventId))) {
      return forbidden('ليس لديك صلاحية الوصول لهذا الحدث')
    }
    if (!(await canPerformEventAction(user, eventId, 'send'))) return forbidden('ليس لديك صلاحية الجدولة لهذه المناسبة')
    const row = await db.scheduledMessage.create({
      data: {
        eventId,
        recipientType,
        channel,
        content: JSON.stringify(content || {}),
        templateId: templateId ?? null,
        guestIds: JSON.stringify(guestIds || []),
        scheduleAt: scheduleAtDate,
        status: 'pending',
      },
    })
    await recordAudit({
      eventId, userId: user.id, userName: await resolveRequestUserName(user),
      text: `جدولة رسالة`,
      entity: 'schedule', entityId: row.id, action: 'schedule_create',
      newValue: { scheduleAt: scheduleAtDate, channel: row.channel },
      ipAddress: getRequestIp(request),
    })
    return NextResponse.json(row, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'Create schedule error:')
  }
}
