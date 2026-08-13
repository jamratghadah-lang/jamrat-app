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
    // PERFORMANCE (v10.8): resolve the display name ONCE — previously
    // this route called resolveRequestUserName twice (once for qrUsage,
    // once for recordAudit).
    const actorName = await resolveRequestUserName(user)

    const guest = await db.guest.findUnique({ where: { id } })
    if (!guest) {
      return notFound('الضيف غير موجود')
    }
    if (!(await canAccessEvent(user, guest.eventId))) {
      return forbidden('ليس لديك صلاحية الوصول لهذا الحدث')
    }
    if (!(await canPerformEventAction(user, guest.eventId, 'manage'))) {
      return forbidden('ليس لديك صلاحية إبطال QR لهذه المناسبة')
    }

    // Revoke: drop the token too so any printed QR is dead.
    await db.guest.update({
      where: { id },
      data: {
        qrRevoked: true,
        qrRevokedAt: new Date(),
        hasQR: false,
        qrToken: null,
      },
    })

    await db.qrUsage.create({
      data: {
        guestId: id,
        eventId: guest.eventId,
        action: 'revoke',
        success: true,
        reason: '',
        actorUserId: user.id,
        actorName,
        ipAddress: getRequestIp(request),
      },
    })

    await recordAudit({
      eventId: guest.eventId,
      userId: user.id || null,
      userName: actorName,
      text: `إبطال QR للضيف ${guest.name}`,
      entity: 'guest',
      entityId: guest.id,
      action: 'qr_revoke',
      ipAddress: getRequestIp(request),
    })

    return NextResponse.json({ revoked: true, message: 'تم إبطال رمز QR' })
  } catch (error) {
    return handleApiError(error, 'Revoke QR error:')
  }
}
