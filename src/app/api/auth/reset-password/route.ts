import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { hashOpaqueToken } from '@/lib/token-hash'
import { recordAudit } from '@/lib/audit'
import { getRequestIp } from '@/lib/hooks'
import { badRequest } from '@/lib/api-errors'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({})) as { token?: string; newPassword?: string }
  const token = String(body.token || '')
  const newPassword = String(body.newPassword || '')
  if (newPassword.length < 8 || !token) return badRequest('بيانات الاستعادة غير صالحة')

  const row = await db.passwordResetToken.findUnique({ where: { tokenHash: hashOpaqueToken(token) } })
  if (!row || row.usedAt || row.expiresAt <= new Date()) return badRequest('رابط الاستعادة غير صالح أو منتهي')

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: row.userId }, data: { password: await hashPassword(newPassword), tokenVersion: { increment: 1 } } })
    await tx.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } })
    await tx.session.deleteMany({ where: { userId: row.userId } })
    await tx.passwordResetToken.deleteMany({ where: { userId: row.userId, id: { not: row.id } } })
  })

  // AUDIT (v10.4): password reset is a security-critical operation.
  // Record who reset their password (via token) so the admin can see
  // when/how it happened.
  await recordAudit({
    userId: row.userId,
    userName: 'استعادة كلمة المرور',
    text: 'تم إعادة تعيين كلمة المرور عبر رابط الاستعادة',
    entity: 'user',
    entityId: row.userId,
    action: 'password_reset',
    ipAddress: getRequestIp(request),
  })

  return NextResponse.json({ message: 'تم تغيير كلمة المرور بنجاح' })
}
