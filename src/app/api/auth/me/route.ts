import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyTokenWithDb } from '@/lib/auth'
import { handleApiError, notFound, unauthorized } from '@/lib/api-errors'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader) return unauthorized('غير مصرح')
    const parts = authHeader.split(' ')
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return unauthorized('صيغة التوكن غير صحيحة')
    }
    const payload = await verifyTokenWithDb(parts[1])
    if (!payload) {
      return unauthorized('توكن غير صالح أو منتهي الصلاحية')
    }
    const user = await db.user.findUnique({
      where: { id: payload.userId },
      // NOTE: tokenVersion is internal — never expose it to the client.
      select: { id: true, name: true, email: true, role: true, status: true, lastActive: true },
    })
    if (!user) return notFound('المستخدم غير موجود')

    // Touch only lastActive. The previous version also wrote
    // `tokenVersion: user.tokenVersion` which was a no-op that bumped
    // `updatedAt` on every /me call — confusing the audit log.
    await db.user.update({
      where: { id: user.id },
      data: { lastActive: new Date() },
    })
    return NextResponse.json(user)
  } catch (error) {
    return handleApiError(error, 'Get me error:')
  }
}
