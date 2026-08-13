// v10.4 fix-verification tests.
//
// NOTE: this file was referenced in package.json's `test` script and
// described in CHANGELOG.md by the previous pass, but was NOT actually
// present in that delivered zip — `npm test` would fail with
// MODULE_NOT_FOUND on the last step. This is a from-scratch replacement
// that verifies the actual current state of the code (after a few of
// the v10.4 fixes were corrected — see CHANGELOG "v10.5" section for
// what changed and why).
//
// Two kinds of checks:
//  1. rateLimit() behavior — imported and exercised directly.
//  2. Static greps over route/component source — confirms each fix
//     described in the changelog is actually present in the file,
//     and (for the ones we corrected) that the corrected version is
//     what's there, not the original overly-broad one.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { rateLimit } from '../src/lib/rate-limit'

const results: Array<{ name: string; pass: boolean; detail?: string }> = []
function check(name: string, cond: boolean, detail?: string) {
  results.push({ name, pass: !!cond, detail })
  process.stdout.write((cond ? '✓ ' : '✗ ') + name + (detail ? '  ' + detail : '') + '\n')
}

const root = join(__dirname, '..')
function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

// Strips full-line `//` comments so a check can't false-positive by
// matching text that only appears inside an explanatory code comment
// (several of the fixes below reference the OLD broken code in a
// comment explaining what changed).
function readLiveCode(path: string): string {
  return read(path)
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
}

// ── 1. rateLimit() behavior ────────────────────────────────────────

{
  const key = 'test:' + Math.random()
  check('first request under a fresh key is allowed', rateLimit(key, { max: 3, windowMs: 60_000 }))
  check('second request (still under max) is allowed', rateLimit(key, { max: 3, windowMs: 60_000 }))
  check('third request (hits max) is allowed', rateLimit(key, { max: 3, windowMs: 60_000 }))
  check('fourth request (over max) is blocked', !rateLimit(key, { max: 3, windowMs: 60_000 }))
}
{
  const key = 'test:' + Math.random()
  check('max=1 allows exactly one request', rateLimit(key, { max: 1, windowMs: 60_000 }))
  check('max=1 blocks the second request', !rateLimit(key, { max: 1, windowMs: 60_000 }))
}
{
  const keyA = 'test:a:' + Math.random()
  const keyB = 'test:b:' + Math.random()
  rateLimit(keyA, { max: 1, windowMs: 60_000 })
  check('separate keys have independent buckets', rateLimit(keyB, { max: 1, windowMs: 60_000 }))
}
{
  const key = 'test:default:' + Math.random()
  check('default options (no opts passed) still allow a request', rateLimit(key))
}

// ── 2. Static checks — each fix is actually present in the file ────

// archivedAt filters
const archivedAtFiles = [
  'src/app/api/public/route.ts',
  'src/app/api/public/rsvp/route.ts',
  'src/app/api/qr-verify/route.ts',
  'src/app/api/send/route.ts',
  'src/app/api/guests/export/route.ts',
]
for (const f of archivedAtFiles) {
  check(`${f} filters archivedAt: null`, /archivedAt\s*[:=]\s*null/.test(read(f)))
}

// rate limiting present
const rateLimitedFiles = [
  'src/app/api/public/rsvp/route.ts',
  'src/app/api/qr-verify/route.ts',
  'src/app/api/auth/request-reset/route.ts',
]
for (const f of rateLimitedFiles) {
  const src = read(f)
  check(`${f} imports rateLimit from lib/rate-limit`, src.includes("from '@/lib/rate-limit'"))
  check(`${f} calls rateLimit(...)`, /rateLimit\(/.test(src))
}

// events/[id]/route.ts: archived-event PATCH guard present, but
// 'status' is STILL accepted on PATCH (corrected — the original
// v10.4 draft removed it entirely and broke EventsPage.tsx's status
// dropdown). As of v10.6 the allowlist is enforced by the UpdateEventInput
// Zod schema (which includes `status: z.enum(['preparing','active','ended'])`,
// explicitly NOT 'archived'), not by the old `Array<keyof typeof current>`
// literal. The DELETE handler does NOT reject archived events (corrected
// — the original draft broke ArchivePage.tsx's permanent delete button,
// which specifically targets already-archived events).
{
  const src = read('src/app/api/events/[id]/route.ts')
  const validationSrc = read('src/lib/validation.ts')
  check('events/[id] PATCH rejects editing an already-archived event',
    /current\.status === 'archived'/.test(src))
  check("events/[id] PATCH still accepts 'status' (via UpdateEventInput Zod schema — keeps EventsPage dropdown working)",
    /UpdateEventInput\.safeParse\(/.test(src) &&
    /export const UpdateEventInput[\s\S]*?status:\s*z\.enum\(\[?'preparing',\s*?'active',\s*?'ended'\]\)/.test(validationSrc))
  check("events/[id] PATCH blocks setting status to 'archived' directly (must use /archive)",
    src.includes("data.status === 'archived'"))
  check('events/[id] DELETE does NOT block already-archived events (ArchivePage relies on this)',
    !/if\s*\(\s*ev\.status === 'archived'/.test(readLiveCode('src/app/api/events/[id]/route.ts')))
}

// templates/[id]/route.ts: global templates admin-only
{
  const src = read('src/app/api/templates/[id]/route.ts')
  const adminOnlyChecks = (src.match(/user\.role !== 'admin'/g) || []).length
  check('templates/[id] has admin-only checks for global templates (PUT + DELETE)', adminOnlyChecks >= 2)
}

// audit trails
const auditedFiles: Array<[string, string]> = [
  ['src/app/api/trash/[id]/route.ts', 'trash_permanent_delete'],
  ['src/app/api/media/route.ts', 'media_create'],
  ['src/app/api/media/route.ts', 'media_delete'],
  ['src/app/api/auth/reset-password/route.ts', 'password_reset'],
  ['src/app/api/trash/[id]/restore/route.ts', 'guest_restore'],
]
for (const [f, action] of auditedFiles) {
  check(`${f} records audit action '${action}'`, read(f).includes(action))
}

// trash restore: guest id bug fix (payload.id, not trash-row id)
{
  const src = read('src/app/api/trash/[id]/restore/route.ts')
  check('trash restore uses payload.id for the guest lookup (not the trash row id)',
    src.includes('const guestId = payload.id'))
  check('trash restore resets qrToken/hasQR on restore (no stale QR state)',
    src.includes('qrToken: null') && src.includes('hasQR: false'))
}

// SendLogPage: resend uses api.sendMessages, not api.createEvent
{
  const src = read('src/components/jamra/pages/SendLogPage.tsx')
  check('SendLogPage handleResend calls api.sendMessages', src.includes('api.sendMessages('))
  check('SendLogPage handleResend no longer calls api.createEvent for resend',
    !/api\.createEvent\(\{\s*action:\s*'resend'/.test(readLiveCode('src/components/jamra/pages/SendLogPage.tsx')))
}

// middleware.ts: runtime must be INSIDE config, not a stray top-level
// export (a stray export const runtime = 'nodejs' is silently ignored
// by Next.js's middleware loader — only config.runtime is read).
{
  const src = read('src/middleware.ts')
  const configBlockMatch = src.match(/export const config = \{[\s\S]*?\}/)
  check('middleware.ts config object exists', !!configBlockMatch)
  check("middleware.ts sets runtime: 'nodejs' INSIDE the config object",
    !!configBlockMatch && /runtime:\s*'nodejs'/.test(configBlockMatch[0]))
  check('middleware.ts has no stray top-level `export const runtime` (wrong for middleware)',
    !/^export const runtime = /m.test(src))
}

// crypto.ts: require() replaced with a top-level import
{
  const src = read('src/lib/crypto.ts')
  check('crypto.ts has no require() call', !src.includes('require('))
  check('crypto.ts imports createHash at the top', /^import \{[^}]*createHash[^}]*\}/m.test(src))
}

// eslint: no-undef off (TS handles it), doesn't silently re-disable
// the rules that actually catch bugs (no-explicit-any warns, etc.)
{
  const src = read('eslint.config.mjs')
  check("eslint no-undef is off (redundant with TS, was previously noisy)",
    /"no-undef":\s*"off"/.test(src))
}

// package.json: this file is actually wired into `npm test`
{
  const src = read('package.json')
  check('package.json test script includes v10.4-fixes.test.ts',
    src.includes('tests/v10.4-fixes.test.ts'))
  check('package.json test script includes webhook-signature.test.ts',
    src.includes('tests/webhook-signature.test.ts'))
}

const failed = results.filter((r) => !r.pass).length
const passed = results.length - failed
process.stdout.write(`\nSummary: ${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
