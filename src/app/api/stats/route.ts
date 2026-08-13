import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, eventIdScopeWhere, eventScopeWhere } from '@/lib/event-access'
import { handleApiError, notFound } from '@/lib/api-errors'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')
    const user = getRequestUser(request)
    const eventScope = await eventScopeWhere(user)
    const guestScope = await eventIdScopeWhere(user)

    if (eventId) {
      const eventMatch = await db.event.findFirst({
        where: { AND: [eventScope, { id: eventId }] },
        select: { id: true },
      })
      if (!eventMatch) return notFound('الحدث غير موجود أو خارج صلاحيتك')

      const guestsWhere = { ...guestScope, eventId, archivedAt: null }
      const [totalGuests, confirmedGuests, unconfirmedGuests, attendedGuests, totalCompanions, qrGenerated, totalEvents, activeEvents, whatsappSent, whatsappFailed, emailSent, emailFailed] = await Promise.all([
        db.guest.count({ where: guestsWhere }),
        db.guest.count({ where: { ...guestsWhere, confirmed: 'confirmed' } }),
        db.guest.count({ where: { ...guestsWhere, confirmed: { not: 'confirmed' } } }),
        db.checkin.count({ where: { eventId } }),
        db.guest.aggregate({ where: guestsWhere, _sum: { companions: true } }).then(r => r._sum.companions || 0),
        db.guest.count({ where: { ...guestsWhere, hasQR: true, qrRevoked: false } }),
        db.event.count({ where: { AND: [eventScope, { id: eventId }] } }),
        db.event.count({ where: { AND: [eventScope, { id: eventId, status: 'active' }] } }),
        db.sendLog.count({ where: { eventId, channel: { in: ['whatsapp', 'both'] }, status: 'sent' } }),
        db.sendLog.count({ where: { eventId, channel: { in: ['whatsapp', 'both'] }, status: 'failed' } }),
        db.sendLog.count({ where: { eventId, channel: { in: ['email', 'both'] }, status: 'sent' } }),
        db.sendLog.count({ where: { eventId, channel: { in: ['email', 'both'] }, status: 'failed' } }),
      ])

      const confirmationRate = totalGuests > 0 ? (confirmedGuests / totalGuests) * 100 : 0
      const attendanceRate = totalGuests > 0 ? (attendedGuests / totalGuests) * 100 : 0
      const qrUsageRate = totalGuests > 0 ? (qrGenerated / totalGuests) * 100 : 0
      const whatsappTotal = whatsappSent + whatsappFailed
      const whatsappSuccessRate = whatsappTotal > 0 ? (whatsappSent / whatsappTotal) * 100 : 0
      const emailTotal = emailSent + emailFailed
      const emailSuccessRate = emailTotal > 0 ? (emailSent / emailTotal) * 100 : 0

      return NextResponse.json({
        totalEvents,
        activeEvents,
        upcomingEvents: 0,
        totalGuests,
        confirmedGuests,
        confirmed: confirmedGuests,
        unconfirmedGuests,
        unconfirmed: unconfirmedGuests,
        attendedGuests,
        attended: attendedGuests,
        absentGuests: Math.max(0, totalGuests - attendedGuests),
        absent: Math.max(0, totalGuests - attendedGuests),
        totalCompanions,
        companions: totalCompanions,
        qrGenerated,
        // Real percentage rates (computed from live DB data)
        confirmationRate: Math.round(confirmationRate * 10) / 10,
        attendanceRate: Math.round(attendanceRate * 10) / 10,
        qrUsageRate: Math.round(qrUsageRate * 10) / 10,
        whatsappSuccessRate: Math.round(whatsappSuccessRate * 10) / 10,
        emailSuccessRate: Math.round(emailSuccessRate * 10) / 10,
        whatsappSent,
        whatsappFailed,
        emailSent,
        emailFailed,
        eventId,
        source: 'derivation',
      })
    }

    const guestsWhere = { ...guestScope, archivedAt: null }
    const [totalGuests, confirmedGuests, unconfirmedGuests, attendedGuests, totalCompanions, qrGenerated, totalEvents, activeEvents, whatsappSent, whatsappFailed, emailSent, emailFailed] = await Promise.all([
      db.guest.count({ where: guestsWhere }),
      db.guest.count({ where: { ...guestsWhere, confirmed: 'confirmed' } }),
      db.guest.count({ where: { ...guestsWhere, confirmed: { not: 'confirmed' } } }),
      db.checkin.count({ where: guestScope }),
      db.guest.aggregate({ where: guestsWhere, _sum: { companions: true } }).then(r => r._sum.companions || 0),
      db.guest.count({ where: { ...guestsWhere, hasQR: true, qrRevoked: false } }),
      db.event.count({ where: eventScope }),
      db.event.count({ where: { ...eventScope, status: 'active' } }),
      db.sendLog.count({ where: { ...guestScope, channel: { in: ['whatsapp', 'both'] }, status: 'sent' } }),
      db.sendLog.count({ where: { ...guestScope, channel: { in: ['whatsapp', 'both'] }, status: 'failed' } }),
      db.sendLog.count({ where: { ...guestScope, channel: { in: ['email', 'both'] }, status: 'sent' } }),
      db.sendLog.count({ where: { ...guestScope, channel: { in: ['email', 'both'] }, status: 'failed' } }),
    ])

    const confirmationRate = totalGuests > 0 ? (confirmedGuests / totalGuests) * 100 : 0
    const attendanceRate = totalGuests > 0 ? (attendedGuests / totalGuests) * 100 : 0
    const qrUsageRate = totalGuests > 0 ? (qrGenerated / totalGuests) * 100 : 0
    const whatsappTotal = whatsappSent + whatsappFailed
    const whatsappSuccessRate = whatsappTotal > 0 ? (whatsappSent / whatsappTotal) * 100 : 0
    const emailTotal = emailSent + emailFailed
    const emailSuccessRate = emailTotal > 0 ? (emailSent / emailTotal) * 100 : 0

    return NextResponse.json({
      totalEvents,
      activeEvents,
      upcomingEvents: Math.max(0, totalEvents - activeEvents),
      totalGuests,
      confirmedGuests,
      confirmed: confirmedGuests,
      unconfirmedGuests,
      unconfirmed: unconfirmedGuests,
      attendedGuests,
      attended: attendedGuests,
      absentGuests: Math.max(0, totalGuests - attendedGuests),
      absent: Math.max(0, totalGuests - attendedGuests),
      totalCompanions,
      companions: totalCompanions,
      qrGenerated,
      // Real percentage rates (computed from live DB data)
      confirmationRate: Math.round(confirmationRate * 10) / 10,
      attendanceRate: Math.round(attendanceRate * 10) / 10,
      qrUsageRate: Math.round(qrUsageRate * 10) / 10,
      whatsappSuccessRate: Math.round(whatsappSuccessRate * 10) / 10,
      emailSuccessRate: Math.round(emailSuccessRate * 10) / 10,
      whatsappSent,
      whatsappFailed,
      emailSent,
      emailFailed,
      source: 'derivation',
    })
  } catch (error) {
    return handleApiError(error, 'Stats error:')
  }
}
