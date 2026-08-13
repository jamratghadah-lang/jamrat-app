// Daily report endpoint.
//
// GET  — cron-only. Verified via X-Cron-Secret. Used by the external
//        scheduler to generate a daily snapshot.
// POST — admin/staff only (verified via the standard Bearer token).
//        Used by ReportsPage.tsx's "إرسال تقرير الآن" button.
//
// Both handlers return the same shape, but the POST handler also
// simulates "sending" the report to DAILY_REPORT_EMAIL when configured
// (currently a placeholder — actual email delivery is not wired in
// this build, but the response is honest about it).
//
// SECURITY: this route is in SKIP_AUTH_ROUTES so the middleware doesn't
// require a Bearer token. That's correct for GET (cron has no JWT), but
// for POST we MUST verify the bearer token explicitly — otherwise any
// unauthenticated visitor could trigger reports. We do that via
// `verifyTokenWithDb` + an explicit role check.

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hasValidCronSecret } from '@/lib/cron'
import { verifyTokenWithDb } from '@/lib/auth'
import { forbidden, handleApiError, unauthorized } from '@/lib/api-errors'

async function buildDailyReport() {
  const since = new Date(Date.now() - 24 * 3600 * 1000)
  const [events, checkins, messages] = await Promise.all([
    db.event.count({ where: { createdAt: { gte: since } } }),
    db.checkin.count({ where: { time: { gte: since } } }),
    db.sendLog.count({ where: { time: { gte: since } } }),
  ])
  return { since: since.toISOString(), events, checkins, messages, placeholder: true }
}

export async function GET(request: NextRequest) {
  try {
    if (!hasValidCronSecret(request)) {
      return unauthorized('غير مصرح')
    }
    const report = await buildDailyReport()
    return NextResponse.json(report)
  } catch (error) {
    return handleApiError(error, 'Daily report error:')
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify Bearer token explicitly — this route is in SKIP_AUTH_ROUTES
    // (the cron GET needs to bypass middleware), so we can't rely on
    // X-User-* headers being set. The Bearer token is still required
    // for POST, and we re-check the role here.
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return unauthorized('غير مصرح')
    }
    const payload = await verifyTokenWithDb(authHeader.slice('Bearer '.length))
    if (!payload) {
      return unauthorized('رمز المصادقة غير صالح أو منتهي')
    }
    // Only admin/staff can trigger manual reports — sender/checkin
    // roles don't see the Reports page in the sidebar (rbac.ts).
    if (payload.role !== 'admin' && payload.role !== 'staff') {
      return forbidden('هذا القسم للمدير أو الموظف فقط')
    }

    const report = await buildDailyReport()
    const recipient = process.env.DAILY_REPORT_EMAIL?.trim()

    // Email delivery is intentionally not wired yet. Be honest in the
    // response so the UI can show an accurate status.
    return NextResponse.json({
      ...report,
      sent: false,
      to: recipient || '',
      message: recipient
        ? 'تم تجهيز التقرير لكن الإرسال الفعلي للبريد غير مُفعّل في هذه النسخة.'
        : 'تم تجهيز التقرير. لم يتم تعريف DAILY_REPORT_EMAIL في .env.',
    })
  } catch (error) {
    return handleApiError(error, 'Manual daily report error:')
  }
}
