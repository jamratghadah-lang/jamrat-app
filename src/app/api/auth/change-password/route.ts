import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { comparePassword, hashPassword, signToken, requireAuth, encodeBearer } from '@/lib/auth'
import { ChangePasswordInput, formatZodIssues } from '@/lib/validation'
import { recordAudit } from '@/lib/audit'
import { getRequestIp } from '@/lib/hooks'
import { createOpaqueToken, hashOpaqueToken } from '@/lib/token-hash'
import { badRequest, handleApiError, notFound } from '@/lib/api-errors'

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth.error) return auth.error

  try {
    const parsed = ChangePasswordInput.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(formatZodIssues(parsed.error), { status: 400 })
    }

    const user = await db.user.findUnique({
      where: { id: auth.payload.userId },
      select: { id: true, name: true, email: true, role: true, password: true, tokenVersion: true },
    })
    if (!user) {
      return notFound('المستخدم غير موجود')
    }
    const matched = await comparePassword(parsed.data.currentPassword, user.password)
    if (!matched) {
      return badRequest('كلمة المرور الحالية غير صحيحة')
    }
    if (parsed.data.newPassword === parsed.data.currentPassword) {
      return badRequest('كلمة المرور الجديدة يجب أن تختلف عن الحالية')
    }

    const newVersion = user.tokenVersion + 1
    const hashed = await hashPassword(parsed.data.newPassword)
    const rawSessionToken = createOpaqueToken(32)
    const newSession = await db.$transaction(async (tx) => {
      // Invalidate every existing session (tokenHash mismatch on next
      // request) + bump tokenVersion so any leaked JWT is also useless.
      await tx.session.deleteMany({ where: { userId: user.id } })
      await tx.user.update({ where: { id: user.id }, data: { password: hashed, tokenVersion: newVersion } })
      return tx.session.create({
        data: {
          userId: user.id,
          tokenHash: hashOpaqueToken(rawSessionToken),
          deviceName: request.headers.get('x-device-name') || 'متصفح',
          userAgent: request.headers.get('user-agent') || '',
          ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      })
    })

    const jwtToken = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: newVersion,
      sessionId: newSession.id,
    })
    const bearer = encodeBearer(jwtToken, rawSessionToken)

    await recordAudit({
      eventId: null,
      userId: user.id,
      userName: user.name || user.email,
      text: 'تغيير كلمة المرور',
      entity: 'user',
      entityId: user.id,
      action: 'password_change',
      ipAddress: getRequestIp(request),
    })

    return NextResponse.json({ message: 'تم تغيير كلمة المرور بنجاح', token: bearer })
  } catch (error) {
    return handleApiError(error, 'Change password error:')
  }
}
