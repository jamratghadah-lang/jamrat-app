// Shared RSVP confirmation logic. Both the public web page
// (/api/public/rsvp) and the WhatsApp webhook (/api/webhooks/whatsapp)
// call this so the two channels can never drift out of sync — one
// place updates the guest, recomputes the event counter, and writes
// the audit trail.

import { db } from './db'
import { recordAudit } from './audit'

export type RsvpResponse = 'confirmed' | 'unconfirmed'

export interface ConfirmGuestRsvpParams {
  guestId: string
  response: RsvpResponse
  companions?: number
  channel: 'web' | 'whatsapp'
  ipAddress?: string
}

export interface ConfirmGuestRsvpResult {
  ok: true
  guestName: string
  eventId: string
  response: RsvpResponse
  companions: number
}

export class RsvpError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.status = status
  }
}

export async function confirmGuestRsvp(
  params: ConfirmGuestRsvpParams,
): Promise<ConfirmGuestRsvpResult> {
  const guest = await db.guest.findFirst({ where: { id: params.guestId } })
  if (!guest || guest.archivedAt) {
    throw new RsvpError('الضيف غير موجود', 404)
  }

  // Companions only make sense on a "confirmed" response. A decline
  // always resets the count so stale data from a prior answer can't
  // linger and confuse the headcount.
  const companions =
    params.response === 'confirmed' ? Math.max(0, Math.min(50, params.companions ?? guest.companions ?? 0)) : 0

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.guest.update({
      where: { id: guest.id },
      data: { confirmed: params.response, companions },
    })

    await tx.guestEditLog.create({
      data: {
        guestId: guest.id,
        eventId: guest.eventId,
        field: 'confirmed',
        oldValue: guest.confirmed,
        newValue: params.response,
        user: params.channel === 'whatsapp' ? 'الضيف (واتساب)' : 'الضيف (صفحة التأكيد)',
      },
    })

    await tx.qrUsage.create({
      data: {
        guestId: guest.id,
        eventId: guest.eventId,
        action: 'rsvp',
        success: true,
        reason: `${params.response}${params.response === 'confirmed' ? `:companions=${companions}` : ''}`,
        actorName: params.channel === 'whatsapp' ? 'واتساب' : 'صفحة التأكيد',
        ipAddress: params.ipAddress || '',
      },
    })

    const confirmedCount = await tx.guest.count({
      where: { eventId: guest.eventId, confirmed: 'confirmed', archivedAt: null },
    })
    await tx.event.update({ where: { id: guest.eventId }, data: { confirmed: confirmedCount } })

    return result
  })

  await recordAudit({
    eventId: guest.eventId,
    text: `${params.response === 'confirmed' ? 'تأكيد حضور' : 'اعتذار'} من ${guest.name} عبر ${params.channel === 'whatsapp' ? 'واتساب' : 'صفحة التأكيد'}`,
    entity: 'guest',
    entityId: guest.id,
    action: 'guest_rsvp',
    oldValue: guest.confirmed,
    newValue: params.response,
    ipAddress: params.ipAddress || '',
  })

  return {
    ok: true,
    guestName: updated.name,
    eventId: updated.eventId,
    response: params.response,
    companions,
  }
}
