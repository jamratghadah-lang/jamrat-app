import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, canAccessEvent, canPerformEventAction, resolveRequestUserName } from '@/lib/event-access'
import { recordAudit } from '@/lib/audit'
import { getRequestIp } from '@/lib/hooks'
import { forbidden, handleApiError, notFound } from '@/lib/api-errors'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const row = await db.scheduledMessage.findUnique({ where: { id } })
    if (!row) return notFound('غير موجود')
    const user = getRequestUser(request)
    if (!(await canAccessEvent(user, row.eventId))) {
      return forbidden('ليس لديك صلاحية الوصول لهذا الحدث')
    }
    if (!(await canPerformEventAction(user, row.eventId, 'send'))) {
      return forbidden('ليس لديك صلاحية تعديل جدولة هذه المناسبة')
    }
    await db.scheduledMessage.update({ where: { id }, data: { status: 'cancelled' } })
    await recordAudit({
      eventId: row.eventId, userId: user.id, userName: await resolveRequestUserName(user),
      text: `إلغاء رسالة مجدولة`,
      entity: 'schedule', entityId: id, action: 'schedule_cancel',
      ipAddress: getRequestIp(request),
    })
    return NextResponse.json({ message: 'تم الإلغاء' })
  } catch (error) {
    return handleApiError(error, 'Cancel schedule error:')
  }
}
