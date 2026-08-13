import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, canAccessTrashItem, canPerformEventAction, resolveRequestUserName } from '@/lib/event-access'
import { recordAudit } from '@/lib/audit'
import { getRequestIp } from '@/lib/hooks'
import { badRequest, forbidden, handleApiError, notFound } from '@/lib/api-errors'

export async function POST(
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

    if (item.itemType === 'guest') {
      // Restore a soft-deleted guest. NOTE (v10.4): the previous code
      // had a data inconsistency — it cleared qrRevoked but did NOT
      // re-mint the qrToken (which was nulled during soft-delete) or
      // reset hasQR (still false). The restored guest was in an
      // inconsistent state: qrRevoked=false but qrToken=null and
      // hasQR=false. Now we explicitly mark the restored guest as
      // QR-less so the operator must re-issue QR if needed.
      let payload: { id?: string; name?: string; phone?: string; email?: string; companions?: number } = {}
      try { payload = JSON.parse(item.eventRef) } catch { /* ignore */ }

      // Use payload.id if present (the guest's original id), else fall back to item.id.
      // (item.id is the trash row id, NOT the guest id — using it would
      // throw a foreign-key error. The previous code had this bug too.)
      const guestId = payload.id
      if (!guestId) {
        return badRequest('معرف الضيف غير موجود ببيانات الاسترجاع')
      }

      const restore = await db.guest.update({
        where: { id: guestId },
        data: {
          archivedAt: null,
          // QR state: explicitly set to "no QR issued". The soft-delete
          // path nulls qrToken and sets hasQR=false, qrRevoked=true.
          // On restore, we clear qrRevoked (so the guest CAN get a new
          // QR issued) but keep hasQR=false and qrToken=null until the
          // operator re-issues one. This is the consistent state.
          qrRevoked: false,
          qrRevokedAt: null,
          hasQR: false,
          qrToken: null,
        },
      }).catch(() => null)

      if (!restore) {
        // Guest row was truly lost (e.g. hard-deleted earlier); recreate from snapshot.
        if (!payload.name || !item.eventId) {
          return badRequest('بيانات الاسترجاع غير مكتملة')
        }
        const created = await db.guest.create({
          data: {
            eventId: item.eventId,
            name: String(payload.name || '').trim(),
            phone: String(payload.phone || '').trim(),
            email: String(payload.email || '').trim(),
            companions: Number(payload.companions || 0),
          },
        })
        await db.event.update({ where: { id: item.eventId }, data: { guests: { increment: 1 } } }).catch(() => {})
        await db.trashItem.delete({ where: { id } })
        await recordAudit({
          eventId: item.eventId, userId: user.id, userName: await resolveRequestUserName(user),
          text: `استرجاع ضيف ${created.name} (إنشاء جديد)`,
          entity: 'guest', entityId: created.id, action: 'guest_restore',
          ipAddress: getRequestIp(request),
        })
        return NextResponse.json({ message: 'تم استرجاع الضيف', guest: created })
      }

      // Recompute guest count for the event.
      const guestCount = await db.guest.count({ where: { eventId: item.eventId!, archivedAt: null } }).catch(() => 0)
      await db.event.update({
        where: { id: item.eventId! },
        data: { guests: guestCount },
      }).catch(() => {})
      await db.trashItem.delete({ where: { id } })
      await recordAudit({
        eventId: item.eventId, userId: user.id, userName: await resolveRequestUserName(user),
        text: `استرجاع ضيف ${restore.name}`,
        entity: 'guest', entityId: restore.id, action: 'guest_restore',
        ipAddress: getRequestIp(request),
      })
      return NextResponse.json({ message: 'تم استرجاع الضيف — يجب إعادة إصدار QR إذا لزم' })
    }

    if (item.itemType === 'event' && item.eventRef) {
      try {
        const ref = JSON.parse(item.eventRef) as { id: string; name: string; status?: string }
        await db.event.update({ where: { id: ref.id }, data: { status: ref.status || 'preparing' } })
        await db.trashItem.delete({ where: { id } })
        await recordAudit({
          eventId: ref.id, userId: user.id, userName: await resolveRequestUserName(user),
          text: `استرجاع حدث ${ref.name}`,
          entity: 'event', entityId: ref.id, action: 'event_restore',
          ipAddress: getRequestIp(request),
        })
        return NextResponse.json({ message: 'تم استرجاع الحدث' })
      } catch {
        return badRequest('بيانات الاسترجاع تالفة')
      }
    }

    // Unknown / other item types: just drop the trash row.
    await db.trashItem.delete({ where: { id } })
    await recordAudit({
      userId: user.id, userName: await resolveRequestUserName(user),
      text: `استرجاع عنصر من السلة (${item.itemType})`,
      entity: 'trash', entityId: id, action: 'trash_restore',
      ipAddress: getRequestIp(request),
    })
    return NextResponse.json({ message: 'تم الاسترجاع' })
  } catch (error) {
    return handleApiError(error, 'Trash restore error:')
  }
}
