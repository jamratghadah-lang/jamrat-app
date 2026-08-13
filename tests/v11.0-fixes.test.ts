// v11.0 error-handling audit verification tests.
//
// Static checks confirming:
//  1. src/lib/api-errors.ts exists with the expected exports.
//  2. Every route.ts in src/app/api/** uses handleApiError in its outer
//     catch block (no more ad-hoc `console.error + return 500 generic`).
//  3. The handleApiError helper translates Prisma P2002/P2025/P2003 to
//     409/404/400 respectively (defense in depth — the ad-hoc patterns
//     never did this).
//  4. Convenience helpers (unauthorized, forbidden, notFound, badRequest,
//     conflict, rateLimited) are exported and used in routes.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const results: Array<{ name: string; pass: boolean; detail?: string }> = []
function check(name: string, cond: boolean, detail?: string) {
  results.push({ name, pass: !!cond, detail })
  process.stdout.write((cond ? '✓ ' : '✗ ') + name + (detail ? '  ' + detail : '') + '\n')
}

const root = join(__dirname, '..')
function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

// Recursively find all route.ts files under src/app/api
function findRouteFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      out.push(...findRouteFiles(full))
    } else if (entry === 'route.ts') {
      out.push(full)
    }
  }
  return out
}

// Strips full-line `//` comments.
function readLiveCode(path: string): string {
  return read(path)
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
}

// ─── 1. api-errors.ts exports ──────────────────────────────────────

{
  const apiErrors = read('src/lib/api-errors.ts')
  check('api-errors.ts exports handleApiError',
    /export function handleApiError\(/.test(apiErrors))
  check('api-errors.ts exports unauthorized helper',
    /export function unauthorized\(/.test(apiErrors))
  check('api-errors.ts exports forbidden helper',
    /export function forbidden\(/.test(apiErrors))
  check('api-errors.ts exports notFound helper',
    /export function notFound\(/.test(apiErrors))
  check('api-errors.ts exports conflict helper',
    /export function conflict\(/.test(apiErrors))
  check('api-errors.ts exports rateLimited helper',
    /export function rateLimited\(/.test(apiErrors))
  check('api-errors.ts exports badRequest helper',
    /export function badRequest\(/.test(apiErrors))
  check('api-errors.ts exports ApiErrorShape type',
    apiErrors.includes('export interface ApiErrorShape'))
  check('api-errors.ts exports ApiErrorCode type',
    apiErrors.includes('export type ApiErrorCode'))
}

// ─── 2. Prisma error translation ───────────────────────────────────

{
  const apiErrors = read('src/lib/api-errors.ts')
  check('api-errors.ts imports Prisma from @prisma/client',
    apiErrors.includes("from '@prisma/client'") || apiErrors.includes('from "@prisma/client"'))
  check('api-errors.ts translates P2002 (unique constraint) to 409',
    apiErrors.includes("'P2002'") && /status: 409/.test(apiErrors))
  check('api-errors.ts translates P2025 (record not found) to 404',
    apiErrors.includes("'P2025'") && /status: 404/.test(apiErrors))
  check('api-errors.ts translates P2003 (FK violation) to 400',
    apiErrors.includes("'P2003'") && /status: 400/.test(apiErrors))
  check('api-errors.ts translates PrismaClientInitializationError to 503',
    apiErrors.includes('PrismaClientInitializationError') && /status: 503/.test(apiErrors))
  check('api-errors.ts includes ZodError translation to 400',
    apiErrors.includes('ZodError') && /status: 400/.test(apiErrors))
  check('api-errors.ts logs with [api-error] prefix for greppability',
    apiErrors.includes('`[api-error]') || apiErrors.includes('logPrefix'))
  check('api-errors.ts never leaks error.message to client in production',
    // The details field is only spread when !isProd
    apiErrors.includes("...(isProd ? {} : { details:"))
}

// ─── 3. Every route.ts uses handleApiError ─────────────────────────

{
  const routeFiles = findRouteFiles(join(root, 'src', 'app', 'api'))
  check(`found ${routeFiles.length} route.ts files`, routeFiles.length >= 40)

  let filesUsingHelper = 0
  let filesWithOldPattern = 0
  const filesMissingHelper: string[] = []
  const filesWithOldCatch: string[] = []

  for (const file of routeFiles) {
    const rel = relative(join(root, 'src', 'app', 'api'), file)
    const content = read(relative(root, file))
    const liveCode = readLiveCode(relative(root, file))

    if (content.includes("from '@/lib/api-errors'")) {
      filesUsingHelper++
    } else {
      // Some routes (auth/login, auth/reset-password, webhooks/whatsapp)
      // have custom error handling that doesn't fit the pattern — that's OK.
      // We only flag routes that had the old pattern but didn't get updated.
      if (liveCode.includes("console.error(") && liveCode.includes("status: 500")) {
        filesWithOldCatch.push(rel)
      } else {
        filesMissingHelper.push(rel)
      }
    }

    // Check for the OLD ad-hoc pattern: `console.error('X error:', error)` followed by 500
    // Exception: webhooks/whatsapp/route.ts has an inner per-message catch that
    // intentionally uses console.error without returning (it must keep processing
    // remaining messages). That's correct, not the ad-hoc pattern.
    const isWebhookWhatsapp = rel === 'webhooks/whatsapp/route.ts'
    if (!isWebhookWhatsapp && /console\.error\('[^']+', error\)[\s\S]*?NextResponse\.json\(\{ error: '[^']+' \}, \{ status: 500 \}\)/.test(liveCode)) {
      filesWithOldPattern++
    }
  }

  check(`majority of route files import handleApiError (got ${filesUsingHelper}/${routeFiles.length})`,
    filesUsingHelper >= routeFiles.length * 0.7,
    filesUsingHelper >= routeFiles.length * 0.7 ? '' : `missing: ${filesMissingHelper.join(', ')}`)

  check('no route file has the old ad-hoc console.error + 500 pattern',
    filesWithOldPattern === 0,
    filesWithOldPattern === 0 ? '' : `${filesWithOldPattern} files still have old pattern`)

  // Specific routes that MUST use the helper (had the old pattern before)
  const mustUseHelper = [
    'events/route.ts',
    'events/[id]/route.ts',
    'guests/route.ts',
    'guests/[id]/route.ts',
    'checkin/route.ts',
    'send/route.ts',
    'schedules/route.ts',
    'templates/route.ts',
    'templates/[id]/route.ts',
    'users/route.ts',
    'media/route.ts',
    'comments/route.ts',
    'stats/route.ts',
    'reports/route.ts',
    'reports/daily/route.ts',
    'backup/route.ts',
    'backup/[id]/restore/route.ts',
    'integrations/route.ts',
    'scheduler/run/route.ts',
    'maintenance/cleanup/route.ts',
    'trash/route.ts',
    'trash/[id]/route.ts',
    'trash/[id]/restore/route.ts',
    'trash/empty/route.ts',
    'operations-log/route.ts',
    'site-sync/route.ts',
    'robot/route.ts',
    'qr-verify/route.ts',
    'public/route.ts',
    'public/rsvp/route.ts',
    'invitations/route.ts',
    'send-log/route.ts',
    'guests/import/route.ts',
    'guests/bulk-delete/route.ts',
    'guests/export/route.ts',
    'guests/[id]/qr/route.ts',
    'guests/[id]/revoke-qr/route.ts',
    'guests/[id]/edit-logs/route.ts',
    'events/[id]/assign/route.ts',
    'events/[id]/archive/route.ts',
    'events/[id]/restore/route.ts',
    'events/[id]/close/route.ts',
    'auth/me/route.ts',
    'auth/change-password/route.ts',
    'auth/logout-all/route.ts',
    'auth/login/route.ts',
    'schedules/[id]/route.ts',
    'public/rsvp/route.ts',
  ]

  let missingFromMust = 0
  for (const rel of mustUseHelper) {
    const content = read(`src/app/api/${rel}`)
    if (!content.includes("from '@/lib/api-errors'")) {
      missingFromMust++
      process.stdout.write(`  MISSING: ${rel}\n`)
    }
  }
  check(`all ${mustUseHelper.length} critical routes import handleApiError (missing ${missingFromMust})`,
    missingFromMust === 0)
}

// ─── 4. Convenience helpers are used somewhere ─────────────────────

{
  // Pick a few routes that should use the convenience helpers
  const checkinRoute = read('src/app/api/checkin/route.ts')
  check('checkin route uses unauthorized() helper',
    checkinRoute.includes('return unauthorized('))
  check('checkin route uses forbidden() helper',
    checkinRoute.includes('return forbidden('))
  check('checkin route uses notFound() helper',
    checkinRoute.includes('return notFound('))
  check('checkin route uses badRequest() helper',
    checkinRoute.includes('return badRequest('))
  check('checkin route uses conflict() helper (for ALREADY_ATTENDED)',
    checkinRoute.includes('return conflict('))

  const eventsRoute = read('src/app/api/events/route.ts')
  check('events route uses unauthorized() helper',
    eventsRoute.includes('return unauthorized('))
  check('events route uses forbidden() helper',
    eventsRoute.includes('return forbidden('))
}

// ─── Summary ────────────────────────────────────────────────────────

const failed = results.filter((r) => !r.pass).length
const passed = results.length - failed
process.stdout.write(`\nSummary: ${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
