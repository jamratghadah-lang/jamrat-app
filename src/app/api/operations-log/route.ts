import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, eventIdScopeWhere, canAccessEvent } from '@/lib/event-access'
import { forbidden, handleApiError } from '@/lib/api-errors'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')
    const user = getRequestUser(request)
    const scope = await eventIdScopeWhere(user)
    const where: Record<string, unknown> = { ...scope }
    if (eventId) {
      if (!(await canAccessEvent(user, eventId))) {
        return forbidden('ليس لديك صلاحية الوصول لهذا الحدث')
      }
      where.eventId = eventId
    }
    const logs = await db.operationLog.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { time: 'desc' },
      take: 200,
    })
    return NextResponse.json(logs)
  } catch (error) {
    return handleApiError(error, 'Ops log error:')
  }
}

// No PATCH / DELETE: OperationLog rows are append-only. Attempting to
// mutate them is rejected at the HTTP layer (so even a privileged admin
// cannot rewrite history through the dashboard).
export async function POST(request: NextRequest) {
  return NextResponse.json({ error: 'لا يمكن إنشاء سجل عمليات يدوياً' }, { status: 405 })
}
export async function PATCH() {
  return NextResponse.json({ error: 'سجل العمليات للقراءة فقط' }, { status: 405 })
}
export async function DELETE() {
  return NextResponse.json({ error: 'سجل العمليات للقراءة فقط' }, { status: 405 })
}
