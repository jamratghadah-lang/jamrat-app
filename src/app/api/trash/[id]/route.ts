import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, canAccessTrashItem, canPerformEventAction, resolveRequestUserName } from '@/lib/event-access'
import { recordAudit } from '@/lib/audit'
import { getRequestIp } from '@/lib/hooks'
import { forbidden, handleApiError, notFound } from '@/lib/api-errors'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const item = await db.trashItem.findUnique({ where: { id } })
    if (!item) return notFound('غير موجود')
    const user = getRequestUser(request)
    if (!(await canAccessTrashItem(user, item))) {
      return forbidden('ليس لديك صلاحية الوصول لهذا العنصر')
    }
    if (user.role !== 'admin' && item.eventId && !(await canPerformEventAction(user, item.eventId, 'manage'))) {
      return forbidden('ليس لديك صلاحية إدارة سلة هذه المناسبة')
    }
    if (user.role !== 'admin' && item.itemType === 'event' && !item.eventId && item.createdById !== user.id) {
      return forbidden('ليس لديك صلاحية استرجاع هذا العنصر')
    }
    await db.trashItem.delete({ where: { id } })
    // AUDIT (v10.4): permanent deletion is irreversible — must be
    // recorded so the operator can be held accountable.
    await recordAudit({
      eventId: item.eventId, userId: user.id, userName: await resolveRequestUserName(user),
      text: `حذف نهائي من السلة: ${item.name} (${item.itemType})`,
      entity: 'trash', entityId: id, action: 'trash_permanent_delete',
      oldValue: { name: item.name, itemType: item.itemType },
      ipAddress: getRequestIp(request),
    })
    return NextResponse.json({ message: 'تم الحذف النهائي' })
  } catch (error) {
    return handleApiError(error, 'Trash delete error:')
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const item = await db.trashItem.findUnique({ where: { id } })
    if (!item) return notFound('غير موجود')
    const user = getRequestUser(request)
    if (!(await canAccessTrashItem(user, item))) {
      return forbidden('ليس لديك صلاحية الوصول لهذا العنصر')
    }
    return NextResponse.json(item)
  } catch (error) {
    return handleApiError(error, 'Trash item error:')
  }
}
