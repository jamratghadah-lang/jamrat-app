// Public RSVP submission. No login required — a guest reaches this
// either through a personal token link (WhatsApp/QR) or an
// eventId + password link (email). Authorization mirrors GET
// /api/public exactly, so the same link that can *view* the invite
// is the only link that can *answer* it.
//
// SECURITY (v10.4): rate-limited per IP (30 submissions / 15 min) to
// prevent brute-forcing event passwords and RSVP spam. Also checks
// guest.archivedAt so a soft-deleted guest's token can't be used.
// SECURITY (v10.6): event-password comparison is now constant-time.
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { db } from '@/lib/db'
import { PublicRsvpInput, formatZodIssues } from '@/lib/validation'
import { confirmGuestRsvp, RsvpError } from '@/lib/rsvp'
import { getRequestIp } from '@/lib/hooks'
import { rateLimit, getRequestIpFromRequest } from '@/lib/rate-limit'
import { badRequest, forbidden, handleApiError, notFound } from '@/lib/api-errors'

/**
 * Constant-time string comparison — see /api/public/route.ts for the
 * rationale. Avoids leaking the event password through response-timing
 * differences.
 */
function safeStringEqual(a: string, b: string): boolean {
  if (!a || !b) return a === b
  const aBuf = Buffer.from(a, 'utf8')
  const bBuf = Buffer.from(b, 'utf8')
  const len = Math.max(aBuf.length, bBuf.length)
  const aPadded = Buffer.alloc(len)
  const bPadded = Buffer.alloc(len)
  aBuf.copy(aPadded)
  bBuf.copy(bPadded)
  return crypto.timingSafeEqual(aPadded, bPadded)
}

export async function POST(request: NextRequest) {
  // Rate limit: 30 submissions per 15 min per IP. Prevents password
  // brute-forcing (the eventId+guestId+password path) and RSVP spam.
  const ip = getRequestIpFromRequest(request)
  if (!rateLimit('rsvp:' + ip, { max: 30, windowMs: 15 * 60 * 1000 })) {
    return NextResponse.json({ error: 'تجاوزتِ عدد الطلبات المسموح. حاولي بعد 15 دقيقة.' }, { status: 429 })
  }

  try {
    const parsed = PublicRsvpInput.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(formatZodIssues(parsed.error), { status: 400 })
    }
    const { token, eventId, guestId, password, response, companions } = parsed.data

    if (!token && !(eventId && guestId)) {
      return badRequest('رابط غير صالح')
    }

    // Resolve + authorize exactly like GET /api/public.
    let guest = null as Awaited<ReturnType<typeof db.guest.findFirst>>
    if (token) {
      // SECURITY (v10.4): filter archivedAt so a trashed guest's token
      // can't be used to submit RSVPs.
      guest = await db.guest.findFirst({ where: { qrToken: token, qrRevoked: false, archivedAt: null } })
      if (!guest) return forbidden('الرابط غير صالح أو منتهي')
    } else if (guestId && eventId) {
      const event = await db.event.findUnique({ where: { id: eventId }, select: { password: true } })
      if (!event) return notFound('المناسبة غير موجودة')
      // SECURITY (v10.6): constant-time comparison — see note above.
      const authorized = !!event.password && safeStringEqual(password || '', event.password)
      if (!authorized) return forbidden('غير مصرح')
      // SECURITY: filter archivedAt here too.
      guest = await db.guest.findFirst({ where: { id: guestId, eventId, archivedAt: null } })
      if (!guest) return notFound('الضيف غير موجود')
    }

    if (!guest) return notFound('الضيف غير موجود')
    if (token && eventId && guest.eventId !== eventId) {
      return badRequest('الرابط لا يطابق هذه المناسبة')
    }

    const result = await confirmGuestRsvp({
      guestId: guest.id,
      response,
      companions,
      channel: 'web',
      ipAddress: getRequestIp(request),
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof RsvpError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return handleApiError(error, 'Public RSVP')
  }
}
