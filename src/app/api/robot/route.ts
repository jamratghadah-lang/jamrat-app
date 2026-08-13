// Robot "webhook" endpoint. Public per SKIP_AUTH_ROUTES. Never executes
// outbound integrations in this build — it only records a placeholder
// log row + acknowledges.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestIp } from '@/lib/hooks'
import { getRequestUser, resolveRequestUserName } from '@/lib/event-access'
import { handleApiError, unauthorized } from '@/lib/api-errors'

export async function POST(request: NextRequest) {
  try {
    const user = getRequestUser(request)
    if (!user.id) return unauthorized('غير مصرح')
    const body = await request.json().catch(() => ({}))
    const text = String(body.text || body.message || 'robot event').slice(0, 280)
    const eventId = typeof body.eventId === 'string' ? body.eventId : null
    const actorName = await resolveRequestUserName(user)
    await db.operationLog.create({
      data: {
        text: `[robot] ${text}`,
        eventId,
        userId: user.id,
        user: actorName,
        ipAddress: getRequestIp(request),
      },
    })
    return NextResponse.json({ ok: true, placeholder: true })
  } catch (error) {
    return handleApiError(error, 'Robot webhook error:')
  }
}
