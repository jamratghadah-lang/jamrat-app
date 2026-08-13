// Maintenance cron endpoints. Called by external cron (e.g. systemd
// timer, Caddy, or a hosted cron service) with the X-Cron-Secret
// header. No JWT auth — the secret is the gate.
//
// Currently exposes:
//   POST /api/maintenance/cleanup  — purge stale login_attempts rows
//                                     older than 24h.

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hasValidCronSecret } from '@/lib/cron'
import { handleApiError, unauthorized } from '@/lib/api-errors'

export async function POST(request: NextRequest) {
  if (!hasValidCronSecret(request)) {
    return unauthorized('غير مصرح')
  }
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const result = await db.loginAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } })
    return NextResponse.json({
      ok: true,
      deletedLoginAttempts: result.count,
      cutoff: cutoff.toISOString(),
    })
  } catch (error) {
    return handleApiError(error, 'Maintenance cleanup error:')
  }
}

export async function GET(request: NextRequest) {
  if (!hasValidCronSecret(request)) {
    return unauthorized('غير مصرح')
  }
  return NextResponse.json({
    endpoint: 'maintenance/cleanup',
    method: 'POST',
    description: 'Purge login_attempts rows older than 24h',
  })
}
