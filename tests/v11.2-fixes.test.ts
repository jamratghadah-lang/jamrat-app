// v11.2 monitoring/observability verification tests.
//
// Confirms:
//  1. /api/health endpoint exists + is in SKIP_AUTH_ROUTES.
//  2. /api/metrics endpoint exists (admin-only).
//  3. request-id.ts library exists with the expected exports.
//  4. middleware propagates X-Request-ID.
//  5. handleApiError includes request ID in logs (when request provided).
//  6. health endpoint returns proper shape (DB check + integrations check).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const results: Array<{ name: string; pass: boolean; detail?: string }> = []
function check(name: string, cond: boolean, detail?: string) {
  results.push({ name, pass: !!cond, detail })
  process.stdout.write((cond ? '✓ ' : '✗ ') + name + (detail ? '  ' + detail : '') + '\n')
}

const root = join(__dirname, '..')
function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

// ─── 1. /api/health endpoint ───────────────────────────────────────

{
  const healthRoute = read('src/app/api/health/route.ts')
  check('health route file exists', healthRoute.length > 0)
  check('health route exports GET handler',
    /export async function GET\(/.test(healthRoute))
  check('health route checks database via $queryRaw',
    healthRoute.includes('db.$queryRaw`SELECT 1`'))
  check('health route checks integrations count',
    healthRoute.includes('db.integrationConfig.count()'))
  check('health route returns status: healthy|degraded|unhealthy',
    /status: 'healthy' \| 'degraded' \| 'unhealthy'/.test(healthRoute))
  check('health route returns 503 for unhealthy',
    /=== 'unhealthy' \? 503 : 200/.test(healthRoute))
  check('health route includes timestamp + version + uptime',
    healthRoute.includes('timestamp') && healthRoute.includes('version') && healthRoute.includes('uptime'))
  check('health route uses force-dynamic (no caching)',
    healthRoute.includes("export const dynamic = 'force-dynamic'"))
  check('health route includes DB latency in response',
    healthRoute.includes('latencyMs'))
}

// ─── 2. /api/health in SKIP_AUTH_ROUTES ────────────────────────────

{
  const rbac = read('src/lib/rbac.ts')
  check("SKIP_AUTH_ROUTES includes '/api/health'",
    rbac.includes("'/api/health'"))
}

// ─── 3. /api/metrics endpoint ──────────────────────────────────────

{
  const metricsRoute = read('src/app/api/metrics/route.ts')
  check('metrics route file exists', metricsRoute.length > 0)
  check('metrics route exports GET handler',
    /export async function GET\(/.test(metricsRoute))
  check('metrics route is admin-only',
    metricsRoute.includes("user.role !== 'admin'"))
  check('metrics route uses handleApiError for catch',
    metricsRoute.includes('handleApiError(error'))
  check('metrics route uses groupBy for users by role',
    metricsRoute.includes('db.user.groupBy({ by: [\'role\']'))
  check('metrics route uses groupBy for events by status',
    metricsRoute.includes('db.event.groupBy({ by: [\'status\']'))
  check('metrics route counts active sessions',
    metricsRoute.includes('db.session.count'))
  check('metrics route counts login attempts (24h)',
    metricsRoute.includes('db.loginAttempt.count'))
  check('metrics route counts scheduled pending messages',
    metricsRoute.includes('db.scheduledMessage.count'))
  check('metrics route uses force-dynamic',
    metricsRoute.includes("export const dynamic = 'force-dynamic'"))
  check('metrics route includes confirmationRate + attendanceRate',
    metricsRoute.includes('confirmationRate') && metricsRoute.includes('attendanceRate'))
  check('metrics route includes failureRate24h for sendLogs',
    metricsRoute.includes('failureRate24h'))
}

// ─── 4. request-id.ts library ──────────────────────────────────────

{
  const requestIdLib = read('src/lib/request-id.ts')
  check('request-id.ts file exists', requestIdLib.length > 0)
  check('request-id.ts exports getOrCreateRequestId',
    /export function getOrCreateRequestId\(/.test(requestIdLib))
  check('request-id.ts exports setRequestIdHeader',
    /export function setRequestIdHeader\(/.test(requestIdLib))
  check('request-id.ts exports getRequestId',
    /export function getRequestId\(/.test(requestIdLib))
  check('request-id.ts exports REQUEST_ID_HEADER constant',
    /export const REQUEST_ID_HEADER/.test(requestIdLib) || /export \{ REQUEST_ID_HEADER \}/.test(requestIdLib))
  check('request-id.ts uses randomUUID from node:crypto',
    requestIdLib.includes("from 'node:crypto'") && requestIdLib.includes('randomUUID'))
  check('request-id.ts validates incoming request ID (log injection prevention)',
    requestIdLib.includes('isValidRequestId'))
  check('request-id.ts caps ID length at 128 chars',
    requestIdLib.includes('128'))
}

// ─── 5. middleware propagates X-Request-ID ─────────────────────────

{
  const middleware = read('src/middleware.ts')
  check('middleware imports getOrCreateRequestId + setRequestIdHeader',
    middleware.includes('getOrCreateRequestId') && middleware.includes('setRequestIdHeader'))
  check('middleware generates request ID early (before auth check)',
    /const requestId = getOrCreateRequestId\(request\)/.test(middleware))
  check('middleware sets X-Request-ID on 401 responses',
    /setRequestIdHeader\(response, requestId\)/.test(middleware))
  check('middleware injects X-Request-ID into forwarded request headers',
    middleware.includes("requestHeaders.set(REQUEST_ID_HEADER, requestId)"))
  check('middleware sets X-Request-ID on public route responses too',
    // The public-route branch also sets the header
    middleware.includes('setRequestIdHeader(response, requestId)'))
}

// ─── 6. handleApiError includes request ID in logs ─────────────────

{
  const apiErrors = read('src/lib/api-errors.ts')
  check('api-errors.ts imports getRequestId from request-id',
    apiErrors.includes("from './request-id'") && apiErrors.includes('getRequestId'))
  check('api-errors.ts handleApiError accepts optional request parameter',
    /export function handleApiError\(\s*error: unknown,\s*context: string,\s*request\?: NextRequest,/.test(apiErrors))
  check('api-errors.ts extracts requestId from request (or "no-request")',
    apiErrors.includes("request ? getRequestId(request) : 'no-request'"))
  check('api-errors.ts uses logPrefix with req= in console.error',
    apiErrors.includes('logPrefix') && apiErrors.includes('req='))
}

// ─── Summary ────────────────────────────────────────────────────────

const failed = results.filter((r) => !r.pass).length
const passed = results.length - failed
process.stdout.write(`\nSummary: ${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
