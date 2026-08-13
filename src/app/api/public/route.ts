// Public read endpoint used by the invitation preview page. Returns
// only the safe-to-expose fields of an event + the template text.
//
// Supports BOTH GET (legacy, leaks `password` in server logs) and POST
// (preferred — credentials travel in the body). The RSVP page now uses
// POST. GET remains for backward compatibility with any cached links.
//
// Rate-limited per IP to slow down password-guessing attacks.

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { db } from '@/lib/db'
import { handleApiError } from '@/lib/api-errors'

// In-memory rate limiter (per-instance). Good enough for a single-node
// deployment; for multi-node, switch to the DB-backed pattern used by
// login-rate-limit.ts.
const WINDOW_MS = 15 * 60 * 1000
const MAX_REQUESTS = 60
const buckets = new Map<string, { count: number; resetAt: number }>()

function rateLimit(ip: string): boolean {
  const now = Date.now()
  const b = buckets.get(ip)
  if (!b || b.resetAt < now) {
    buckets.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (b.count >= MAX_REQUESTS) return false
  b.count++
  return true
}

function getIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown'
}

/**
 * Constant-time string comparison. Avoids leaking information about the
 * event password through response-timing differences. Falls back to a
 * plain `===` only when one side is empty (we still want to return
 * `false` quickly in that case without allocating Buffers).
 *
 * `crypto.timingSafeEqual` requires equal-length buffers; we pad both
 * sides to the same length so different-length passwords don't leak
 * their length either.
 */
function safeStringEqual(a: string, b: string): boolean {
  if (!a || !b) return a === b
  const aBuf = Buffer.from(a, 'utf8')
  const bBuf = Buffer.from(b, 'utf8')
  const len = Math.max(aBuf.length, bBuf.length)
  const aPadded = Buffer.alloc(len)
  const bPadded = Buffer.alloc(len)
  aBuf.copy(aPadded)
  bBuf.copy(bPadded)
  return crypto.timingSafeEqual(aPadded, bPadded)
}

async function resolveEvent(input: { token?: string; eventId?: string; guestId?: string; password?: string }) {
  const { token, eventId, guestId, password } = input

  if (!eventId && !token) {
    return { error: 'رابط المناسبة غير صالح', status: 400 }
  }
  if (token && token.length < 16) {
    return { error: 'token غير صالح', status: 400 }
  }

  let event = await db.event.findFirst({
    where: eventId ? { id: eventId } : undefined,
    select: {
      id: true, name: true, client: true, date: true, time: true, location: true, hasInteractivePage: true,
      password: true,
    },
  })
  if (!event && token) {
    // SECURITY (v10.4): filter archivedAt so a trashed guest's token
    // can't be used to view the public event page.
    const guestByToken = await db.guest.findFirst({
      where: { qrToken: token, qrRevoked: false, archivedAt: null },
      select: { event: { select: { id: true, name: true, client: true, date: true, time: true, location: true, hasInteractivePage: true, password: true } } },
    })
    event = guestByToken?.event ?? null
  }
  if (!event) return { error: 'حدث غير موجود', status: 404 }

  const eventPassword = event.password || ''
  const guestByToken = token
    ? await db.guest.findFirst({ where: { qrToken: token, eventId: event.id, qrRevoked: false, archivedAt: null }, select: { id: true } })
    : null
  const authorizedByGuestToken = !!guestByToken
  // SECURITY (v10.6): use constant-time comparison for the event password
  // to prevent timing-attack-based password recovery. Mitigated (not
  // eliminated) by the rate limiter, but the rate limiter doesn't help
  // against an attacker who can spread requests across IPs.
  const authorizedByPassword = !!eventPassword && safeStringEqual(password || '', eventPassword)
  if (!authorizedByGuestToken && !authorizedByPassword) {
    return { error: 'غير مصرح للوصول إلى صفحة المناسبة', status: 403 }
  }

  const template = await db.template.findFirst({
    where: { OR: [{ type: 'invite' }, { eventId: event.id, type: 'invite' }] },
    orderBy: { updatedAt: 'desc' },
  })

  const guest = guestId
    ? await db.guest.findFirst({ where: { id: guestId, eventId: event.id }, select: { name: true, confirmed: true, attended: true } })
    : null

  return {
    body: {
      event: { id: event.id, name: event.name, client: event.client, date: event.date, time: event.time, location: event.location, hasInteractivePage: event.hasInteractivePage },
      templateText: template?.text || '',
      guest,
    },
  }
}

export async function GET(request: NextRequest) {
  if (!rateLimit(getIp(request))) {
    return NextResponse.json({ error: 'تجاوزتِ عدد الطلبات المسموح. حاولي بعد 15 دقيقة.' }, { status: 429 })
  }
  try {
    const { searchParams } = new URL(request.url)
    const input = {
      token: String(searchParams.get('token') || ''),
      eventId: String(searchParams.get('eventId') || ''),
      guestId: String(searchParams.get('guestId') || ''),
      password: String(searchParams.get('password') || ''),
    }
    const result = await resolveEvent(input)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json(result.body)
  } catch (error) {
    return handleApiError(error, 'Public event GET error:')
  }
}

export async function POST(request: NextRequest) {
  if (!rateLimit(getIp(request))) {
    return NextResponse.json({ error: 'تجاوزتِ عدد الطلبات المسموح. حاولي بعد 15 دقيقة.' }, { status: 429 })
  }
  try {
    const input = await request.json().catch(() => ({})) as {
      token?: string; eventId?: string; guestId?: string; password?: string
    }
    const result = await resolveEvent(input)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json(result.body)
  } catch (error) {
    return handleApiError(error, 'Public event POST error:')
  }
}
