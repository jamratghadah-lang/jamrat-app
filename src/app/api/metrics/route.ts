// Metrics endpoint (admin-only).
//
// GET /api/metrics — returns aggregate system metrics for monitoring
// dashboards. Not Prometheus-compatible (that would require a separate
// instrumentation library) — this is a simple JSON snapshot of:
//   - User counts by role + status
//   - Event counts by status
//   - Guest counts (total, archived, confirmed, attended)
//   - Checkin + SendLog counts (last 24h + all-time)
//   - Session count (active)
//   - Login attempts (last 24h, success/fail ratio)
//
// Use this for ad-hoc monitoring or for feeding into a custom dashboard.
// For production-grade metrics, consider wiring OpenTelemetry or
// Prometheus exporter.

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser } from '@/lib/event-access'
import { handleApiError, forbidden } from '@/lib/api-errors'

export const dynamic = 'force-dynamic' // never cache metrics

export async function GET(request: NextRequest) {
  try {
    const user = getRequestUser(request)
    if (user.role !== 'admin') {
      return forbidden('هذا القسم للمدير فقط')
    }

    const since24h = new Date(Date.now() - 24 * 3600 * 1000)

    // Run all counts in parallel for speed. Each is a separate query
    // but they hit different indexes (all covered by v10.8 compound
    // indexes where applicable).
    const [
      usersByRole,
      usersByStatus,
      eventsByStatus,
      totalGuests,
      archivedGuests,
      confirmedGuests,
      attendedGuests,
      qrGenerated,
      checkins24h,
      checkinsTotal,
      sendLogs24h,
      sendLogsTotal,
      sendLogsFailed24h,
      activeSessions,
      loginAttempts24h,
      loginSuccess24h,
      scheduledPending,
    ] = await Promise.all([
      // Users by role
      db.user.groupBy({ by: ['role'], _count: { _all: true } }),
      // Users by status
      db.user.groupBy({ by: ['status'], _count: { _all: true } }),
      // Events by status
      db.event.groupBy({ by: ['status'], _count: { _all: true } }),
      // Guest counts
      db.guest.count({ where: { archivedAt: null } }),
      db.guest.count({ where: { archivedAt: { not: null } } }),
      db.guest.count({ where: { confirmed: 'confirmed', archivedAt: null } }),
      db.guest.count({ where: { attended: 'attended' } }),
      db.guest.count({ where: { hasQR: true, qrRevoked: false, archivedAt: null } }),
      // Checkins
      db.checkin.count({ where: { time: { gte: since24h } } }),
      db.checkin.count(),
      // SendLogs
      db.sendLog.count({ where: { time: { gte: since24h } } }),
      db.sendLog.count(),
      db.sendLog.count({ where: { time: { gte: since24h }, status: 'failed' } }),
      // Active sessions (not expired)
      db.session.count({ where: { expiresAt: { gt: new Date() } } }),
      // Login attempts (last 24h)
      db.loginAttempt.count({ where: { createdAt: { gte: since24h } } }),
      db.loginAttempt.count({ where: { createdAt: { gte: since24h }, success: true } }),
      // Scheduled messages pending
      db.scheduledMessage.count({ where: { status: 'pending' } }),
    ])

    // Convert groupBy arrays to objects for easier consumption
    const usersByRoleMap = Object.fromEntries(
      usersByRole.map((r) => [r.role, r._count._all]),
    )
    const usersByStatusMap = Object.fromEntries(
      usersByStatus.map((s) => [s.status, s._count._all]),
    )
    const eventsByStatusMap = Object.fromEntries(
      eventsByStatus.map((s) => [s.status, s._count._all]),
    )

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      users: {
        byRole: usersByRoleMap,
        byStatus: usersByStatusMap,
        total: Object.values(usersByRoleMap).reduce((a, b) => a + b, 0),
      },
      events: {
        byStatus: eventsByStatusMap,
        total: Object.values(eventsByStatusMap).reduce((a, b) => a + b, 0),
      },
      guests: {
        active: totalGuests,
        archived: archivedGuests,
        confirmed: confirmedGuests,
        attended: attendedGuests,
        qrGenerated,
        confirmationRate: totalGuests > 0
          ? Math.round((confirmedGuests / totalGuests) * 1000) / 10
          : 0,
        attendanceRate: totalGuests > 0
          ? Math.round((attendedGuests / totalGuests) * 1000) / 10
          : 0,
      },
      checkins: {
        last24h: checkins24h,
        total: checkinsTotal,
      },
      sendLogs: {
        last24h: sendLogs24h,
        total: sendLogsTotal,
        failed24h: sendLogsFailed24h,
        failureRate24h: sendLogs24h > 0
          ? Math.round((sendLogsFailed24h / sendLogs24h) * 1000) / 10
          : 0,
      },
      sessions: {
        active: activeSessions,
      },
      auth: {
        loginAttempts24h,
        loginSuccess24h,
        loginFailureRate24h: loginAttempts24h > 0
          ? Math.round(((loginAttempts24h - loginSuccess24h) / loginAttempts24h) * 1000) / 10
          : 0,
      },
      scheduler: {
        pendingMessages: scheduledPending,
      },
    })
  } catch (error) {
    return handleApiError(error, 'Metrics GET')
  }
}
