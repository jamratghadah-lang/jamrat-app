import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, eventScopeWhere, canPerformEventAction, resolveRequestUserName } from '@/lib/event-access'
import { CreateEventInput, formatZodIssues } from '@/lib/validation'
import { recordAudit } from '@/lib/audit'
import { getRequestIp } from '@/lib/hooks'
import { handleApiError, unauthorized, forbidden } from '@/lib/api-errors'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const user = getRequestUser(request)
    const scope = await eventScopeWhere(user)
    const where: Record<string, unknown> = { ...scope }
    if (status && status !== 'all') where.status = status
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { client: { contains: search, mode: 'insensitive' } },
      ]
    }
    const events = await db.event.findMany({ where, orderBy: { createdAt: 'desc' }, take: 500 })
    return NextResponse.json(events)
  } catch (error) {
    return handleApiError(error, 'Events GET')
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = CreateEventInput.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(formatZodIssues(parsed.error), { status: 400 })
    }
    const user = getRequestUser(request)
    if (!user.id) {
      return unauthorized()
    }
    if (user.role !== 'admin' && user.role !== 'staff') {
      return forbidden('ليس لديك صلاحية إنشاء مناسبة')
    }
    const event = await db.event.create({
      data: {
        name: parsed.data.name,
        client: parsed.data.client,
        clientPhone: parsed.data.clientPhone || '',
        date: parsed.data.date,
        time: parsed.data.time || '',
        location: parsed.data.location || '',
        status: parsed.data.status || 'preparing',
        password: parsed.data.password || '',
        notes: parsed.data.notes || '',
        hasInteractivePage: parsed.data.hasInteractivePage !== false,
        createdById: user.id,
      },
    })
    await recordAudit({
      eventId: event.id, userId: user.id, userName: await resolveRequestUserName(user),
      text: `إنشاء حدث ${event.name}`,
      entity: 'event', entityId: event.id, action: 'event_create',
      newValue: { name: event.name, date: event.date },
      ipAddress: getRequestIp(request),
    })
    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'Events POST')
  }
}
