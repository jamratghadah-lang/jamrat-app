import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, canAccessEvent, canPerformEventAction, eventIdScopeWhere, resolveRequestUserName } from '@/lib/event-access'
import { CreateTemplateInput, formatZodIssues } from '@/lib/validation'
import { recordAudit } from '@/lib/audit'
import { getRequestIp } from '@/lib/hooks'
import { forbidden, handleApiError, unauthorized } from '@/lib/api-errors'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')
    const user = getRequestUser(request)
    if (eventId && !(await canAccessEvent(user, eventId))) {
      return forbidden('ليس لديك صلاحية الوصول لهذا الحدث')
    }
    // SECURITY (v10.6): global templates (eventId === null) must be
    // visible to all authenticated roles — non-admin users were
    // previously excluded from seeing them because the where clause
    // was `eventId: { in: [...accessibleIds] }`, which silently
    // filtered out null. The fix: when the user is non-admin, OR the
    // scope against `eventId: null` so global templates are included.
    const scope = await eventIdScopeWhere(user)
    const where: Record<string, unknown> = {}
    if (eventId) {
      where.eventId = eventId
    } else if (Object.keys(scope).length) {
      // Non-admin: visible templates = (events I can access) OR (global).
      // Admin: scope is {} → where stays empty → all templates returned.
      where.OR = [scope, { eventId: null }]
    }
    const templates = await db.template.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { updatedAt: 'desc' },
    })
    return NextResponse.json(templates)
  } catch (error) {
    return handleApiError(error, 'Get templates error:')
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const parsed = CreateTemplateInput.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(formatZodIssues(parsed.error), { status: 400 })
    }
    const user = getRequestUser(request)
    if (!user.id) {
      return unauthorized('غير مصرح')
    }
    if (parsed.data.eventId && !(await canAccessEvent(user, parsed.data.eventId))) {
      return forbidden('ليس لديك صلاحية الوصول لهذا الحدث')
    }
    if (parsed.data.eventId && !(await canPerformEventAction(user, parsed.data.eventId, 'send'))) return forbidden('ليس لديك صلاحية إدارة القوالب لهذه المناسبة')
    const template = await db.template.create({
      data: {
        name: parsed.data.name,
        type: parsed.data.type,
        text: parsed.data.text,
        design: JSON.stringify(parsed.data.design || {}),
        eventId: parsed.data.eventId ?? null,
      },
    })
    await recordAudit({
      eventId: template.eventId,
      userId: user.id, userName: await resolveRequestUserName(user),
      text: `إنشاء قالب ${template.name}`,
      entity: 'template', entityId: template.id, action: 'template_create',
      newValue: { name: template.name, type: template.type },
      ipAddress: getRequestIp(request),
    })
    return NextResponse.json(template, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'Create template error:')
  }
}
