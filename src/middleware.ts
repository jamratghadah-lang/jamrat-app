// Next.js middleware — MUST be named `middleware` and live at
// `src/middleware.ts` (or `middleware.ts` at project root) to be picked
// up by Next.js. The previous version was named `proxy.ts` and exported
// a function called `proxy`, which Next.js silently ignored — leaving
// every protected API route without auth headers.

import { NextRequest, NextResponse } from 'next/server'
import { verifyTokenWithDb } from '@/lib/auth'
import { canAccessRoute, SKIP_AUTH_ROUTES } from '@/lib/rbac'
import { getOrCreateRequestId, setRequestIdHeader, REQUEST_ID_HEADER } from '@/lib/request-id'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only intercept /api/* routes — pages are protected in React state.
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // v11.2: generate or reuse a request ID for tracing. This is done
  // BEFORE the auth check so even 401/403 responses carry the ID —
  // the operator can trace a failed auth attempt end-to-end.
  const requestId = getOrCreateRequestId(request)

  // Public routes that don't require auth (login, public, cron, webhooks, qr-verify, robot).
  for (const skip of SKIP_AUTH_ROUTES) {
    if (pathname === skip || pathname.startsWith(skip + '/')) {
      const response = NextResponse.next()
      setRequestIdHeader(response, requestId)
      // Also inject into request headers so downstream handlers can read it.
      const requestHeaders = new Headers(request.headers)
      requestHeaders.set(REQUEST_ID_HEADER, requestId)
      return NextResponse.next({
        request: { headers: requestHeaders },
        headers: response.headers,
      })
    }
  }

  // Validate Bearer token against DB-backed sessions.
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) {
    const response = NextResponse.json({ error: 'غير مصرح — مفقود رمز المصادقة' }, { status: 401 })
    setRequestIdHeader(response, requestId)
    return response
  }
  const parts = authHeader.split(' ')
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    const response = NextResponse.json({ error: 'غير مصرح — صيغة الرمز غير صحيحة' }, { status: 401 })
    setRequestIdHeader(response, requestId)
    return response
  }

  const payload = await verifyTokenWithDb(parts[1])
  if (!payload) {
    const response = NextResponse.json({ error: 'غير مصرح — رمز المصادقة غير صالح أو منتهي الصلاحية' }, { status: 401 })
    setRequestIdHeader(response, requestId)
    return response
  }

  // RBAC: route prefix check + method-aware deny-list for read-only
  // roles (see rbac.ts). Passing the method is critical — without it,
  // GET /api/events would be blocked for `sender`, breaking the
  // SendCenterPage which lists events in its dropdown.
  if (!canAccessRoute(payload.role, pathname, request.method)) {
    const response = NextResponse.json({ error: 'ليس لديك صلاحية الوصول لهذا القسم' }, { status: 403 })
    setRequestIdHeader(response, requestId)
    return response
  }

  // Inject verified identity into request headers for downstream handlers.
  // NEVER trust a userId/role coming from the request body or query.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('X-User-Id', payload.userId)
  requestHeaders.set('X-User-Role', payload.role)
  requestHeaders.set('X-User-Email', payload.email)
  requestHeaders.set('X-User-Name', payload.email) // resolved to real name in handlers via resolveSession()
  // v11.2: propagate the request ID so route handlers can include it
  // in logs and audit trails.
  requestHeaders.set(REQUEST_ID_HEADER, requestId)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  setRequestIdHeader(response, requestId)
  return response
}

export const config = {
  // Run on every /api route except Next.js internals and static assets.
  matcher: ['/api/:path*'],
  // Node.js runtime (not Edge — the default) so we can use `node:crypto`
  // for HMAC-SHA256 (token-hash.ts) and `jsonwebtoken` (auth.ts). Edge
  // Runtime doesn't support these Node built-ins.
  //
  // IMPORTANT: this MUST live inside `config`, not as a separate
  // top-level `export const runtime = 'nodejs'` — that top-level form
  // is the route-segment-config convention used in page.tsx/route.ts
  // files. Next.js's middleware loader only reads `runtime` off the
  // `config` object; a stray top-level export is silently ignored,
  // which would leave middleware running on Edge with a `jsonwebtoken`
  // import that fails at runtime. Requires Next.js >= 15.5 (stable) —
  // this project is on 16.x, so it's available.
  runtime: 'nodejs',
}
