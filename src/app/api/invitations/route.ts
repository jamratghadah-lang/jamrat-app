// Invitation rendering. Renders a template + design snapshot for one
// guest. The design JSON is the canonical layout; the preview renderer
// later validates it. We freeze a snapshot at send time so future edits
// to the template do not retroactively change already-sent invitations.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, canAccessEvent, canPerformEventAction, resolveRequestUserName } from '@/lib/event-access'
import { recordAudit } from '@/lib/audit'
import { getRequestIp } from '@/lib/hooks'
import { mintQrToken } from '@/lib/qr-token'
import { sendWhatsAppInviteTemplate } from '@/lib/whatsapp'
import { sendEmail, buildInviteEmailHtml } from '@/lib/email'
import { SendInvitationInput, formatZodIssues } from '@/lib/validation'
import { badRequest, forbidden, handleApiError, notFound, unauthorized } from '@/lib/api-errors'

// Variables available inside {{var}} patterns.
function renderTemplate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const v = vars[key]
    return v == null ? '' : v
  })
}

function safeDesign(design: string | null | undefined): Record<string, unknown> {
  if (!design) return {}
  try {
    const parsed = JSON.parse(design)
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')
    const templateId = searchParams.get('templateId')
    const guestId = searchParams.get('guestId')
    const user = getRequestUser(request)
    if (eventId && !(await canAccessEvent(user, eventId))) {
      return forbidden('ليس لديك صلاحية الوصول لهذا الحدث')
    }
    if (!eventId) {
      return badRequest('معرف الحدث مطلوب')
    }
    const event = await db.event.findUnique({ where: { id: eventId } })
    if (!event) return notFound('الحدث غير موجود')

    const template = templateId
      ? await db.template.findFirst({ where: { id: templateId, OR: [{ eventId }, { eventId: null }] } })
      : await db.template.findFirst({ where: { type: 'invite', OR: [{ eventId }, { eventId: null }] } })
    if (!template) return notFound('القالب غير موجود أو غير مرتبط بهذه المناسبة')

    const variables: Record<string, string> = {
      guest_name: '',
      client: event.client,
      date: event.date,
      time: event.time,
      location: event.location,
      event_name: event.name,
    }

    let guest = null as Awaited<ReturnType<typeof db.guest.findFirst>>
    if (guestId) {
      guest = await db.guest.findFirst({ where: { id: guestId, eventId } })
      if (guest) variables.guest_name = guest.name
    }

    const rendered = {
      eventId,
      guestId: guest?.id || null,
      templateId: template.id,
      text: renderTemplate(template.text, variables),
      variables,
      design: safeDesign(template.design),
      snapshotAt: new Date().toISOString(),
    }

    return NextResponse.json(rendered)
  } catch (error) {
    return handleApiError(error, 'Render invitation error:')
  }
}

// "Send" is a placeholder hook. Persists a snapshot row, records audit.
// A future implementation will also POST to the Cloudinary / Resend /
// WhatsApp SDKs — currently NOT wired in this build.
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    let body: Record<string, unknown> = {}
    let uploadedFile: File | null = null

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      uploadedFile = form.get('file') instanceof File ? form.get('file') as File : null
      body = {
        eventId: form.get('eventId'),
        templateId: form.get('templateId'),
        channel: form.get('channel'),
        type: form.get('type'),
        recipientType: form.get('recipientType'),
        guestIds: (() => {
          const raw = form.get('guestIds')
          if (!raw) return undefined
          try { return JSON.parse(String(raw)) }
          catch { return undefined }
        })(),
        design: (() => {
          const raw = form.get('design')
          if (!raw) return undefined
          try { return JSON.parse(String(raw)) }
          catch { return undefined }
        })(),
      }
    } else {
      body = await request.json().catch(() => ({}))
    }

    // SECURITY (v10.6): validate the body with Zod before touching DB.
    // Allows both JSON and multipart/form-data (which we normalized
    // above into the same shape).
    const parsed = SendInvitationInput.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(formatZodIssues(parsed.error), { status: 400 })
    }
    const { eventId, templateId, recipientType, channel, type, guestIds: requestedGuestIds, design } = parsed.data

    const user = getRequestUser(request)
    if (!user.id) {
      return unauthorized('غير مصرح')
    }
    if (!(await canAccessEvent(user, eventId))) {
      return forbidden('ليس لديك صلاحية الوصول لهذا الحدث')
    }
    if (!(await canPerformEventAction(user, eventId, 'send'))) {
      return forbidden('ليس لديك صلاحية الإرسال لهذه المناسبة')
    }

    const event = await db.event.findUnique({ where: { id: eventId } })
    if (!event) return notFound('الحدث غير موجود')

    const template = templateId
      ? await db.template.findFirst({ where: { id: templateId, OR: [{ eventId }, { eventId: null }] } })
      : null

    if (templateId && !template) {
      return notFound('القالب غير موجود')
    }

    const guestWhere: Record<string, unknown> = { eventId, archivedAt: null }
    if (requestedGuestIds && requestedGuestIds.length) {
      guestWhere.id = { in: requestedGuestIds }
    } else if (recipientType === 'confirmed' || recipientType === 'unconfirmed') {
      guestWhere.confirmed = recipientType
    }

    const guests = await db.guest.findMany({ where: guestWhere })
    if (guests.length === 0) {
      return badRequest('لا يوجد ضيوف مطابقون للإرسال')
    }

    // `uploadedFile` is not persisted here — a video for the invite comes
    // from the event's MediaAsset library (Cloudinary/external URL), not
    // from a raw upload on this request. `design` is also currently not
    // persisted (the design snapshot lives in the Template row); it's
    // accepted so the editor can send it without a separate endpoint.
    void uploadedFile
    void design

    const siteUrl = (process.env.SITE_URL || '').trim().replace(/\/$/, '')
    const latestVideo = await db.mediaAsset.findFirst({
      where: { eventId, type: 'video' },
      orderBy: { createdAt: 'desc' },
      select: { url: true },
    })

    let sentCount = 0
    let failedCount = 0

    for (const guest of guests) {
      // A guest link needs a stable, non-guessable token. Reuse the
      // guest's existing qrToken if valid; mint one otherwise (this is
      // the SAME token used later for entry check-in — reissuing it
      // via /api/guests/[id]/qr after this point will invalidate this
      // RSVP link too, which is expected: a revoked/rotated QR should
      // not still work for RSVP either).
      let guestToken = guest.qrToken && !guest.qrRevoked ? guest.qrToken : null
      if (!guestToken) {
        guestToken = mintQrToken()
        await db.guest.update({
          where: { id: guest.id },
          data: { qrToken: guestToken, hasQR: true, qrGeneratedAt: new Date(), qrRevoked: false, qrRevokedAt: null },
        })
      }

      const rsvpUrl = siteUrl
        ? `${siteUrl}/rsvp?token=${guestToken}`
        : `/rsvp?token=${guestToken}`

      const wantsWhatsapp = channel === 'whatsapp' || channel === 'both'
      const wantsEmail = channel === 'email' || channel === 'both'

      const results: Array<{ ch: 'whatsapp' | 'email'; ok: boolean; error?: string }> = []

      if (wantsWhatsapp) {
        if (!guest.phone) {
          results.push({ ch: 'whatsapp', ok: false, error: 'لا يوجد رقم واتساب لهذه المدعوة' })
        } else {
          const r = await sendWhatsAppInviteTemplate({
            to: guest.phone,
            guestId: guest.id,
            guestName: guest.name,
            eventName: event.name,
            videoUrl: latestVideo?.url,
          })
          results.push({ ch: 'whatsapp', ok: r.ok, error: r.error })
        }
      }

      if (wantsEmail) {
        if (!guest.email) {
          results.push({ ch: 'email', ok: false, error: 'لا يوجد بريد إلكتروني لهذه المدعوة' })
        } else {
          const r = await sendEmail({
            to: guest.email,
            subject: `دعوة — ${event.name}`,
            html: buildInviteEmailHtml({
              guestName: guest.name,
              eventName: event.name,
              date: event.date,
              time: event.time,
              location: event.location,
              videoUrl: latestVideo?.url,
              rsvpUrl,
            }),
          })
          results.push({ ch: 'email', ok: r.ok, error: r.error })
        }
      }

      const allOk = results.length > 0 && results.every((r) => r.ok)
      const anyOk = results.some((r) => r.ok)
      if (allOk) sentCount++
      else failedCount++

      await db.$transaction(async (tx) => {
        for (const r of results) {
          await tx.sendLog.create({
            data: {
              eventId,
              guestId: guest.id,
              recipient: r.ch === 'whatsapp' ? guest.phone : guest.email,
              type,
              channel: r.ch,
              status: r.ok ? 'sent' : 'failed',
              failReason: r.ok ? '' : (r.error || 'فشل الإرسال'),
            },
          })
        }
        await tx.guest.update({
          where: { id: guest.id },
          data: { sendStatus: anyOk ? 'sent' : 'failed' },
        })
      })
    }

    await recordAudit({
      eventId,
      userId: user.id, userName: await resolveRequestUserName(user),
      text: `إرسال ${guests.length} دعوة (${sentCount} نجح، ${failedCount} فشل)`,
      entity: 'invitation', action: 'invitation_send',
      newValue: { total: guests.length, sent: sentCount, failed: failedCount, channel, type, templateId },
      ipAddress: getRequestIp(request),
    })

    return NextResponse.json({
      message: `تم الإرسال: ${sentCount} نجح${failedCount ? `، ${failedCount} فشل` : ''} من أصل ${guests.length}`,
      total: guests.length,
      sent: sentCount,
      failed: failedCount,
    })
  } catch (error) {
    return handleApiError(error, 'Send invitation error:')
  }
}
