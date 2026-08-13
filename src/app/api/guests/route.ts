import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, canAccessEvent, eventIdScopeWhere, canPerformEventAction, resolveRequestUserName } from '@/lib/event-access'
import { CreateGuestInput, formatZodIssues } from '@/lib/validation'
import { recordAudit } from '@/lib/audit'
import { getRequestIp } from '@/lib/hooks'
import { forbidden, handleApiError, unauthorized } from '@/lib/api-errors'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const includeArchived = searchParams.get('archived') === '1'
    const page = Math.max(1, Number(searchParams.get('page') || '1') || 1)
    const pageSize = Math.min(200, Math.max(1, Number(searchParams.get('pageSize') || '50') || 50))
    const user = getRequestUser(request)

    if (eventId) {
      if (!(await canAccessEvent(user, eventId))) {
        return forbidden('ليس لديك صلاحية الوصول لهذا الحدث')
      }
    }

    const scope = await eventIdScopeWhere(user)
    const where: Record<string, unknown> = { ...scope }
    if (eventId) where.eventId = eventId
    if (status && status !== 'all') {
      if (status === 'confirmed' || status === 'unconfirmed') {
        where.confirmed = status
      } else if (status === 'attended' || status === 'absent') {
        where.attended = status
      }
    }
    if (!includeArchived) where.archivedAt = null
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ]
    }

    const [guests, total] = await Promise.all([
      db.guest.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      db.guest.count({ where }),
    ])

    const response = NextResponse.json(guests)
    response.headers.set('X-Pagination', JSON.stringify({ page, pageSize, total, pages: Math.ceil(total / pageSize) }))
    return response
  } catch (error) {
    return handleApiError(error, 'Get guests error:')
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = CreateGuestInput.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(formatZodIssues(parsed.error), { status: 400 })
    }
    const data = parsed.data
    const user = getRequestUser(request)
    if (!user.id) {
      return unauthorized('غير مصرح')
    }

    if (!(await canAccessEvent(user, data.eventId))) {
      return forbidden('ليس لديك صلاحية الوصول لهذا الحدث')
    }
    if (!(await canPerformEventAction(user, data.eventId, 'manage'))) {
      return forbidden('ليس لديك صلاحية إدارة ضيوف هذه المناسبة')
    }

    // Prevent obvious duplicates inside the same event by phone.
    if (data.phone) {
      const dupe = await db.guest.findFirst({
        where: { eventId: data.eventId, phone: data.phone, archivedAt: null },
      })
      if (dupe) {
        return NextResponse.json(
          { error: 'ضيف بنفس رقم الهاتف موجود مسبقاً في هذا الحدث', duplicateId: dupe.id },
          { status: 409 },
        )
      }
    }

    const guest = await db.$transaction(async (tx) => {
      const created = await tx.guest.create({
        data: {
          eventId: data.eventId,
          name: data.name,
          phone: data.phone || '',
          email: data.email || '',
          companions: data.companions || 0,
          notes: data.notes || '',
        },
      })
      const guestCount = await tx.guest.count({
        where: { eventId: data.eventId, archivedAt: null },
      })
      await tx.event.update({
        where: { id: data.eventId },
        data: { guests: guestCount },
      })
      return created
    })

    await recordAudit({
      eventId: data.eventId,
      userId: user.id,
      userName: await resolveRequestUserName(user),
      text: `إضافة ضيف ${guest.name}`,
      entity: 'guest',
      entityId: guest.id,
      action: 'guest_create',
      newValue: { name: guest.name, phone: guest.phone },
      ipAddress: getRequestIp(request),
    })

    return NextResponse.json(guest, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'Create guest error:')
  }
}
