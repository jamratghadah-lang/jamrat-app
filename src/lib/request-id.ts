// Request ID generation + propagation.
//
// Every API request gets a unique ID (UUID v4) that's:
//   1. Generated in the middleware (or reused from X-Request-ID header
//      if the client provided one — useful for distributed tracing).
//   2. Injected into request headers as X-Request-ID.
//   3. Added to every response as X-Request-ID header.
//   4. Included in every [api-error] log line + every audit log row.
//
// This lets an operator trace a single request across:
//   - Caddy access logs
//   - Next.js middleware logs
//   - API route error logs ([api-error] lines)
//   - operation_logs table (audit trail)
//
// The ID is NOT a security primitive — it's for observability only.
// It's safe to expose to the client (it's in the response header).

import { randomUUID } from 'node:crypto'
import type { NextRequest, NextResponse } from 'next/server'

const REQUEST_ID_HEADER = 'X-Request-ID'

/**
 * Extracts the request ID from the incoming request, or generates a
 * fresh one if missing. Use this in the middleware to populate
 * X-Request-ID on the forwarded request headers.
 */
export function getOrCreateRequestId(request: NextRequest): string {
  const incoming = request.headers.get(REQUEST_ID_HEADER)
  if (incoming && isValidRequestId(incoming)) {
    return incoming
  }
  return randomUUID()
}

/**
 * Validates that a request ID looks like a UUID or a short hex string.
 * Prevents log injection via crafted X-Request-ID headers.
 */
function isValidRequestId(id: string): boolean {
  // UUID v4: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (36 chars)
  // Or short hex: 16-64 hex chars (for compatibility with other tracers)
  if (id.length > 128) return false // hard cap
  return /^[a-f0-9-]{8,128}$/i.test(id)
}

/**
 * Sets the X-Request-ID header on a NextResponse. Use this in the
 * middleware before returning the response so the client can correlate.
 */
export function setRequestIdHeader(response: NextResponse, requestId: string): void {
  response.headers.set(REQUEST_ID_HEADER, requestId)
}

/**
 * Reads the request ID from the forwarded request headers (set by
 * middleware). Use this inside API route handlers to include the ID
 * in logs and audit trails.
 */
export function getRequestId(request: NextRequest): string {
  return request.headers.get(REQUEST_ID_HEADER) || 'unknown'
}

export { REQUEST_ID_HEADER }
