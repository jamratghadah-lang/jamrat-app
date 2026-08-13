import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, trashScopeWhere, canAccessTrashItem } from '@/lib/event-access'
import { handleApiError } from '@/lib/api-errors'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const itemType = searchParams.get('itemType')
    const user = getRequestUser(request)
    const where = await trashScopeWhere(user)
    const combined: Record<string, unknown> = { AND: [{ OR: [] as unknown[] }] }
    ;(combined.AND as Array<Record<string, unknown>>)[0].OR = [where]
    if (itemType && itemType !== 'all') {
      ;(combined.AND as Array<Record<string, unknown>>).push({ itemType })
    }
    const items = await db.trashItem.findMany({
      where: combined,
      orderBy: { deletedAt: 'desc' },
    })
    return NextResponse.json(items)
  } catch (error) {
    return handleApiError(error, 'Trash list error:')
  }
}
