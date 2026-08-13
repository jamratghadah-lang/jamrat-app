import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, canAccessEvent, canPerformEventAction, resolveRequestUserName } from '@/lib/event-access'
import { recordAudit } from '@/lib/audit'
import { getRequestIp } from '@/lib/hooks'
import { forbidden, handleApiError, notFound, unauthorized } from '@/lib/api-errors'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = getRequestUser(request)
    if (!user.id) {
      return unauthorized('غير مصرح')
    }
    const current = await db.template.findUnique({ where: { id } })
    if (!current) return notFound('القالب غير موجود')

    // SECURITY FIX (v10.4): previously, when current.eventId was null
    // (a GLOBAL template), the canAccessEvent and canPerformEventAction
    // checks were SKIPPED entirely. This meant any `sender` role user
    // (who has /api/templates prefix access) could PUT or DELETE
    // admin-owned global templates — a privilege escalation.
    // Global templates must be admin-managed.
    if (!current.eventId) {
      if (user.role !== 'admin') {
        return forbidden('القوالب العامة يمكن تعديلها وحذفها من قبل المدير فقط')
      }
    } else {
      if (!(await canAccessEvent(user, current.eventId))) {
        return forbidden('ليس لديك صلاحية الوصول لهذا الحدث')
      }
      if (!(await canPerformEventAction(user, current.eventId, 'send'))) {
        return forbidden('ليس لديك صلاحية إدارة قوالب هذه المناسبة')
      }
    }

    const body = await request.json().catch(() => ({}))
    const updates: Record<string, unknown> = {}
    ;['name', 'type', 'text', 'eventId', 'design'].forEach((k) => {
      if (k in body) updates[k] = body[k]
    })
    // SECURITY: only admin can change the eventId (move a template
    // between events or convert a global template to event-scoped).
    if ('eventId' in updates && user.role !== 'admin') {
      delete updates.eventId
    }
    if (typeof updates.design === 'object' && updates.design !== null) {
      updates.design = JSON.stringify(updates.design)
    }
    const updated = await db.template.update({ where: { id }, data: updates })
    await recordAudit({
      eventId: updated.eventId, userId: user.id, userName: await resolveRequestUserName(user),
      text: `تعديل قالب ${updated.name}`,
      entity: 'template', entityId: updated.id, action: 'template_update',
      oldValue: { name: current.name, type: current.type },
      newValue: updates,
      ipAddress: getRequestIp(request),
    })
    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, 'Update template error:')
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = getRequestUser(request)
    if (!user.id) {
      return unauthorized('غير مصرح')
    }
    const current = await db.template.findUnique({ where: { id } })
    if (!current) return notFound('القالب غير موجود')

    // SECURITY FIX (v10.4): same privilege escalation as PUT — global
    // templates (eventId null) must be admin-only.
    if (!current.eventId) {
      if (user.role !== 'admin') {
        return forbidden('القوالب العامة يمكن حذفها من قبل المدير فقط')
      }
    } else {
      if (!(await canAccessEvent(user, current.eventId))) {
        return forbidden('ليس لديك صلاحية الوصول لهذا الحدث')
      }
      if (!(await canPerformEventAction(user, current.eventId, 'send'))) {
        return forbidden('ليس لديك صلاحية إدارة قوالب هذه المناسبة')
      }
    }
    await db.template.delete({ where: { id } })
    await recordAudit({
      eventId: current.eventId, userId: user.id, userName: await resolveRequestUserName(user),
      text: `حذف قالب ${current.name}`,
      entity: 'template', entityId: id, action: 'template_delete',
      oldValue: { name: current.name, type: current.type },
      ipAddress: getRequestIp(request),
    })
    return NextResponse.json({ message: 'تم حذف القالب' })
  } catch (error) {
    return handleApiError(error, 'Delete template error:')
  }
}
