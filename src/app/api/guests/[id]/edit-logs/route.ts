import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, canAccessEvent, canPerformEventAction } from '@/lib/event-access'
import { forbidden, handleApiError, notFound } from '@/lib/api-errors'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const guest = await db.guest.findUnique({ where: { id } })
    if (!guest) return notFound('الضيف غير موجود')
    const user = getRequestUser(request)
    if (!(await canAccessEvent(user, guest.eventId))) {
      return forbidden('ليس لديك صلاحية الوصول لهذا الحدث')
    }
    if (!(await canPerformEventAction(user, guest.eventId, 'manage'))) {
      return forbidden('ليس لديك صلاحية عرض سجل تعديلات الضيوف لهذه المناسبة')
    }
    const logs = await db.guestEditLog.findMany({ where: { guestId: id }, orderBy: { time: 'desc' } })
    return NextResponse.json(logs)
  } catch (error) {
    return handleApiError(error, 'Guest edit logs error:')
  }
}
