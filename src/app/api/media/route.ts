import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { canPerformEventAction, eventIdScopeWhere, getRequestUser, resolveRequestUserName } from '@/lib/event-access'
import { recordAudit } from '@/lib/audit'
import { getRequestIp } from '@/lib/hooks'
import { CreateMediaInput, DeleteMediaInput, formatZodIssues } from '@/lib/validation'
import { forbidden, handleApiError, notFound } from '@/lib/api-errors'

export async function GET(request: NextRequest) {
  try {
    const user = getRequestUser(request)
    const eventId = new URL(request.url).searchParams.get('eventId')
    const scope = await eventIdScopeWhere(user)
    const assets = await db.mediaAsset.findMany({
      where: { ...scope, ...(eventId ? { eventId } : {}) },
      orderBy: { createdAt: 'desc' },
      select: { id: true, eventId: true, title: true, type: true, url: true, size: true, storage: true, createdAt: true, event: { select: { name: true } } },
    })
    return NextResponse.json(assets)
  } catch (error) {
    return handleApiError(error, 'Get media error:')
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = getRequestUser(request)
    // SECURITY (v10.7): Zod validation — replaces the ad-hoc typeof
    // checks. The schema also enforces URL shape (http/https) and
    // type enum (image|video), so the inline regex check is gone.
    const parsed = CreateMediaInput.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(formatZodIssues(parsed.error), { status: 400 })
    }
    const { eventId, url, title, type } = parsed.data
    if (!(await canPerformEventAction(user, eventId, 'manage'))) return forbidden('ليس لديك صلاحية إدارة وسائط هذه المناسبة')
    const asset = await db.mediaAsset.create({
      data: { eventId, url, title, type, storage: 'external' },
      select: { id: true, eventId: true, title: true, type: true, url: true, size: true, storage: true, createdAt: true },
    })
    // AUDIT (v10.4): media asset creation affects event content — record it.
    await recordAudit({
      eventId, userId: user.id, userName: await resolveRequestUserName(user),
      text: `إضافة وسائط ${type}: ${title || url}`,
      entity: 'media', entityId: asset.id, action: 'media_create',
      newValue: { title, type, url },
      ipAddress: getRequestIp(request),
    })
    return NextResponse.json(asset, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'Create media error:')
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = getRequestUser(request)
    // SECURITY (v10.7): Zod validation on the `id` query param.
    const idRaw = new URL(request.url).searchParams.get('id') || ''
    const parsed = DeleteMediaInput.safeParse({ id: idRaw })
    if (!parsed.success) {
      return NextResponse.json(formatZodIssues(parsed.error), { status: 400 })
    }
    const { id } = parsed.data
    const asset = await db.mediaAsset.findUnique({ where: { id }, select: { id: true, eventId: true, title: true, type: true, url: true } })
    if (!asset) return notFound('الوسائط غير موجودة')
    if (!(await canPerformEventAction(user, asset.eventId, 'manage'))) return forbidden('ليس لديك صلاحية حذف هذه الوسائط')
    await db.mediaAsset.delete({ where: { id } })
    // AUDIT (v10.4): media deletion is irreversible — record it.
    await recordAudit({
      eventId: asset.eventId, userId: user.id, userName: await resolveRequestUserName(user),
      text: `حذف وسائط ${asset.type}: ${asset.title || asset.url}`,
      entity: 'media', entityId: id, action: 'media_delete',
      oldValue: { title: asset.title, type: asset.type, url: asset.url },
      ipAddress: getRequestIp(request),
    })
    return NextResponse.json({ message: 'تم حذف الوسائط' })
  } catch (error) {
    return handleApiError(error, 'Delete media error:')
  }
}
