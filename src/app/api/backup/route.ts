// Admin-only JSON snapshot.
//
// SECURITY: This export does NOT include password hashes, qrTokens, session
// token hashes, or password-reset token hashes. Restoring a backup will
// preserve user records (id, name, email, role, status) but passwords will
// need to be reset after restore. This is the safe default — exporting
// bcrypt hashes is a leak risk if the backup file is mishandled.
//
// If you genuinely need to migrate user passwords between environments, use
// the dedicated `scripts/create-admin.ts` script to reset each user's
// password after restore, or implement a separate encrypted export.

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, resolveRequestUserName } from '@/lib/event-access'
import { recordAudit } from '@/lib/audit'
import { getRequestIp } from '@/lib/hooks'
import { forbidden, handleApiError } from '@/lib/api-errors'

// Strip sensitive fields from a user record before export.
// Keeps: id, name, email, role, status, tokenVersion, lastActive, createdAt, updatedAt
// Drops: password (bcrypt hash)
function sanitizeUser(u: any) {
  const { password, ...safe } = u
  return safe
}

// Strip sensitive fields from a guest record.
// Drops: qrToken (opaque token used for QR verification)
function sanitizeGuest(g: any) {
  const { qrToken, ...safe } = g
  return safe
}

// Strip session token hashes — sessions are environment-specific.
function dropSessions(_: any) { return null }

export async function GET(request: NextRequest) {
  try {
    const user = getRequestUser(request)
    if (user.role !== 'admin') return forbidden('هذا القسم للمدير فقط')

    const [events, guests, checkins, sendLogs, templates, comments, operationLogs, trashItems, users, eventAssignments, qrUsages, guestEditLogs, scheduledMessages] = await Promise.all([
      db.event.findMany(),
      db.guest.findMany(),
      db.checkin.findMany(),
      db.sendLog.findMany(),
      db.template.findMany(),
      db.comment.findMany(),
      db.operationLog.findMany(),
      db.trashItem.findMany(),
      db.user.findMany(),
      db.eventAssignment.findMany(),
      db.qrUsage.findMany(),
      db.guestEditLog.findMany(),
      db.scheduledMessage.findMany(),
    ])

    const payload = {
      version: '2.1',
      exportedAt: new Date().toISOString(),
      exportedBy: { id: user.id, role: user.role },
      // Honest, accurate security notice
      warning: 'هذه النسخة لا تحتوي على كلمات مرور أو توكنات QR أو جلسات نشطة. ' +
        'عند الاستعادة، يلزم إعادة تعيين كلمات المرور عبر scripts/create-admin.ts. ' +
        'الحقول الحساسة (password, qrToken, tokenHash) تم حذفها عمداً لأغراض أمنية.',
      securityNotes: {
        passwordHashesExcluded: true,
        qrTokensExcluded: true,
        sessionTokenHashesExcluded: true,
        passwordResetTokenHashesExcluded: true,
      },
      data: {
        events,
        // Sensitive fields stripped from each guest
        guests: guests.map(sanitizeGuest),
        checkins,
        sendLogs,
        templates,
        comments,
        operationLogs,
        trashItems,
        // Password hashes stripped from each user
        users: users.map(sanitizeUser),
        eventAssignments,
        qrUsages,
        guestEditLogs,
        scheduledMessages,
        // NOTE: sessions and password_reset_tokens intentionally NOT exported
      },
      recordCounts: {
        events: events.length, guests: guests.length, checkins: checkins.length, sendLogs: sendLogs.length,
        templates: templates.length, users: users.length, scheduledMessages: scheduledMessages.length,
      },
    }

    await recordAudit({
      userId: user.id, userName: await resolveRequestUserName(user), text: 'إنشاء نسخة احتياطية',
      entity: 'backup', action: 'backup_create', newValue: { recordCounts: payload.recordCounts, sensitiveFieldsExcluded: true },
      ipAddress: getRequestIp(request),
    })

    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="backup-${Date.now()}.json"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return handleApiError(error, 'Backup error:')
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
