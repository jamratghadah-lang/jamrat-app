import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser } from '@/lib/event-access'
import { badRequest, notFound, unauthorized } from '@/lib/api-errors'

export async function GET(request: NextRequest) {
  const user = getRequestUser(request)
  if (!user.id) return unauthorized('غير مصرح')
  const sessions = await db.session.findMany({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
    orderBy: { lastActive: 'desc' },
    select: { id: true, deviceName: true, userAgent: true, ipAddress: true, lastActive: true, expiresAt: true, createdAt: true },
  })
  return NextResponse.json(sessions)
}

export async function DELETE(request: NextRequest) {
  const user = getRequestUser(request)
  if (!user.id) return unauthorized('غير مصرح')
  const body = await request.json().catch(() => ({})) as { sessionId?: string }
  if (!body.sessionId) return badRequest('معرف الجلسة مطلوب')
  const result = await db.session.deleteMany({ where: { id: body.sessionId, userId: user.id } })
  if (!result.count) return notFound('الجلسة غير موجودة')
  return NextResponse.json({ message: 'تم إلغاء الجلسة' })
}
