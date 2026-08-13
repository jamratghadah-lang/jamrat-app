// Grant / revoke per-event access. Admin-only.
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, resolveRequestUserName } from '@/lib/event-access'
import { recordAudit } from '@/lib/audit'
import { getRequestIp } from '@/lib/hooks'
import { AssignEventUserInput, formatZodIssues } from '@/lib/validation'
import { badRequest, forbidden, handleApiError, notFound } from '@/lib/api-errors'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = getRequestUser(request)
    if (user.role !== 'admin') {
      return forbidden('هذا القسم للمدير فقط')
    }
    const event = await db.event.findUnique({ where: { id }, select: { id: true } })
    if (!event) return notFound('الحدث غير موجود')
    const assignments = await db.eventAssignment.findMany({
      where: { eventId: id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, userId: true, role: true, createdAt: true,
        user: { select: { id: true, name: true, email: true, role: true, status: true } },
      },
    })
    return NextResponse.json(assignments)
  } catch (error) {
    return handleApiError(error, 'Get assignments error:')
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = getRequestUser(request)
    if (user.role !== 'admin') {
      return forbidden('هذا القسم للمدير فقط')
    }
    // SECURITY (v10.6): Zod validation — previously the handler trusted
    // `body.userId` and `body.role` raw. The ad-hoc check below only
    // verified the role was in the allowed set, but didn't validate
    // userId was a non-empty string before passing it to Prisma. A
    // malformed body could throw a Prisma error which the catch block
    // would turn into a generic 500. Now: 400 with a clear message.
    const parsed = AssignEventUserInput.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(formatZodIssues(parsed.error), { status: 400 })
    }
    const { userId, role: scopedRole } = parsed.data
    const exists = await db.event.findUnique({ where: { id }, select: { id: true } })
    if (!exists) {
      return notFound('الحدث غير موجود')
    }
    const target = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true } })
    if (!target) {
      return notFound('المستخدم غير موجود')
    }
    await db.eventAssignment.upsert({
      where: { eventId_userId: { eventId: id, userId } },
      create: { eventId: id, userId, role: scopedRole },
      update: { role: scopedRole },
    })
    await recordAudit({
      eventId: id, userId: user.id, userName: await resolveRequestUserName(user),
      text: `منح صلاحية حدث للمستخدم`,
      entity: 'event', entityId: id, action: 'event_assign',
      newValue: { grantedTo: userId, role: scopedRole },
      ipAddress: getRequestIp(request),
    })
    return NextResponse.json({ message: 'تم منح الصلاحية' })
  } catch (error) {
    return handleApiError(error, 'Assign error:')
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = getRequestUser(request)
    if (user.role !== 'admin') {
      return forbidden('هذا القسم للمدير فقط')
    }
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')
    if (!userId) {
      return badRequest('معرف المستخدم مطلوب')
    }
    await db.eventAssignment.deleteMany({ where: { eventId: id, userId } })
    await recordAudit({
      eventId: id, userId: user.id, userName: await resolveRequestUserName(user),
      text: `سحب صلاحية حدث من المستخدم`,
      entity: 'event', entityId: id, action: 'event_assign_revoke',
      oldValue: { revokedFrom: userId },
      ipAddress: getRequestIp(request),
    })
    return NextResponse.json({ message: 'تم سحب الصلاحية' })
  } catch (error) {
    return handleApiError(error, 'Assign revoke error:')
  }
}
