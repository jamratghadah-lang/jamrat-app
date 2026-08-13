// Unified API error handling.
//
// Every API route's catch block should use `handleApiError()` instead of
// the ad-hoc `console.error + return 500 generic` pattern. This gives:
//
//   1. Consistent error response shape: `{ error: string, code?: string }`
//   2. Structured logging via console.error with a stable prefix so log
//      aggregators can grep for `[api-error]`.
//   3. Prisma error translation — P2002 (unique constraint) → 409,
//      P2025 (record not found) → 404, instead of generic 500.
//   4. Zod errors are already handled at the validation step (safeParse),
//      but if one slips through, it's translated to 400.
//   5. Never leaks internal error details (stack traces, SQL, file paths)
//      to the client — only the safe Arabic message + optional code.
//   6. v11.2: includes the request ID (from X-Request-ID header) in
//      every log line so errors can be traced end-to-end across
//      middleware → route → audit log.

import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { getRequestId } from './request-id'

/**
 * Known error codes the client may receive. Keep this list in sync with
 * the frontend's error display logic (currently the frontend just shows
 * `error` as a toast — the `code` field is for future programmatic
 * handling, e.g. auto-retry on 429).
 */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR'

export interface ApiErrorShape {
  error: string
  code?: ApiErrorCode
  // Only included when NODE_ENV !== 'production' — helps debugging
  // without leaking internals in prod.
  details?: unknown
}

/**
 * Translates a thrown error into a structured NextResponse. Use this as
 * the catch-all in every API route handler:
 *
 *   } catch (error) {
 *     return handleApiError(error, 'Create schedule', request)
 *   }
 *
 * The `context` string is logged (helps trace which route threw) but
 * never sent to the client. The optional `request` parameter is used
 * to extract the X-Request-ID for log tracing (v11.2).
 */
export function handleApiError(
  error: unknown,
  context: string,
  request?: NextRequest,
): NextResponse<ApiErrorShape> {
  // Always log first — even if we later translate to a 4xx, the operator
  // needs to see what happened. The `[api-error]` prefix is stable so
  // log aggregators can grep for it.
  // We log the full error server-side (stack + context) but only send
  // a safe message to the client.
  const isProd = process.env.NODE_ENV === 'production'
  const requestId = request ? getRequestId(request) : 'no-request'
  const logPrefix = `[api-error] req=${requestId}`

  // ── Zod validation errors → 400 ──────────────────────────────────
  if (error instanceof ZodError) {
    const message = error.issues[0]?.message || 'بيانات غير صالحة'
    console.error(`${logPrefix} VALIDATION_ERROR in ${context}:`, message)
    return NextResponse.json<ApiErrorShape>(
      {
        error: message,
        code: 'VALIDATION_ERROR',
        ...(isProd ? {} : { details: error.issues }),
      },
      { status: 400 },
    )
  }

  // ── Prisma errors → translate known codes ────────────────────────
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2002: Unique constraint violation — e.g. duplicate email, duplicate
    // checkin. The client already knows the resource exists; tell it 409.
    if (error.code === 'P2002') {
      const target = (error.meta?.target as string[] | undefined)?.join(', ') || ''
      console.error(`${logPrefix} CONFLICT (P2002) in ${context}:`, target)
      return NextResponse.json<ApiErrorShape>(
        {
          error: 'القيمة موجودة بالفعل — لا يمكن تكرارها',
          code: 'CONFLICT',
          ...(isProd ? {} : { details: { target } }),
        },
        { status: 409 },
      )
    }
    // P2025: Record not found — e.g. updateMany on a deleted row.
    if (error.code === 'P2025') {
      console.error(`${logPrefix} NOT_FOUND (P2025) in ${context}`)
      return NextResponse.json<ApiErrorShape>(
        {
          error: 'السجل غير موجود',
          code: 'NOT_FOUND',
        },
        { status: 404 },
      )
    }
    // P2003: Foreign key constraint violation — e.g. inserting a guest
    // with a non-existent eventId. The client should know the related
    // record doesn't exist.
    if (error.code === 'P2003') {
      const field = (error.meta?.field_name as string | undefined) || ''
      console.error(`${logPrefix} VALIDATION_ERROR (P2003 FK) in ${context}:`, field)
      return NextResponse.json<ApiErrorShape>(
        {
          error: 'مرجع غير صالح — السجل المرتبط غير موجود',
          code: 'VALIDATION_ERROR',
          ...(isProd ? {} : { details: { field } }),
        },
        { status: 400 },
      )
    }
    // Other Prisma known errors — log the code but treat as 500 (we
    // don't have a clean translation for every code).
    console.error(`${logPrefix} Prisma ${error.code} in ${context}:`, error.message)
    return NextResponse.json<ApiErrorShape>(
      {
        error: 'حدث خطأ في قاعدة البيانات',
        code: 'INTERNAL_ERROR',
        ...(isProd ? {} : { details: { prismaCode: error.code, message: error.message } }),
      },
      { status: 500 },
    )
  }

  // ── Prisma unknown errors (connection, timeout) → 500 ────────────
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    console.error(`${logPrefix} Prisma unknown in ${context}:`, error.message)
    return NextResponse.json<ApiErrorShape>(
      {
        error: 'حدث خطأ في قاعدة البيانات',
        code: 'INTERNAL_ERROR',
        ...(isProd ? {} : { details: { message: error.message } }),
      },
      { status: 500 },
    )
  }

  // ── Prisma initialization errors → 503 ───────────────────────────
  if (error instanceof Prisma.PrismaClientInitializationError) {
    console.error(`${logPrefix} Prisma init in ${context}:`, error.message)
    return NextResponse.json<ApiErrorShape>(
      {
        error: 'الخدمة غير متاحة حالياً — تعذّر الاتصال بقاعدة البيانات',
        code: 'SERVICE_UNAVAILABLE',
      },
      { status: 503 },
    )
  }

  // ── Native Error (generic) → 500 ─────────────────────────────────
  // This is the catch-all for anything we don't recognize. We log the
  // full message + stack server-side, but only send a generic Arabic
  // message to the client (never leak internals in prod).
  const message = error instanceof Error ? error.message : String(error)
  console.error(`${logPrefix} INTERNAL_ERROR in ${context}:`, message)
  if (error instanceof Error && error.stack) {
    console.error(error.stack)
  }
  return NextResponse.json<ApiErrorShape>(
    {
      error: 'حدث خطأ غير متوقع',
      code: 'INTERNAL_ERROR',
      ...(isProd ? {} : { details: { message } }),
    },
    { status: 500 },
  )
}

// ── Convenience helpers for non-throw paths ────────────────────────
// These replace the inline `NextResponse.json({ error: '...' }, { status: ... })`
// pattern with something that's consistent and greppable. Use them in
// the early-return paths of route handlers (auth checks, RBAC, etc.).

export function unauthorized(message = 'غير مصرح'): NextResponse<ApiErrorShape> {
  return NextResponse.json<ApiErrorShape>({ error: message, code: 'UNAUTHORIZED' }, { status: 401 })
}

export function forbidden(message = 'ليس لديك صلاحية الوصول لهذا القسم'): NextResponse<ApiErrorShape> {
  return NextResponse.json<ApiErrorShape>({ error: message, code: 'FORBIDDEN' }, { status: 403 })
}

export function notFound(message = 'غير موجود'): NextResponse<ApiErrorShape> {
  return NextResponse.json<ApiErrorShape>({ error: message, code: 'NOT_FOUND' }, { status: 404 })
}

export function conflict(message: string): NextResponse<ApiErrorShape> {
  return NextResponse.json<ApiErrorShape>({ error: message, code: 'CONFLICT' }, { status: 409 })
}

export function rateLimited(message = 'تجاوزتِ عدد الطلبات المسموح. حاولي بعد 15 دقيقة.'): NextResponse<ApiErrorShape> {
  return NextResponse.json<ApiErrorShape>({ error: message, code: 'RATE_LIMITED' }, { status: 429 })
}

export function badRequest(message: string): NextResponse<ApiErrorShape> {
  return NextResponse.json<ApiErrorShape>({ error: message, code: 'VALIDATION_ERROR' }, { status: 400 })
}
