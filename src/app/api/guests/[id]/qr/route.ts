import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { db } from '@/lib/db'
import { getRequestUser, canAccessEvent, canPerformEventAction, resolveRequestUserName } from '@/lib/event-access'
import { mintQrToken } from '@/lib/qr-token'
import { recordAudit } from '@/lib/audit'
import { getRequestIp } from '@/lib/hooks'
import { forbidden, handleApiError, notFound } from '@/lib/api-errors'

// Helper appended to all QR outcomes (issue / verify / revoke / scan).
async function logQrUsage(opts: {
  guestId: string
  eventId: string
  action: string
  success: boolean
  reason: string
  actorUserId: string | null
  actorName: string
  request: NextRequest
}) {
  try {
    await db.qrUsage.create({
      data: {
        guestId: opts.guestId,
        eventId: opts.eventId,
        action: opts.action,
        success: opts.success,
        reason: opts.reason,
        actorUserId: opts.actorUserId,
        actorName: opts.actorName,
        ipAddress: getRequestIp(opts.request),
        userAgent: opts.request.headers.get('user-agent') || '',
      },
    })
  } catch {
    /* best effort */
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const color = url.searchParams.get('color') || undefined
    const action = url.searchParams.get('action') || 'issue'
    const user = getRequestUser(request)
    // PERFORMANCE (v10.8): resolve the user's display name ONCE and
    // reuse it for every audit/qrUsage row in this request. Previously
    // this route called resolveRequestUserName(user) up to 4 times per
    // request (once per logQrUsage + once per recordAudit). The helper
    // caches on user.name, but the cache check is itself an await +
    // function call — resolving once is cheaper and clearer.
    const actorName = await resolveRequestUserName(user)

    const guest = await db.guest.findFirst({ where: { id } })
    if (!guest) {
      return notFound('الضيف غير موجود')
    }
    if (!(await canAccessEvent(user, guest.eventId))) {
      return forbidden('ليس لديك صلاحية الوصول لهذا الحدث')
    }

    if (action === 'revoke') {
      if (!(await canPerformEventAction(user, guest.eventId, 'manage'))) {
        return forbidden('ليس لديك صلاحية إبطال QR لهذه المناسبة')
      }
      await db.guest.update({
        where: { id },
        data: { qrRevoked: true, qrRevokedAt: new Date(), hasQR: false, qrToken: null },
      })
      await logQrUsage({
        guestId: id, eventId: guest.eventId, action: 'revoke',
        success: true, reason: '', actorUserId: user.id, actorName,
        request,
      })
      await recordAudit({
        eventId: guest.eventId,
        userId: user.id || null,
        userName: actorName,
        text: `إبطال QR للضيف ${guest.name}`,
        entity: 'guest', entityId: guest.id, action: 'qr_revoke',
        ipAddress: getRequestIp(request),
      }).catch(() => {})
      return NextResponse.json({ revoked: true, message: 'تم إبطال رمز QR' })
    }

    if (action === 'verify') {
      const valid = Boolean(guest.hasQR && !guest.qrRevoked && guest.qrToken)
      await logQrUsage({
        guestId: id, eventId: guest.eventId, action: 'verify',
        success: valid, reason: valid ? '' : 'QR غير صالح أو ملغى',
        actorUserId: user.id, actorName, request,
      })
      return NextResponse.json({
        valid,
        guestId: guest.id,
        guestName: guest.name,
        eventId: guest.eventId,
        qrToken: valid ? guest.qrToken : null,
        attended: guest.attended,
      })
    }

    // Issuing/rotating a QR changes guest security state, so only event
    // managers may do it.
    if (!(await canPerformEventAction(user, guest.eventId, 'manage'))) {
      return forbidden('ليس لديك صلاحية إصدار QR لهذه المناسبة')
    }

    // Default: issue or rotate (returns SVG QR rendered from the random token).
    // Issue a fresh token when missing or revoked. This also provides a
    // true re-generate path after an administrator has revoked a QR.
    const needsNewToken = !guest.qrToken || guest.qrRevoked
    const newToken = needsNewToken ? mintQrToken() : null
    if (newToken) {
      await db.guest.update({
        where: { id },
        data: {
          hasQR: true,
          qrToken: newToken,
          qrGeneratedAt: new Date(),
          qrRevoked: false,
          qrRevokedAt: null,
          qrColor: color || guest.qrColor || '#000000',
        },
      })
    }

    const finalToken = newToken || guest.qrToken
    if (!finalToken) {
      return NextResponse.json({ error: 'فشل توليد الرمز' }, { status: 500 })
    }

    await logQrUsage({
      guestId: id, eventId: guest.eventId, action: 'issue',
      success: true, reason: '',
      actorUserId: user.id, actorName, request,
    })

    const svgString = await QRCode.toString(finalToken, {
      type: 'svg',
      width: 256,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: color || guest.qrColor || '#000000', light: '#ffffff' },
    })

    return new NextResponse(svgString, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (error) {
    return handleApiError(error, 'Generate QR error:')
  }
}
