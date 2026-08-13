// v11.1 convenience-helpers adoption verification tests.
//
// Confirms that the inline `NextResponse.json({ error: 'X' }, { status: 4xx })`
// patterns have been replaced with the convenience helpers
// (unauthorized, forbidden, notFound, conflict, badRequest) across
// all route files — except webhooks/whatsapp (custom auth flow).

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

// ─── 1. Inline 4xx patterns replaced ───────────────────────────────

{
  const routeFiles = findRouteFiles(join(root, 'src', 'app', 'api'))
  let filesWithOldInline = 0
  const oldInlineFiles: string[] = []

  for (const file of routeFiles) {
    const rel = relative(join(root, 'src', 'app', 'api'), file)
    // Skip webhooks/whatsapp (custom auth flow — intentional)
    if (rel === 'webhooks/whatsapp/route.ts') continue

    const liveCode = readLiveCode(relative(root, file))
    // Look for: NextResponse.json({ error: '...' }, { status: 401|403|404|409|400 })
    // (405 is excluded — no helper for it)
    if (/NextResponse\.json\(\{ error: '[^']*' \}, \{ status: 40[1-49] \}\)/.test(liveCode)) {
      filesWithOldInline++
      oldInlineFiles.push(rel)
    }
  }

  check(`no route file (except webhooks/whatsapp) has inline 4xx NextResponse.json patterns`,
    filesWithOldInline === 0,
    filesWithOldInline === 0 ? '' : `${filesWithOldInline} files: ${oldInlineFiles.slice(0, 5).join(', ')}...`)
}

// ─── 2. Helpers are used across many files ─────────────────────────

{
  const routeFiles = findRouteFiles(join(root, 'src', 'app', 'api'))
  const helperUsage: Record<string, string[]> = {
    unauthorized: [],
    forbidden: [],
    notFound: [],
    conflict: [],
    badRequest: [],
  }

  for (const file of routeFiles) {
    const rel = relative(join(root, 'src', 'app', 'api'), file)
    const content = read(relative(root, file))
    for (const helper of Object.keys(helperUsage)) {
      // Look for `helperName(` — function call
      if (new RegExp(`\\b${helper}\\(`).test(content)) {
        helperUsage[helper].push(rel)
      }
    }
  }

  // Each helper should be used in at least 2 files (reasonable adoption).
  // conflict() is rarer (only used for archived-status checks and
  // duplicate-checkin) so threshold is lower.
  const thresholds: Record<string, number> = {
    unauthorized: 5,
    forbidden: 5,
    notFound: 5,
    conflict: 2, // rare — only archived status + duplicate checkin
    badRequest: 5,
  }
  for (const [helper, files] of Object.entries(helperUsage)) {
    const threshold = thresholds[helper] || 5
    check(`${helper}() used in ≥${threshold} route files (got ${files.length})`,
      files.length >= threshold,
      files.length >= threshold ? '' : `files: ${files.slice(0, 3).join(', ')}`)
  }
}

// ─── 3. Specific route checks ──────────────────────────────────────

{
  // events/[id] should use conflict (for archived status check)
  const eventIdRoute = read('src/app/api/events/[id]/route.ts')
  check('events/[id] uses conflict() for archived status',
    eventIdRoute.includes('return conflict('))
  check('events/[id] uses forbidden() for RBAC',
    eventIdRoute.includes('return forbidden('))
  check('events/[id] uses notFound() for missing event',
    eventIdRoute.includes('return notFound('))

  // guests/[id] should use all helpers
  const guestIdRoute = read('src/app/api/guests/[id]/route.ts')
  check('guests/[id] uses unauthorized()',
    guestIdRoute.includes('return unauthorized('))
  check('guests/[id] uses forbidden()',
    guestIdRoute.includes('return forbidden('))
  check('guests/[id] uses notFound()',
    guestIdRoute.includes('return notFound('))

  // auth/login should use unauthorized + forbidden
  const loginRoute = read('src/app/api/auth/login/route.ts')
  check('auth/login uses unauthorized()',
    loginRoute.includes('return unauthorized(') || loginRoute.includes('unauthorized('))

  // public/rsvp should use badRequest + forbidden + notFound
  const rsvpRoute = read('src/app/api/public/rsvp/route.ts')
  check('public/rsvp uses badRequest()',
    rsvpRoute.includes('return badRequest('))
  check('public/rsvp uses forbidden()',
    rsvpRoute.includes('return forbidden('))
  check('public/rsvp uses notFound()',
    rsvpRoute.includes('return notFound('))
}

// ─── 4. webhooks/whatsapp still uses inline (intentional) ─────────

{
  const whatsappRoute = read('src/app/api/webhooks/whatsapp/route.ts')
  // This route has custom HMAC verification — inline 403 is intentional
  check('webhooks/whatsapp keeps inline 403 (custom HMAC flow — intentional)',
    /NextResponse\.json\(\{ error: '[^']*' \}, \{ status: 403 \}\)/.test(whatsappRoute))
}

// ─── 5. No 405 patterns converted (no helper for it) ──────────────

{
  // operations-log has 405 responses — these should NOT be converted
  const opLogRoute = read('src/app/api/operations-log/route.ts')
  check('operations-log keeps inline 405 (no helper for Method Not Allowed)',
    opLogRoute.includes('status: 405'))
}

// ─── Summary ────────────────────────────────────────────────────────

const failed = results.filter((r) => !r.pass).length
const passed = results.length - failed
process.stdout.write(`\nSummary: ${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
