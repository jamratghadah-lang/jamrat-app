import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, resolveRequestUserName } from '@/lib/event-access'
import { CreateUserInput, UpdateUserInput, formatZodIssues } from '@/lib/validation'
import { hashPassword } from '@/lib/auth'
import { recordAudit } from '@/lib/audit'
import { getRequestIp } from '@/lib/hooks'
import { badRequest, forbidden, handleApiError, notFound } from '@/lib/api-errors'

function isAdmin(user: { role: string }): boolean {
  return user.role === 'admin'
}

export async function GET(request: NextRequest) {
  try {
    const user = getRequestUser(request)
    if (!isAdmin(user)) {
      return forbidden('هذا القسم للمدير فقط')
    }
    const users = await db.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, email: true, role: true, status: true,
        lastActive: true, createdAt: true, updatedAt: true,
      },
    })
    return NextResponse.json(users)
  } catch (error) {
    return handleApiError(error, 'Get users error:')
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getRequestUser(request)
    if (!isAdmin(user)) {
      return forbidden('هذا القسم للمدير فقط')
    }
    const parsed = CreateUserInput.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(formatZodIssues(parsed.error), { status: 400 })
    }
    const created = await db.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: await hashPassword(parsed.data.password),
        role: parsed.data.role,
        status: 'active',
      },
      select: { id: true, name: true, email: true, role: true, status: true },
    })
    await recordAudit({
      userId: user.id, userName: await resolveRequestUserName(user),
      text: `إنشاء مستخدم ${created.name}`,
      entity: 'user', entityId: created.id, action: 'user_create',
      newValue: { role: created.role }, ipAddress: getRequestIp(request),
    })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'Create user error:')
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = getRequestUser(request)
    if (!isAdmin(user)) {
      return forbidden('هذا القسم للمدير فقط')
    }
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const targetId = typeof body.id === 'string' ? body.id : ''
    const parsed = UpdateUserInput.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(formatZodIssues(parsed.error), { status: 400 })
    }
    if (!targetId) {
      return badRequest('معرف المستخدم مطلوب')
    }
    const target = await db.user.findUnique({ where: { id: targetId } })
    if (!target) {
      return notFound('المستخدم غير موجود')
    }
    if (targetId === user.id && parsed.data.status === 'disabled') {
      return badRequest('لا يمكن تعطيل حسابك الحالي')
    }
    if (target.role === 'admin' && parsed.data.role && parsed.data.role !== 'admin') {
      const adminCount = await db.user.count({ where: { role: 'admin', status: 'active' } })
      if (adminCount <= 1) {
        return badRequest('لا يمكن إزالة آخر مدير نشط في النظام')
      }
    }

    const securityChanged =
      (parsed.data.role && parsed.data.role !== target.role) ||
      (parsed.data.status && parsed.data.status !== target.status)

    const updated = await db.user.update({
      where: { id: targetId },
      data: {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
        ...(parsed.data.role ? { role: parsed.data.role } : {}),
        ...(parsed.data.status ? { status: parsed.data.status } : {}),
        ...(securityChanged ? { tokenVersion: { increment: 1 } } : {}),
      },
      select: { id: true, name: true, email: true, role: true, status: true },
    })
    await recordAudit({
      userId: user.id, userName: await resolveRequestUserName(user),
      text: `تعديل مستخدم ${target.name}`,
      entity: 'user', entityId: target.id, action: 'user_update',
      oldValue: { role: target.role, status: target.status },
      newValue: { role: updated.role, status: updated.status },
      ipAddress: getRequestIp(request),
    })
    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, 'Update user error:')
  }
}
