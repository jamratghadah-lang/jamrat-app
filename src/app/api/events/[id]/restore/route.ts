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
    const newStatus = ev.status === 'archived' ? 'preparing' : ev.status
    await db.event.update({ where: { id }, data: { status: newStatus } })
    await recordAudit({
      eventId: id, userId: user.id, userName: await resolveRequestUserName(user),
      text: `استرجاع حدث ${ev.name}`, entity: 'event', entityId: id,
      action: 'event_restore', newValue: { status: newStatus },
      ipAddress: getRequestIp(request),
    })
    return NextResponse.json({ message: 'تم استرجاع الحدث' })
  } catch (error) {
    return handleApiError(error, 'Restore error:')
  }
}
