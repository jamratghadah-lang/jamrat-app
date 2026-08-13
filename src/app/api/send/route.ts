// Send endpoint. Placeholder: queues SendLog rows with status=pending.
// Cloudinary / WhatsApp / Resend are intentionally NOT wired in this
// build - those live behind future-ready UI only.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, canAccessEvent, canPerformEventAction, resolveRequestUserName } from '@/lib/event-access'
import { recordAudit } from '@/lib/audit'
import { getRequestIp } from '@/lib/hooks'
import { SendMessageInput, formatZodIssues } from '@/lib/validation'
import { badRequest, forbidden, handleApiError, unauthorized } from '@/lib/api-errors'

export async function POST(request: NextRequest) {
  try {
    const parsed = SendMessageInput.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(formatZodIssues(parsed.error), { status: 400 })
    }
    const { eventId, channel, type, guestIds } = parsed.data
    const user = getRequestUser(request)
    if (!user.id) {
      return unauthorized('غير مصرح')
    }
    if (!(await canAccessEvent(user, eventId))) {
      return forbidden('ليس لديك صلاحية الوصول لهذا الحدث')
    }
    if (!(await canPerformEventAction(user, eventId, 'send'))) return forbidden('ليس لديك صلاحية الإرسال لهذه المناسبة')
    // SECURITY (v10.4): filter archivedAt so sends can't be queued for
    // trashed guests (would create orphan SendLog rows).
    const guests = await db.guest.findMany({ where: { id: { in: guestIds }, eventId, archivedAt: null } })
    if (guests.length === 0) {
      return badRequest('لا يوجد ضيوف متطابقون')
    }

    // PERFORMANCE (v10.8): batch the SendLog inserts into a single
    // createMany instead of one create() per guest inside a loop. For
    // a 200-guest send, this drops from 200 sequential INSERT round-trips
    // to 1 INSERT … VALUES (…), (…), … round-trip. Same transaction
    // semantics — if any row fails, the whole batch rolls back.
    await db.$transaction(async (tx) => {
      await tx.sendLog.createMany({
        data: guests.map((g) => ({
          eventId,
          guestId: g.id,
          recipient: g.phone || g.email || '',
          type,
          channel,
          status: 'pending' as const,
          failReason: 'الدمج مع مزود الإرسال لم يكتمل بعد',
        })),
      })
    })

    await recordAudit({
      eventId,
      userId: user.id, userName: await resolveRequestUserName(user),
      text: `تجهيز إرسال لـ ${guests.length} ضيف عبر ${channel}`,
      entity: 'event', entityId: eventId, action: 'send_queue',
      newValue: { count: guests.length, channel, type },
      ipAddress: getRequestIp(request),
    })
    return NextResponse.json({
      message: `${guests.length} دعوة في انتظار التوصيل (placeholder)`,
      queued: guests.length,
    })
  } catch (error) {
    return handleApiError(error, 'Send error:')
  }
}
