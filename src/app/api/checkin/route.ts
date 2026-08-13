import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, canAccessEvent, canPerformEventAction, eventIdScopeWhere, resolveRequestUserName } from '@/lib/event-access'
import { resolveSession } from '@/lib/session'
import { recordAudit } from '@/lib/audit'
import { getRequestIp } from '@/lib/hooks'
import { CheckinInput, formatZodIssues } from '@/lib/validation'
import { handleApiError, unauthorized, forbidden, notFound, badRequest, conflict } from '@/lib/api-errors'

export async function POST(request: NextRequest) {
  try {
    const parsed = CheckinInput.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(formatZodIssues(parsed.error), { status: 400 })
    }
    const body = parsed.data
    const user = getRequestUser(request)
    if (!user.id) {
      return unauthorized()
    }

    // Resolve the guest — by qrToken (preferred) or explicit guestId.
    // SECURITY (v10.6): filter archivedAt:null so soft-deleted guests
    // can't be checked in. The /api/qr-verify endpoint already filters
    // archivedAt, but /api/checkin is the actual write path — an
    // attacker (or a stale UI) could POST a guestId directly here
    // without going through /api/qr-verify, bypassing that filter.
    let guest = null as Awaited<ReturnType<typeof db.guest.findFirst>>
    if (body.qrToken) {
      guest = await db.guest.findFirst({ where: { qrToken: body.qrToken, archivedAt: null } })
      if (!guest) {
        return notFound('رمز QR غير صالح')
      }
    } else if (body.guestId) {
      guest = await db.guest.findFirst({ where: { id: body.guestId, archivedAt: null } })
      if (!guest) {
        return notFound('الضيف غير موجود')
      }
    }

    if (!guest) {
      return badRequest('guestId أو qrToken مطلوب')
    }

    // Event isolation: the SAME operator must be allowed for THIS event.
    if (!(await canAccessEvent(user, guest.eventId))) {
      return forbidden('ليس لديك صلاحية الوصول لهذا الحدث')
    }

    if (!(await canPerformEventAction(user, guest.eventId, 'checkin'))) {
      return forbidden('ليس لديك صلاحية Check-in لهذه المناسبة')
    }

    // If the caller passed a different eventId it must match the guest's.
    if (body.eventId && body.eventId !== guest.eventId) {
      return badRequest('الضيف لا ينتمي لهذا الحدث')
    }

    if (body.method === 'qr' && guest.qrRevoked) {
      return forbidden('رمز QR ملغى — غير صالح للتسجيل')
    }

    // Operator comes from the resolved session, NEVER from the body.
    const session = await resolveSession(request)
    const operatorId = session?.userId || user.id
    const operatorName = session?.name || await resolveRequestUserName(user) || 'النظام'

    try {
      const result = await db.$transaction(async (tx) => {
        // Atomically claim the check-in slot. This AND the @@unique
        // index on Checkin(guestId) both protect against double scans,
        // even in race conditions or replica-lag edge cases.
        const claim = await tx.guest.updateMany({
          where: { id: guest!.id, attended: { not: 'attended' } },
          data: { attended: 'attended' },
        })
        if (claim.count === 0) {
          throw Object.assign(new Error('ALREADY_ATTENDED'), { code: 'ALREADY_ATTENDED' })
        }

        const created = await tx.checkin.create({
          data: {
            eventId: guest!.eventId,
            guestId: guest!.id,
            guestName: guest!.name,
            companions: body.companions ?? guest!.companions,
            method: body.method || 'manual',
            operator: operatorName,
            operatorId,
          },
        })

        const attendedCount = await tx.guest.count({
          where: { eventId: guest!.eventId, attended: 'attended' },
        })
        await tx.event.update({
          where: { id: guest!.eventId },
          data: { attended: attendedCount },
        })
        return created
      })

      // Audit trail (best effort, must never block the response).
      recordAudit({
        eventId: guest.eventId,
        userId: operatorId,
        userName: operatorName,
        text: `تسجيل حضور ${guest.name}`,
        entity: 'guest',
        entityId: guest.id,
        action: 'checkin',
        newValue: { method: body.method || 'manual', companion: body.companions ?? guest.companions },
        ipAddress: getRequestIp(request),
      }).catch(() => {})

      return NextResponse.json(result, { status: 201 })
    } catch (inner) {
      // v11.0: use handleApiError for the inner catch too — it
      // translates Prisma P2002 (unique constraint on guestId) to 409
      // automatically. The custom ALREADY_ATTENDED sentinel is still
      // handled explicitly because it carries business logic the
      // generic translator can't infer.
      const msg = inner instanceof Error ? inner.message : ''
      const code = (inner as { code?: string }).code
      if (msg === 'ALREADY_ATTENDED' || code === 'ALREADY_ATTENDED') {
        return conflict('الضيف مسجل بالفعل')
      }
      throw inner
    }
  } catch (error) {
    return handleApiError(error, 'Checkin POST')
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')
    const user = getRequestUser(request)

    if (eventId && !(await canAccessEvent(user, eventId))) {
      return forbidden('ليس لديك صلاحية الوصول لهذا الحدث')
    }

    const scope = await eventIdScopeWhere(user)
    const where: Record<string, unknown> = { ...scope }
    if (eventId) where.eventId = eventId

    const page = Math.max(1, Number(searchParams.get('page') || '1') || 1)
    const pageSize = Math.min(200, Math.max(1, Number(searchParams.get('pageSize') || '50') || 50))
    const [checkins, total] = await Promise.all([
      db.checkin.findMany({ where: Object.keys(where).length > 0 ? where : undefined, orderBy: { time: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      db.checkin.count({ where: Object.keys(where).length > 0 ? where : undefined }),
    ])
    const response = NextResponse.json(checkins)
    response.headers.set('X-Pagination', JSON.stringify({ page, pageSize, total, pages: Math.ceil(total / pageSize) }))
    return response
  } catch (error) {
    return handleApiError(error, 'Checkin GET')
  }
}
