import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, canAccessEvent, canPerformEventAction, resolveRequestUserName } from '@/lib/event-access'
import { UpdateGuestInput, formatZodIssues } from '@/lib/validation'
import { recordAudit } from '@/lib/audit'
import { getRequestIp } from '@/lib/hooks'
import { forbidden, handleApiError, notFound, unauthorized } from '@/lib/api-errors'

const TRACKABLE_FIELDS = ['name', 'phone', 'email', 'companions', 'notes', 'confirmed', 'attended', 'sendStatus'] as const

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

    const currentGuest = await db.guest.findUnique({ where: { id } })
    if (!currentGuest) {
      return notFound('الضيف غير موجود')
    }
    if (!(await canAccessEvent(user, currentGuest.eventId))) {
      return forbidden('ليس لديك صلاحية الوصول لهذا الحدث')
    }
    if (!(await canPerformEventAction(user, currentGuest.eventId, 'manage'))) {
      return forbidden('ليس لديك صلاحية إدارة ضيوف هذه المناسبة')
    }

    const parsed = UpdateGuestInput.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(formatZodIssues(parsed.error), { status: 400 })
    }
    const updates: Record<string, unknown> = {}
    const editLogs: Array<{ field: string; oldValue: string; newValue: string }> = []
    for (const field of TRACKABLE_FIELDS) {
      const next = parsed.data[field as keyof typeof parsed.data]
      if (next === undefined) continue
      const prev = currentGuest[field as keyof typeof currentGuest]
      if (next === prev) continue
      updates[field] = next
      editLogs.push({ field, oldValue: String(prev ?? ''), newValue: String(next ?? '') })
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(currentGuest)
    }

    const userRecord = await db.user.findUnique({
      where: { id: user.id },
      select: { id: true, name: true, email: true },
    })
    const userName = userRecord?.name || userRecord?.email || user.role || 'المشرف'

    const guest = await db.$transaction(async (tx) => {
      const updated = await tx.guest.update({ where: { id }, data: updates })
      // PERFORMANCE (v10.8): batch edit-log inserts with createMany
      // instead of one create() per changed field. A single guest
      // update typically changes 1-3 fields, so the win is small here,
      // but it's still a 3×→1× round-trip reduction for the common case.
      if (editLogs.length > 0) {
        await tx.guestEditLog.createMany({
          data: editLogs.map((log) => ({
            guestId: id,
            eventId: currentGuest.eventId,
            field: log.field,
            oldValue: log.oldValue,
            newValue: log.newValue,
            userId: userRecord?.id || null,
            user: userName,
          })),
        })
      }
      if ('confirmed' in parsed.data) {
        const confirmedCount = await tx.guest.count({
          where: { eventId: updated.eventId, confirmed: 'confirmed', archivedAt: null },
        })
        await tx.event.update({ where: { id: updated.eventId }, data: { confirmed: confirmedCount } })
      }
      if ('attended' in parsed.data) {
        const attendedCount = await tx.guest.count({
          where: { eventId: updated.eventId, attended: 'attended' },
        })
        await tx.event.update({ where: { id: updated.eventId }, data: { attended: attendedCount } })
      }
      return updated
    })

    await recordAudit({
      eventId: currentGuest.eventId,
      userId: user.id,
      userName: userName,
      text: `تعديل ضيف ${currentGuest.name}`,
      entity: 'guest', entityId: currentGuest.id, action: 'guest_update',
      oldValue: Object.fromEntries(editLogs.map((l) => [l.field, l.oldValue])),
      newValue: Object.fromEntries(editLogs.map((l) => [l.field, l.newValue])),
      ipAddress: getRequestIp(request),
    })

    return NextResponse.json(guest)
  } catch (error) {
    return handleApiError(error, 'Update guest error:')
  }
}

// DELETE => soft-delete (archive) instead of physical delete. Restore
// goes through /api/trash/[id]/restore. Keeps every audit + check-in
// row intact.
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
    const guest = await db.guest.findFirst({ where: { id } })
    if (!guest) {
      return notFound('الضيف غير موجود')
    }
    if (!(await canAccessEvent(user, guest.eventId))) {
      return forbidden('ليس لديك صلاحية الوصول لهذا الحدث')
    }
    if (!(await canPerformEventAction(user, guest.eventId, 'manage'))) {
      return forbidden('ليس لديك صلاحية إدارة ضيوف هذه المناسبة')
    }

    await db.$transaction(async (tx) => {
      await tx.trashItem.create({
        data: {
          eventId: guest.eventId,
          name: guest.name,
          itemType: 'guest',
          eventRef: JSON.stringify(guest),
        },
      })
      await tx.guest.update({
        where: { id },
        data: {
          archivedAt: new Date(),
          qrToken: null,
          qrRevoked: true,
          qrRevokedAt: new Date(),
          hasQR: false,
        },
      })
      const guestCount = await tx.guest.count({
        where: { eventId: guest.eventId, archivedAt: null },
      })
      await tx.event.update({ where: { id: guest.eventId }, data: { guests: guestCount } })
    })

    await recordAudit({
      eventId: guest.eventId,
      userId: user.id, userName: await resolveRequestUserName(user),
      text: `أرشفة ضيف ${guest.name}`,
      entity: 'guest', entityId: guest.id, action: 'guest_archive',
      ipAddress: getRequestIp(request),
    })

    return NextResponse.json({ message: 'تم نقل الضيف إلى الأرشيف' })
  } catch (error) {
    return handleApiError(error, 'Archive guest error:')
  }
}
