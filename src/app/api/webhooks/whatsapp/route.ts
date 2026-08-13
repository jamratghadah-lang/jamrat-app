// WhatsApp Cloud API webhook.
//
// GET  — Meta's one-time subscription verification handshake.
// POST — incoming events. We only act on interactive button replies
//        whose id we control (see RSVP_YES / RSVP_NO / RSVP_COMP
//        below — those ids are the "payload" we set when the invite
//        template or the follow-up buttons are sent). Anything else
//        (plain text, media, statuses) is acknowledged and ignored.
//
// Button id scheme:
//   RSVP_YES:<guestId>          guest tapped "سأحضر"
//   RSVP_NO:<guestId>           guest tapped "أعتذر"
//   RSVP_COMP:<guestId>:<n>     guest tapped a companion-count button

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { confirmGuestRsvp, RsvpError } from '@/lib/rsvp'
import { sendWhatsAppButtons, sendWhatsAppText } from '@/lib/whatsapp'
import { getRequestIp } from '@/lib/hooks'

// Verifies Meta's `X-Hub-Signature-256` header: HMAC-SHA256 of the raw
// (unparsed) request body, keyed with the app secret, hex-encoded and
// prefixed with "sha256=". This is the only thing standing between
// this endpoint and anyone who can guess/enumerate a guestId — without
// it, a POST here doesn't have to come from WhatsApp at all.
//
// Deliberately fail-closed in EVERY environment (not just when
// NODE_ENV === 'production'): relying on NODE_ENV being set correctly
// is itself a common source of accidental exposure on PaaS platforms
// that don't set it by default. If you need to test locally without a
// real Meta app, set WHATSAPP_APP_SECRET to any value in your local
// .env and sign your test payloads with it.
function isValidMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader || !appSecret) return false
  const prefix = 'sha256='
  if (!signatureHeader.startsWith(prefix)) return false
  const expectedHex = crypto.createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')
  const expected = Buffer.from(prefix + expectedHex)
  const supplied = Buffer.from(signatureHeader)
  if (expected.length !== supplied.length) return false
  return crypto.timingSafeEqual(expected, supplied)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim()
  if (mode === 'subscribe' && verifyToken && token === verifyToken) {
    return new NextResponse(challenge || '', { status: 200 })
  }
  return NextResponse.json({ error: 'فشل التحقق' }, { status: 403 })
}

interface WhatsAppWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        messages?: Array<{
          from?: string
          type?: string
          interactive?: {
            type?: string
            button_reply?: { id?: string; title?: string }
          }
        }>
      }
    }>
  }>
}

export async function POST(request: NextRequest) {
  // Verify this actually came from Meta before touching anything —
  // otherwise anyone who can guess a guestId can POST here directly
  // (no WhatsApp involved) and confirm/cancel that guest's RSVP.
  const rawBody = await request.text()
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim()
  if (!appSecret) {
    // Missing config is an operator error, not attack traffic — surface
    // it loudly (503) so it's caught during setup instead of silently
    // accepting/dropping every RSVP forever.
    console.error('WhatsApp webhook: WHATSAPP_APP_SECRET is not configured — rejecting all events until it is set.')
    return NextResponse.json({ error: 'الخدمة غير مهيأة' }, { status: 503 })
  }
  const signature = request.headers.get('X-Hub-Signature-256')
  if (!isValidMetaSignature(rawBody, signature, appSecret)) {
    // An invalid signature means this request didn't come from Meta —
    // don't process it, but still answer 200 (not 401) so we don't
    // hand a forged-request sender a distinguishing signal, and to
    // match Meta's own "always ack quickly" guidance below.
    console.warn('WhatsApp webhook: invalid or missing X-Hub-Signature-256 — ignoring.')
    return NextResponse.json({ received: true })
  }

  // Always 200 quickly from here on — Meta retries aggressively on
  // non-2xx, and a malformed or irrelevant (but authentic) event
  // should never surface as our error.
  let body: WhatsAppWebhookPayload = {}
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ received: true })
  }

  const ipAddress = getRequestIp(request)
  const messages = body.entry?.flatMap((e) => e.changes?.flatMap((c) => c.value?.messages || []) || []) || []

  for (const message of messages) {
    const buttonId = message.interactive?.button_reply?.id
    const from = message.from
    if (!buttonId || message.type !== 'interactive' || !from) continue

    try {
      if (buttonId.startsWith('RSVP_YES:') || buttonId.startsWith('RSVP_NO:')) {
        const [, guestId] = buttonId.split(':')
        const response = buttonId.startsWith('RSVP_YES:') ? 'confirmed' : 'unconfirmed'

        if (response === 'unconfirmed') {
          const result = await confirmGuestRsvp({ guestId, response, channel: 'whatsapp', ipAddress })
          await sendWhatsAppText(from, `تم استلام اعتذاركم، شكرًا لإخبارنا يا ${result.guestName} 🌸`)
        } else {
          // Confirm now with companions=0, then ask how many are coming.
          // The follow-up buttons carry the guestId again so the second
          // tap needs no server-side "conversation state" at all.
          const result = await confirmGuestRsvp({ guestId, response, companions: 0, channel: 'whatsapp', ipAddress })
          await sendWhatsAppButtons(from, `يسعدنا حضوركم يا ${result.guestName} 🌟 كم عدد المرافقين معكم؟`, [
            { id: `RSVP_COMP:${guestId}:0`, title: 'بدون مرافقين' },
            { id: `RSVP_COMP:${guestId}:1`, title: 'مرافق واحد' },
            { id: `RSVP_COMP:${guestId}:2`, title: 'مرافقان أو أكثر' },
          ])
        }
      } else if (buttonId.startsWith('RSVP_COMP:')) {
        const [, guestId, countRaw] = buttonId.split(':')
        const companions = Math.max(0, Math.min(50, parseInt(countRaw, 10) || 0))
        const result = await confirmGuestRsvp({
          guestId,
          response: 'confirmed',
          companions,
          channel: 'whatsapp',
          ipAddress,
        })
        await sendWhatsAppText(from, `تم تأكيد حضوركم يا ${result.guestName}، بانتظاركم 🎉`)
      }
    } catch (error) {
      if (error instanceof RsvpError) {
        await sendWhatsAppText(from, 'تعذر تسجيل ردكم، الرجاء التواصل معنا مباشرة.')
      } else {
        console.error('WhatsApp webhook RSVP error:', error)
      }
    }
  }

  return NextResponse.json({ received: true })
}
