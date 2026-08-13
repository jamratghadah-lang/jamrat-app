// Public endpoint used by the mobile QR scanner to validate a token before
// the operator commits a check-in. No auth required on purpose: the
// scanner device may not be logged into the dashboard.
//
// Security model:
//   - The token is a 256-bit opaque random string, NOT the guest id.
//   - Scanners MUST post the opaque qrToken; guest ids are never accepted here.
//   - Every scan (success or failure) is recorded in QrUsage.
//   - Rate-limited per IP (120 scans / 15 min) to prevent QrUsage table
//     flooding. Token is 256-bit so brute-force is impractical, but
//     table-flooding is a real DoS vector without rate limiting.
//   - Soft-deleted guests (archivedAt set) return valid:false.

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { QrVerifyInput, formatZodIssues } from '@/lib/validation'
import { getRequestIp } from '@/lib/hooks'
import { rateLimit, getRequestIpFromRequest } from '@/lib/rate-limit'
import { handleApiError } from '@/lib/api-errors'

export async function POST(request: NextRequest) {
  // Rate limit: 120 scans per 15 min per IP. Generous enough for a
  // busy event, tight enough to prevent table-flooding.
  const ip = getRequestIpFromRequest(request)
  if (!rateLimit('qr-verify:' + ip, { max: 120, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({ error: 'تجاوزتِ عدد الطلبات المسموح. حاولي بعد 15 دقيقة.' }, { status: 429 })
  }

  try {
    const parsed = QrVerifyInput.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(formatZodIssues(parsed.error), { status: 400 })
    }
    const { qrToken } = parsed.data

    // SECURITY (v10.4): filter archivedAt so trashed guests return
    // valid:false instead of leaking their existence.
    const guest = await db.guest.findFirst({ where: { qrToken, archivedAt: null } })
    if (!guest) {
      await logUsage(qrToken, '', 'scan', false, 'الرمز غير موجود', request)
      return NextResponse.json({ valid: false, error: 'الرمز غير موجود' }, { status: 404 })
    }
    if (!guest.hasQR || guest.qrRevoked || !guest.qrToken) {
      await logUsage(qrToken, guest.eventId, 'scan', false, 'QR ملغى', request, guest.id)
      return NextResponse.json({ valid: false, error: 'رمز QR ملغى' }, { status: 403 })
    }
    if (guest.attended === 'attended') {
      await logUsage(qrToken, guest.eventId, 'scan', true, 'مسجل مسبقاً', request, guest.id)
      return NextResponse.json({
        valid: true,
        alreadyCheckedIn: true,
        guestId: guest.id,
        guestName: guest.name,
        eventId: guest.eventId,
        companions: guest.companions,
      })
    }

    await logUsage(qrToken, guest.eventId, 'scan', true, '', request, guest.id)

    return NextResponse.json({
      valid: true,
      alreadyCheckedIn: false,
      guestId: guest.id,
      guestName: guest.name,
      eventId: guest.eventId,
      companions: guest.companions,
    })
  } catch (error) {
    return handleApiError(error, 'QR verify error:')
  }
}

async function logUsage(qrToken: string, eventId: string, action: string, success: boolean, reason: string, request: NextRequest, guestId?: string) {
  try {
    if (!guestId) return
    await db.qrUsage.create({
      data: {
        guestId,
        eventId,
        action,
        success,
        reason,
        ipAddress: getRequestIp(request),
        userAgent: request.headers.get('user-agent') || '',
      },
    })
  } catch {
    /* best effort */
  }
}
