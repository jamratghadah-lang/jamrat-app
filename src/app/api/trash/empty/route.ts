import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, resolveRequestUserName } from '@/lib/event-access'
import { EmptyTrashInput } from '@/lib/validation'
import { recordAudit } from '@/lib/audit'
import { getRequestIp } from '@/lib/hooks'
import { badRequest, forbidden, handleApiError } from '@/lib/api-errors'

export async function POST(request: NextRequest) {
  try {
    const parsed = EmptyTrashInput.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return badRequest('تأكيد الإفراغ مطلوب (confirm: true)')
    }
    const user = getRequestUser(request)
    if (user.role !== 'admin') {
      return forbidden('هذا القسم للمدير فقط')
    }
    // Admin acts on the whole trash; others are scoped in trashScopeWhere.
    const result = await db.trashItem.deleteMany()
    await recordAudit({
      userId: user.id, userName: await resolveRequestUserName(user),
      text: `إفراغ سلة المهملات (${result.count} عنصر)`,
      entity: 'trash', action: 'trash_empty',
      newValue: { count: result.count },
      ipAddress: getRequestIp(request),
    })
    return NextResponse.json({ message: 'تم إفراغ السلة', removed: result.count })
  } catch (error) {
    return handleApiError(error, 'Trash empty error:')
  }
}
