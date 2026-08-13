// Cron entry point. No auth (SKIP_AUTH_ROUTES). This implementation
// only marks due messages as sent=pending + writes an audit-like row to
// OperationLog; never calls out to WhatsApp / Resend / Cloudinary.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hasValidCronSecret } from '@/lib/cron'
import { handleApiError, unauthorized } from '@/lib/api-errors'

export async function POST(request: NextRequest) {
  try {
    if (!hasValidCronSecret(request)) {
      return unauthorized('غير مصرح')
    }
    const now = new Date()
    const due = await db.scheduledMessage.findMany({
      where: { status: 'pending', scheduleAt: { lte: now } },
      take: 100,
    })
    if (due.length === 0) {
      return NextResponse.json({ executed: 0, placeholder: true })
    }

    // PERFORMANCE (v10.8): batch the scheduler tick into a single
    // transaction with 2 batched statements instead of one
    // transaction-per-row. For a 100-message tick, this drops from
    // 200 sequential statements (100 updates + 100 inserts, each in
    // its own transaction) to 2 batched statements in 1 transaction.
    const dueIds = due.map((r) => r.id)
    await db.$transaction(async (tx) => {
      // updateMany returns a count, not the updated rows — fine here
      // since we don't need to read them back.
      await tx.scheduledMessage.updateMany({
        where: { id: { in: dueIds } },
        data: { status: 'sent', executedAt: now, result: 'placeholder' },
      })
      // createMany for the audit-log rows. Each row needs its own
      // eventId + text, so we can't use a single update.
      await tx.operationLog.createMany({
        data: due.map((row) => ({
          eventId: row.eventId,
          text: `[scheduler] placeholder exec for scheduled message ${row.id}`,
        })),
      })
    })

    return NextResponse.json({ executed: due.length, placeholder: true })
  } catch (error) {
    return handleApiError(error, 'Scheduler error:')
  }
}

export async function GET(request: NextRequest) {
  if (!hasValidCronSecret(request)) return unauthorized('غير مصرح')
  return NextResponse.json({ scheduled: 'placeholder endpoint — POST only' })
}
