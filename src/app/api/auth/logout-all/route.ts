import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { recordAudit } from '@/lib/audit'
import { getRequestIp } from '@/lib/hooks'
import { handleApiError, notFound } from '@/lib/api-errors'

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request)
  if (auth.error) return auth.error

  try {
    const user = await db.user.findUnique({ where: { id: auth.payload.userId } })
    if (!user) {
      return notFound('المستخدم غير موجود')
    }
    const newVersion = user.tokenVersion + 1
    await db.session.deleteMany({ where: { userId: user.id } })
    await db.user.update({ where: { id: user.id }, data: { tokenVersion: newVersion } })
    await recordAudit({
      userId: user.id, userName: user.name || user.email,
      text: 'تسجيل خروج من جميع الأجهزة',
      entity: 'user', entityId: user.id, action: 'logout_all',
      ipAddress: getRequestIp(request),
    })
    return NextResponse.json({ message: 'تم تسجيل الخروج من جميع الأجهزة' })
  } catch (error) {
    return handleApiError(error, 'Logout-all error:')
  }
}
