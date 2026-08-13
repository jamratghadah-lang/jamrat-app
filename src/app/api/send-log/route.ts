import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, eventIdScopeWhere, canAccessEvent } from '@/lib/event-access'
import { forbidden, handleApiError } from '@/lib/api-errors'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')
    const user = getRequestUser(request)
    const scope = await eventIdScopeWhere(user)
    const where: Record<string, unknown> = { ...scope }
    if (eventId) {
      if (!(await canAccessEvent(user, eventId))) {
        return forbidden('ليس لديك صلاحية الوصول لهذا الحدث')
      }
      where.eventId = eventId
    }
    if (searchParams.get('status')) where.status = searchParams.get('status')
    const logs = await db.sendLog.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { time: 'desc' },
      take: 500,
    })
    return NextResponse.json(logs)
  } catch (error) {
    return handleApiError(error, 'Get sendLog error:')
  }
}
