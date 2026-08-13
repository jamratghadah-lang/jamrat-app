import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, canAccessEvent, eventIdScopeWhere } from '@/lib/event-access'
import { forbidden, handleApiError } from '@/lib/api-errors'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')
    const user = getRequestUser(request)
    if (eventId && !(await canAccessEvent(user, eventId))) {
      return forbidden('ليس لديك صلاحية الوصول لهذا الحدث')
    }
    const scope = await eventIdScopeWhere(user)
    const where: Record<string, unknown> = { ...scope }
    if (eventId) where.eventId = eventId
    // SECURITY (v10.4): exclude archived guests from export by default.
    // Trashed guests shouldn't appear in the CSV — they're no longer
    // active invitees. The /api/guests GET endpoint already filters
    // archivedAt:null by default; export should match.
    where.archivedAt = null
    const rows = await db.guest.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { createdAt: 'desc' },
    })
    const headerRow = ['name', 'phone', 'email', 'companions', 'sendStatus', 'confirmed', 'attended']
    const lines = [headerRow.join(',')]
    for (const g of rows) {
      lines.push([
        JSON.stringify(g.name || ''),
        JSON.stringify(g.phone || ''),
        JSON.stringify(g.email || ''),
        g.companions ?? 0,
        g.sendStatus,
        g.confirmed,
        g.attended,
      ].join(','))
    }
    return new NextResponse(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="guests-${Date.now()}.csv"`,
      },
    })
  } catch (error) {
    return handleApiError(error, 'Export error:')
  }
}
