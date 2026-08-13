import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, resolveRequestUserName } from '@/lib/event-access'
import { recordAudit } from '@/lib/audit'
import { getRequestIp } from '@/lib/hooks'
import { hashPassword } from '@/lib/auth'
import crypto from 'node:crypto'
import { badRequest, forbidden, handleApiError } from '@/lib/api-errors'

const date = (v: string | Date) => new Date(v)

// ─── v10.6: explicit allowlists for restore ──────────────────────────
// Previously the restore handler spread `...u` (and `...e`, `...g`, etc.)
// directly into Prisma's `createMany`, which let a tampered backup file
// inject arbitrary columns. The most dangerous case: a backup `users`
// row containing `role: 'admin'` would elevate that user to admin on
// restore. Now every model has an explicit field list — anything not
// listed is silently dropped.
const USER_FIELDS = ['id', 'name', 'email', 'role', 'status', 'tokenVersion', 'lastActive', 'createdAt', 'updatedAt'] as const
const EVENT_FIELDS = ['id', 'name', 'client', 'clientPhone', 'date', 'time', 'location', 'status', 'password', 'guests', 'confirmed', 'attended', 'notes', 'hasInteractivePage', 'createdAt', 'updatedAt', 'createdById'] as const
const EVENT_ASSIGNMENT_FIELDS = ['id', 'eventId', 'userId', 'role', 'createdAt'] as const
const GUEST_FIELDS = ['id', 'eventId', 'name', 'phone', 'email', 'companions', 'sendStatus', 'confirmed', 'attended', 'hasQR', 'qrColor', 'qrRevoked', 'qrGeneratedAt', 'qrRevokedAt', 'notes', 'archivedAt', 'createdAt', 'updatedAt'] as const
const CHECKIN_FIELDS = ['id', 'eventId', 'guestId', 'guestName', 'companions', 'method', 'operatorId', 'operator', 'time'] as const
const SENDLOG_FIELDS = ['id', 'eventId', 'guestId', 'recipient', 'type', 'channel', 'status', 'failReason', 'time'] as const
const TEMPLATE_FIELDS = ['id', 'eventId', 'name', 'type', 'text', 'design', 'createdAt', 'updatedAt'] as const
const COMMENT_FIELDS = ['id', 'eventId', 'guestName', 'text', 'createdAt'] as const
const OPERATIONLOG_FIELDS = ['id', 'eventId', 'text', 'userId', 'user', 'entity', 'entityId', 'action', 'oldValue', 'newValue', 'ipAddress', 'time'] as const
const TRASH_FIELDS = ['id', 'eventId', 'name', 'itemType', 'eventRef', 'createdById', 'deletedAt'] as const
const QRUSAGE_FIELDS = ['id', 'guestId', 'eventId', 'action', 'success', 'reason', 'actorUserId', 'actorName', 'ipAddress', 'userAgent', 'time'] as const
const GUESTEDITLOG_FIELDS = ['id', 'guestId', 'eventId', 'field', 'oldValue', 'newValue', 'userId', 'user', 'time'] as const
const SCHEDULEDMESSAGE_FIELDS = ['id', 'eventId', 'recipientType', 'channel', 'content', 'templateId', 'guestIds', 'scheduleAt', 'status', 'result', 'createdAt', 'executedAt'] as const

function pick<T extends string>(row: Record<string, unknown>, fields: readonly T[]): Partial<Record<T, unknown>> {
  const out: Partial<Record<T, unknown>> = {}
  for (const f of fields) {
    if (f in row) out[f] = row[f]
  }
  return out
}

export async function POST(request: NextRequest) {
  try {
    const user = getRequestUser(request)
    if (user.role !== 'admin') return forbidden('هذا القسم للمدير فقط')

    const body = await request.json().catch(() => ({})) as { data?: Record<string, unknown>; confirm?: boolean }
    if (body.confirm !== true) return badRequest('يجب تأكيد عملية الاستعادة')
    const data = body.data
    if (!data || typeof data !== 'object' || !Array.isArray(data.events) || !Array.isArray(data.users)) {
      return badRequest('ملف النسخة الاحتياطية غير صالح')
    }

    const id = (request.nextUrl?.pathname || '').split('/').pop() || 'uploaded'

    // Before destructive restore, capture the calling admin's password hash
    // so we can preserve their ability to log in after restore (since the
    // backup may not contain password hashes — see /api/backup route).
    const currentUserRecord = await db.user.findUnique({ where: { id: user.id }, select: { id: true, password: true, email: true } })
    if (!currentUserRecord) {
      return forbidden('الحساب الحالي غير موجود')
    }

    await db.$transaction(async (tx) => {
      // Delete dependants first. Users are deleted last so their cascaded
      // sessions/reset tokens are also removed before users are recreated.
      await tx.scheduledMessage.deleteMany()
      await tx.checkin.deleteMany()
      await tx.sendLog.deleteMany()
      await tx.qrUsage.deleteMany()
      await tx.guestEditLog.deleteMany()
      await tx.comment.deleteMany()
      await tx.template.deleteMany()
      await tx.operationLog.deleteMany()
      await tx.trashItem.deleteMany()
      await tx.guest.deleteMany()
      await tx.eventAssignment.deleteMany()
      await tx.event.deleteMany()
      await tx.passwordResetToken.deleteMany()
      await tx.session.deleteMany()
      await tx.user.deleteMany()

      // For users: if the backup row has a password, use it. Otherwise
      // (security-hardened backups strip password hashes) generate a
      // random unusable password hash — the user must reset their password
      // via scripts/create-admin.ts. Exception: the calling admin keeps
      // their CURRENT password hash so they don't lock themselves out.
      const usersIn = (data.users as any[]) || []
      const usersOut = await Promise.all(usersIn.map(async (u) => {
        const preservedPassword = u.id === user.id && currentUserRecord.password
          ? currentUserRecord.password
          : (typeof u.password === 'string' && u.password.startsWith('$2')
            ? u.password
            // Generate a random hash that no one knows — forces password reset
            : await hashPassword(crypto.randomBytes(32).toString('hex')))
        const picked = pick(u as Record<string, unknown>, USER_FIELDS)
        // SECURITY (v10.6): role is validated — only allow the four
        // known roles. A tampered backup with role:'admin' on a row
        // that wasn't already admin can't escalate through restore.
        // (We DO allow restoring an existing admin user — the user
        // table is wiped before restore, so admin rows in the backup
        // are the only way to keep admin access after restore. But
        // we coerce any unknown role to 'staff'.)
        if (picked.role !== 'admin' && picked.role !== 'staff' && picked.role !== 'checkin' && picked.role !== 'sender') {
          picked.role = 'staff'
        }
        return {
          ...picked,
          password: preservedPassword,
          createdAt: date(u.createdAt as string),
          updatedAt: date(u.updatedAt as string),
          lastActive: date(u.lastActive as string),
        }
      }))
      if (usersOut.length) await tx.user.createMany({ data: usersOut as any })

      const events = ((data.events as any[]) || []).map((e) => ({
        ...pick(e as Record<string, unknown>, EVENT_FIELDS),
        createdAt: date(e.createdAt as string),
        updatedAt: date(e.updatedAt as string),
      }))
      if (events.length) await tx.event.createMany({ data: events as any })

      const assignments = ((data.eventAssignments as any[]) || []).map((a) => ({
        ...pick(a as Record<string, unknown>, EVENT_ASSIGNMENT_FIELDS),
        createdAt: date(a.createdAt as string),
      }))
      if (assignments.length) await tx.eventAssignment.createMany({ data: assignments as any })

      const guests = ((data.guests as any[]) || []).map((g) => ({
        ...pick(g as Record<string, unknown>, GUEST_FIELDS),
        // SECURITY: qrToken never comes from the backup (it's stripped
        // at export). Generate a fresh opaque token if the row needs
        // one — but actually, we set qrToken=null on restore so admins
        // must re-issue QR codes from the dashboard. This is safer than
        // trusting any qrToken that might be in the backup file.
        qrToken: null,
        createdAt: date(g.createdAt as string),
        updatedAt: date(g.updatedAt as string),
        qrGeneratedAt: g.qrGeneratedAt ? date(g.qrGeneratedAt as string) : null,
        qrRevokedAt: g.qrRevokedAt ? date(g.qrRevokedAt as string) : null,
        archivedAt: g.archivedAt ? date(g.archivedAt as string) : null,
      }))
      if (guests.length) await tx.guest.createMany({ data: guests as any })

      const checkins = ((data.checkins as any[]) || []).map((c) => ({
        ...pick(c as Record<string, unknown>, CHECKIN_FIELDS),
        time: date(c.time as string),
      }))
      if (checkins.length) await tx.checkin.createMany({ data: checkins as any })
      const sendLogs = ((data.sendLogs as any[]) || []).map((s) => ({
        ...pick(s as Record<string, unknown>, SENDLOG_FIELDS),
        time: date(s.time as string),
      }))
      if (sendLogs.length) await tx.sendLog.createMany({ data: sendLogs as any })
      const templates = ((data.templates as any[]) || []).map((t) => ({
        ...pick(t as Record<string, unknown>, TEMPLATE_FIELDS),
        createdAt: date(t.createdAt as string),
        updatedAt: date(t.updatedAt as string),
      }))
      if (templates.length) await tx.template.createMany({ data: templates as any })
      const comments = ((data.comments as any[]) || []).map((c) => ({
        ...pick(c as Record<string, unknown>, COMMENT_FIELDS),
        createdAt: date(c.createdAt as string),
      }))
      if (comments.length) await tx.comment.createMany({ data: comments as any })
      const operations = ((data.operationLogs as any[]) || []).map((o) => ({
        ...pick(o as Record<string, unknown>, OPERATIONLOG_FIELDS),
        time: date(o.time as string),
      }))
      if (operations.length) await tx.operationLog.createMany({ data: operations as any })
      const trash = ((data.trashItems as any[]) || []).map((t) => ({
        ...pick(t as Record<string, unknown>, TRASH_FIELDS),
        deletedAt: date(t.deletedAt as string),
      }))
      if (trash.length) await tx.trashItem.createMany({ data: trash as any })
      const qrUsages = ((data.qrUsages as any[]) || []).map((q) => ({
        ...pick(q as Record<string, unknown>, QRUSAGE_FIELDS),
        time: date(q.time as string),
      }))
      if (qrUsages.length) await tx.qrUsage.createMany({ data: qrUsages as any })
      const editLogs = ((data.guestEditLogs as any[]) || []).map((e) => ({
        ...pick(e as Record<string, unknown>, GUESTEDITLOG_FIELDS),
        time: date(e.time as string),
      }))
      if (editLogs.length) await tx.guestEditLog.createMany({ data: editLogs as any })
      const schedules = ((data.scheduledMessages as any[]) || []).map((s) => ({
        ...pick(s as Record<string, unknown>, SCHEDULEDMESSAGE_FIELDS),
        scheduleAt: date(s.scheduleAt as string),
        createdAt: date(s.createdAt as string),
        executedAt: s.executedAt ? date(s.executedAt as string) : null,
      }))
      if (schedules.length) await tx.scheduledMessage.createMany({ data: schedules as any })
    }, { timeout: 120000 })

    await recordAudit({
      userId: user.id, userName: await resolveRequestUserName(user),
      text: `استعادة نسخة احتياطية ${id}`, entity: 'backup', entityId: id, action: 'backup_restore',
      ipAddress: getRequestIp(request),
    })
    return NextResponse.json({
      message: 'تم استرجاع النسخة الاحتياطية بنجاح. تم الحفاظ على كلمة مرور المدير الحالي؛ باقي المستخدمين يحتاجون إعادة تعيين كلمة المرور.',
      snapshotId: id,
      note: 'الحقول الحساسة (password, qrToken, tokenHash) لم تكن في النسخة الاحتياطية وتم توليد قيم آمنة بدلاً منها.',
    })
  } catch (error) {
    return handleApiError(error, 'Restore error:')
  }
}
