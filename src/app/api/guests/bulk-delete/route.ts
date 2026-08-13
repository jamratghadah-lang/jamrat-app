import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, canAccessEvent, canPerformEventAction, resolveRequestUserName } from '@/lib/event-access'
import { BulkDeleteInput, formatZodIssues } from '@/lib/validation'
import { recordAudit } from '@/lib/audit'
import { getRequestIp } from '@/lib/hooks'
import { forbidden, handleApiError, unauthorized } from '@/lib/api-errors'

export async function POST(request: NextRequest) {
  try {
    const parsed = BulkDeleteInput.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(formatZodIssues(parsed.error), { status: 400 })
    }
    const user = getRequestUser(request)
    if (!user.id) {
      return unauthorized('غير مصرح')
    }
    const guests = await db.guest.findMany({ where: { id: { in: parsed.data.ids } } })
    const accessible: typeof guests = []
    for (const guest of guests) {
      if (await canAccessEvent(user, guest.eventId)) accessible.push(guest)
    }
    if (accessible.length === 0) {
      return forbidden('ليس لديك صلاحية الوصول لهؤلاء الضيوف')
    }
    for (const guest of accessible) {
      if (!(await canPerformEventAction(user, guest.eventId, 'manage'))) {
        return forbidden('ليس لديك صلاحية إدارة ضيوف إحدى المناسبات المحددة')
      }
    }
    const accessibleIds = accessible.map((g) => g.id)
    const now = new Date()

    await db.$transaction(async (tx) => {
      // PERFORMANCE (v10.8): batch trashItem inserts with createMany.
      // For a 200-guest bulk delete, this drops from 200 sequential
      // INSERTs to 1 batched INSERT.
      if (accessible.length > 0) {
        await tx.trashItem.createMany({
          data: accessible.map((guest) => ({
            eventId: guest.eventId,
            name: guest.name,
            itemType: 'guest',
            eventRef: JSON.stringify(guest),
          })),
        })
      }
      await tx.guest.updateMany({
        where: { id: { in: accessibleIds } },
        data: {
          archivedAt: now,
          qrToken: null,
          qrRevoked: true,
          qrRevokedAt: now,
          hasQR: false,
        },
      })
      // Recompute guest counts per affected event. This loop is small
      // (number of distinct events touched, not number of guests) so
      // it doesn't benefit much from batching. Each event.update must
      // be its own statement anyway (different PK).
      const eventIds = [...new Set(accessible.map((g) => g.eventId))]
      for (const eventId of eventIds) {
        const guestCount = await tx.guest.count({
          where: { eventId, archivedAt: null },
        })
        await tx.event.update({ where: { id: eventId }, data: { guests: guestCount } })
      }
    })

    await recordAudit({
      userId: user.id, userName: await resolveRequestUserName(user),
      text: `أرشفة جماعية لـ ${accessible.length} ضيف`,
      entity: 'guest', action: 'guest_bulk_archive',
      newValue: { count: accessible.length, ids: accessibleIds },
      ipAddress: getRequestIp(request),
    })

    const skipped = guests.length - accessible.length
    return NextResponse.json({
      message: `تم نقل ${accessible.length} ضيف إلى الأرشيف` + (skipped > 0 ? ` (تم تجاهل ${skipped} خارج صلاحيتك)` : ''),
    })
  } catch (error) {
    return handleApiError(error, 'Bulk archive guests error:')
  }
}
