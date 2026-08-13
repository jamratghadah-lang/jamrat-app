import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, canAccessEvent } from '@/lib/event-access'
import { CreateCommentInput, formatZodIssues } from '@/lib/validation'
import { badRequest, forbidden, handleApiError } from '@/lib/api-errors'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get('eventId')
    const user = getRequestUser(request)
    if (!eventId) return badRequest('معرف الحدث مطلوب')
    if (!(await canAccessEvent(user, eventId))) {
      return forbidden('ليس لديك صلاحية الوصول لهذا الحدث')
    }
    const comments = await db.comment.findMany({ where: { eventId }, orderBy: { createdAt: 'desc' } })
    return NextResponse.json(comments)
  } catch (error) {
    return handleApiError(error, 'Comments list error:')
  }
}

export async function POST(request: NextRequest) {
  try {
    // SECURITY (v10.7): Zod validation — previously the handler trusted
    // `body.eventId`, `body.text`, `body.guestName` as raw JSON. The
    // ad-hoc checks only verified eventId/text were non-empty after
    // string coercion, but accepted any value type (number, object,
    // array) for guestName, which would then be stored as the string
    // "[object Object]" or "123" silently. Now: 400 with a clear
    // Arabic message on any malformed field.
    const parsed = CreateCommentInput.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(formatZodIssues(parsed.error), { status: 400 })
    }
    const { eventId, text, guestName } = parsed.data
    const user = getRequestUser(request)
    if (!(await canAccessEvent(user, eventId))) {
      return forbidden('ليس لديك صلاحية الوصول لهذا الحدث')
    }
    const c = await db.comment.create({ data: { eventId, text, guestName } })
    return NextResponse.json(c, { status: 201 })
  } catch (error) {
    return handleApiError(error, 'Comments create error:')
  }
}
