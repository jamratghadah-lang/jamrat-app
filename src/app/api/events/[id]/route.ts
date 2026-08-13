import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, canAccessEvent, canPerformEventAction, resolveRequestUserName } from '@/lib/event-access'
import { recordAudit } from '@/lib/audit'
import { getRequestIp } from '@/lib/hooks'
import { UpdateEventInput, formatZodIssues } from '@/lib/validation'
import { conflict, forbidden, handleApiError, notFound } from '@/lib/api-errors'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = getRequestUser(request)
    if (!(await canAccessEvent(user, id))) {
      return forbidden('ليس لديك صلاحية الوصول لهذا الحدث')
    }
    const event = await db.event.findUnique({ where: { id } })
    if (!event) return notFound('الحدث غير موجود')
    return NextResponse.json(event)
  } catch (error) {
    return handleApiError(error, 'Get event error:')
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = getRequestUser(request)
    if (!(await canAccessEvent(user, id))) {
      return forbidden('ليس لديك صلاحية الوصول لهذا الحدث')
    }
    if (!(await canPerformEventAction(user, id, 'manage'))) {
      return forbidden('ليس لديك صلاحية إدارة هذه المناسبة')
    }
    const current = await db.event.findUnique({ where: { id } })
    if (!current) return notFound('الحدث غير موجود')

    // SECURITY FIX (v10.4): reject PATCH on archived events. Archived
    // events can only be modified via the restore flow (which unarchives
    // them first). Without this check, a staff user could PATCH an
    // archived event's status back to 'active', bypassing the trash
    // model and leaving an orphan TrashItem.
    if (current.status === 'archived') {
      return conflict('لا يمكن تعديل مناسبة مؤرشفة — استرجعها أولاً')
    }

    const body = await request.json().catch(() => ({}))
    // SECURITY (v10.6): Zod validation — enforces the same allowlist as
    // before (name, client, clientPhone, date, time, location, status,
    // password, notes, hasInteractivePage) PLUS type/shape checks on
    // each field. Critically: the schema for `status` does NOT include
    // 'archived' — that transition must go through POST /archive so the
    // audit trail stays consistent. The previous ad-hoc allowlist would
    // silently accept any string for `status` (including 'archived',
    // which the explicit check below caught), and would also accept
    // arbitrary types for other fields (e.g. a number for `name`).
    //
    // NOTE: 'status' stays in the allowlist — EventsPage.tsx's edit form
    // has a working "الحالة" dropdown (preparing/active/ended/archived)
    // that submits through this same PATCH, and /archive, /restore,
    // /close all require the exact same canPerformEventAction(user, id,
    // 'manage') check this handler already enforces above — so routing
    // status through them isn't a privilege boundary, just a nicer audit
    // label. Removing 'status' here would silently break that dropdown.
    // The one thing we DO still guard: the archived-event PATCH block
    // above already stops edits to an already-archived event, and (b)
    // the Zod schema rejects 'archived' here — that specific transition
    // still has to go through POST /archive, since it may eventually
    // gain side effects (notifications, timestamps, etc.) this generic
    // handler shouldn't have to replicate.
    const parsed = UpdateEventInput.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(formatZodIssues(parsed.error), { status: 400 })
    }
    const data: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(parsed.data)) {
      if (value !== undefined) data[key] = value
    }
    if (data.status === 'archived') {
      return conflict('استخدمي زر الأرشفة بدل حفظ الحالة مباشرة')
    }

    const updated = await db.event.update({ where: { id }, data })
    await recordAudit({
      eventId: id, userId: user.id, userName: await resolveRequestUserName(user),
      text: `تعديل حدث ${updated.name}`,
      entity: 'event', entityId: id, action: 'event_update',
      oldValue: current,
      newValue: data,
      ipAddress: getRequestIp(request),
    })
    return NextResponse.json(updated)
  } catch (error) {
    return handleApiError(error, 'Update event error:')
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const user = getRequestUser(request)
    if (!(await canAccessEvent(user, id))) {
      return forbidden('ليس لديك صلاحية الوصول لهذا الحدث')
    }
    if (!(await canPerformEventAction(user, id, 'manage'))) {
      return forbidden('ليس لديك صلاحية إدارة هذه المناسبة')
    }
    const ev = await db.event.findUnique({ where: { id } })
    if (!ev) return notFound('الحدث غير موجود')

    // NOTE: NOT blocking DELETE when ev.status === 'archived'. This
    // endpoint is the only path that actually creates a TrashItem for
    // an event — POST /archive just flips the status flag with no
    // trash row. ArchivePage.tsx's "حذف نهائي" button calls this
    // exact endpoint (api.deleteEvent) specifically ON already-archived
    // events, to finally move them into the trash. Blocking on
    // status === 'archived' would break that button on every click.
    //
    // SECURITY (v10.6): guard against DUPLICATE TrashItems. If a
    // TrashItem for this event already exists (e.g. user clicked
    // "حذف نهائي" once, then refreshed the archive page and clicked
    // again), don't create another one — just return success. The
    // event row is already in the desired state (status='archived').
    const existingTrash = await db.trashItem.findFirst({
      where: { itemType: 'event', eventRef: { contains: `"id":"${id}"` } },
      select: { id: true },
    })
    if (existingTrash) {
      // Idempotent: the event is already in the trash. Make sure its
      // status is 'archived' (it should be, but a race between /archive
      // and a prior DELETE could have left it inconsistent) and return.
      if (ev.status !== 'archived') {
        await db.event.update({ where: { id }, data: { status: 'archived' } })
      }
      await recordAudit({
        eventId: id, userId: user.id, userName: await resolveRequestUserName(user),
        text: `تجاهل حذف مكرر لحدث ${ev.name} (موجود بالفعل في السلة)`,
        entity: 'event', entityId: id, action: 'event_archive_duplicate_skipped',
        ipAddress: getRequestIp(request),
      })
      return NextResponse.json({ message: 'الحدث موجود بالفعل في السلة' })
    }

    // Soft-delete: push to trash, no physical cascade.
    await db.$transaction(async (tx) => {
      await tx.trashItem.create({
        data: {
          eventId: null,
          name: ev.name + ' (حدث)',
          itemType: 'event',
          eventRef: JSON.stringify(ev),
          createdById: ev.createdById,
        },
      })
      // Keep event assignments intact so restoring the event restores the
      // same access configuration.
      await tx.event.update({
        where: { id },
        data: { status: 'archived' },
      })
    })
    await recordAudit({
      eventId: id, userId: user.id, userName: await resolveRequestUserName(user),
      text: `أرشفة حدث ${ev.name}`,
      entity: 'event', entityId: id, action: 'event_archive',
      ipAddress: getRequestIp(request),
    })
    return NextResponse.json({ message: 'تم أرشفة الحدث' })
  } catch (error) {
    return handleApiError(error, 'Delete event error:')
  }
}
