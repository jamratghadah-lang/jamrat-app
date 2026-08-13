import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, canAccessEvent, canPerformEventAction, resolveRequestUserName } from '@/lib/event-access'
import { recordAudit } from '@/lib/audit'
import { getRequestIp } from '@/lib/hooks'
import { forbidden, handleApiError, notFound } from '@/lib/api-errors'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = getRequestUser(request)
    if (!(await canAccessEvent(user, id))) {
      return forbidden('ليس لديك صلاحية الوصول لهذا الحدث')
    }
    if (!(await canPerformEventAction(user, id, 'manage'))) {
      return forbidden('ليس لديك صلاحية إدارة هذه المناسبة')
    }
    const ev = await db.event.findUnique({ where: { id } })
    if (!ev) return notFound('الحدث غير موجود')
    await db.event.update({ where: { id }, data: { status: 'ended' } })
    await recordAudit({
      eventId: id, userId: user.id, userName: await resolveRequestUserName(user),
      text: `إغلاق حدث ${ev.name}`, entity: 'event', entityId: id,
      action: 'event_close', ipAddress: getRequestIp(request),
    })
    return NextResponse.json({ message: 'تم إغلاق الحدث' })
  } catch (error) {
    return handleApiError(error, 'Close error:')
  }
}
