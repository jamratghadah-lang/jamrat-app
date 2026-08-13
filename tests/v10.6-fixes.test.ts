// v10.6 fix-verification tests.
//
// Static greps over route/component source that confirm each fix
// described in the v10.6 section of CHANGELOG.md is actually present
// in the code (not just described in prose). Same pattern as
// v10.4-fixes.test.ts — read the file as text, assert the corrected
// snippet exists, and (for the security-critical ones) assert the
// OLD broken pattern does NOT exist anywhere in the live code.

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

// Strips full-line `//` comments so a check can't false-positive by
// matching text that only appears inside an explanatory code comment.
function readLiveCode(path: string): string {
  return read(path)
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
}

// ─── 1. Constant-time password comparison (public + rsvp) ───────────

{
  const publicRoute = read('src/app/api/public/route.ts')
  const rsvpRoute = read('src/app/api/public/rsvp/route.ts')

  check('public route imports node:crypto',
    publicRoute.includes("import crypto from 'node:crypto'"))
  check('public route defines safeStringEqual helper',
    publicRoute.includes('function safeStringEqual'))
  check('public route uses safeStringEqual for password check (not ===)',
    /safeStringEqual\(\s*password\s*\|\|\s*''\s*,\s*eventPassword\)/.test(publicRoute))
  check('public route no longer uses `password === eventPassword` in live code',
    !/password\s*===\s*eventPassword/.test(readLiveCode('src/app/api/public/route.ts')))

  check('rsvp route imports node:crypto',
    rsvpRoute.includes("import crypto from 'node:crypto'"))
  check('rsvp route defines safeStringEqual helper',
    rsvpRoute.includes('function safeStringEqual'))
  check('rsvp route uses safeStringEqual for password check (not ===)',
    /safeStringEqual\(\s*password\s*\|\|\s*''\s*,\s*event\.password\)/.test(rsvpRoute))
  check('rsvp route no longer uses `password === event.password` in live code',
    !/password\s*===\s*event\.password/.test(readLiveCode('src/app/api/public/rsvp/route.ts')))
}

// ─── 2. Zod validation on previously-unvalidated POST bodies ────────

{
  const validation = read('src/lib/validation.ts')
  check('validation.ts exports CreateScheduleInput',
    validation.includes('export const CreateScheduleInput'))
  check('validation.ts exports SendMessageInput',
    validation.includes('export const SendMessageInput'))
  check('validation.ts exports SendInvitationInput',
    validation.includes('export const SendInvitationInput'))
  check('validation.ts exports UpdateEventInput',
    validation.includes('export const UpdateEventInput'))
  check('validation.ts exports AssignEventUserInput',
    validation.includes('export const AssignEventUserInput'))
  // UpdateEventInput must NOT accept status:'archived' (must go through
  // POST /archive). The enum should be ['preparing','active','ended'] only.
  check("UpdateEventInput rejects status:'archived' (forces /archive flow)",
    /UpdateEventInput[\s\S]*?status:\s*z\.enum\(\[?'preparing',\s*?'active',\s*?'ended'\]\)/.test(validation))
}

{
  const schedules = read('src/app/api/schedules/route.ts')
  check('schedules POST imports CreateScheduleInput',
    schedules.includes("CreateScheduleInput") && schedules.includes("formatZodIssues"))
  check('schedules POST uses safeParse on the body',
    /CreateScheduleInput\.safeParse\(/.test(schedules))
  check('schedules POST no longer reads body.eventId via String(body.eventId || "")',
    !/String\(body\.eventId\s*\|\|\s*''\)/.test(readLiveCode('src/app/api/schedules/route.ts')))
}

{
  const send = read('src/app/api/send/route.ts')
  check('send POST imports SendMessageInput',
    send.includes("SendMessageInput") && send.includes("formatZodIssues"))
  check('send POST uses safeParse on the body',
    /SendMessageInput\.safeParse\(/.test(send))
  check('send POST no longer casts body as { eventId?: string; ... }',
    !/body as \{\s*eventId\?:\s*string;/.test(readLiveCode('src/app/api/send/route.ts')))
}

{
  const invitations = read('src/app/api/invitations/route.ts')
  check('invitations POST imports SendInvitationInput',
    invitations.includes("SendInvitationInput") && invitations.includes("formatZodIssues"))
  check('invitations POST uses safeParse on the body',
    /SendInvitationInput\.safeParse\(/.test(invitations))
}

{
  const eventPatch = read('src/app/api/events/[id]/route.ts')
  check('events/[id] PATCH imports UpdateEventInput',
    eventPatch.includes("UpdateEventInput") && eventPatch.includes("formatZodIssues"))
  check('events/[id] PATCH uses safeParse on the body',
    /UpdateEventInput\.safeParse\(/.test(eventPatch))
  // The old ad-hoc allowlist array should be gone (it was the source
  // of the mass-assignment-adjacent bug — accepted any string for status).
  check('events/[id] PATCH no longer has the old Array<keyof typeof current> allowlist',
    !/Array<keyof typeof current>/.test(readLiveCode('src/app/api/events/[id]/route.ts')))
}

{
  const assign = read('src/app/api/events/[id]/assign/route.ts')
  check('events/[id]/assign POST imports AssignEventUserInput',
    assign.includes("AssignEventUserInput") && assign.includes("formatZodIssues"))
  check('events/[id]/assign POST uses safeParse on the body',
    /AssignEventUserInput\.safeParse\(/.test(assign))
  check('events/[id]/assign POST no longer casts body as { userId?: string; role?: string }',
    !/body as \{\s*userId\?:\s*string;\s*role\?:\s*string\s*\}/.test(readLiveCode('src/app/api/events/[id]/assign/route.ts')))
}

// ─── 3. backup/[id]/restore — mass-assignment hardening ────────────

{
  const restore = read('src/app/api/backup/[id]/restore/route.ts')
  // The dangerous `...u` spread on raw backup rows must be gone for
  // every model. We replaced them with `pick(row, MODEL_FIELDS)`.
  check('restore defines explicit USER_FIELDS allowlist',
    restore.includes('const USER_FIELDS') && restore.includes("'role'"))
  check('restore defines explicit EVENT_FIELDS allowlist',
    restore.includes('const EVENT_FIELDS'))
  check('restore defines explicit GUEST_FIELDS allowlist',
    restore.includes('const GUEST_FIELDS'))
  check('restore defines explicit CHECKIN_FIELDS allowlist',
    restore.includes('const CHECKIN_FIELDS'))
  check('restore defines explicit SENDLOG_FIELDS allowlist',
    restore.includes('const SENDLOG_FIELDS'))
  check('restore defines explicit TEMPLATE_FIELDS allowlist',
    restore.includes('const TEMPLATE_FIELDS'))
  check('restore defines a `pick` helper for field allowlisting',
    /function pick\b/.test(restore))
  // The dangerous spread `...u` into usersOut must be replaced with
  // `...pick(u, USER_FIELDS)`.
  check('restore uses pick(u, USER_FIELDS) for users (no raw `...u` spread)',
    /pick\(u as Record<string, unknown>, USER_FIELDS\)/.test(restore))
  check('restore uses pick(e, EVENT_FIELDS) for events (no raw `...e` spread)',
    /pick\(e as Record<string, unknown>, EVENT_FIELDS\)/.test(restore))
  check('restore uses pick(g, GUEST_FIELDS) for guests (no raw `...g` spread)',
    /pick\(g as Record<string, unknown>, GUEST_FIELDS\)/.test(restore))
  // Unknown roles must be coerced to 'staff', not stored as-is.
  check('restore coerces unknown roles to "staff" (no role injection)',
    restore.includes("picked.role = 'staff'"))
  // qrToken must NEVER be restored from the backup — always set to null
  // so admins must re-issue QR codes. (Hardened backups already strip
  // qrToken at export; this is the defense-in-depth on the import side.)
  check('restore forces qrToken: null on guests (never trusts backup value)',
    /qrToken:\s*null/.test(restore))
}

// ─── 4. /api/reports/daily accepts POST (admin/staff manual trigger) ─

{
  const daily = read('src/app/api/reports/daily/route.ts')
  check('reports/daily exports POST handler',
    /export async function POST\(/.test(daily))
  check('reports/daily POST verifies Authorization Bearer header',
    /request\.headers\.get\('Authorization'\)/.test(daily) &&
    /authHeader\.startsWith\('Bearer '\)/.test(daily))
  check('reports/daily POST calls verifyTokenWithDb',
    daily.includes('verifyTokenWithDb'))
  check('reports/daily POST rejects roles other than admin/staff',
    /payload\.role !== 'admin' && payload\.role !== 'staff'/.test(daily))
  check('reports/daily still exports GET (cron-only, unchanged)',
    /export async function GET\(/.test(daily) && daily.includes('hasValidCronSecret'))
}

// ─── 5. /api/templates GET includes global templates for non-admins ─

{
  const templates = read('src/app/api/templates/route.ts')
  check('templates GET adds OR clause for eventId: null (global templates)',
    /where\.OR = \[scope,\s*\{\s*eventId:\s*null\s*\}\]/.test(templates))
}

// ─── 6. /api/checkin filters archivedAt:null on guest lookup ───────

{
  const checkin = read('src/app/api/checkin/route.ts')
  check('checkin filters archivedAt: null when looking up guest by qrToken',
    /qrToken: body\.qrToken,\s*archivedAt:\s*null/.test(checkin))
  check('checkin filters archivedAt: null when looking up guest by id',
    /id: body\.guestId,\s*archivedAt:\s*null/.test(checkin))
}

// ─── 7. QRPage handleGenerateAll uses api.getGuestQR (not updateGuest) ─

{
  const qrPage = read('src/components/jamra/pages/QRPage.tsx')
  check('QRPage handleGenerateAll calls api.getGuestQR',
    /api\.getGuestQR\(/.test(qrPage))
  check('QRPage handleGenerateAll no longer calls api.updateGuest with QR fields',
    !/api\.updateGuest\([^)]*hasQR/.test(readLiveCode('src/components/jamra/pages/QRPage.tsx')))
}

// ─── 8. events/[id] DELETE guards against duplicate TrashItem ───────

{
  const eventRoute = read('src/app/api/events/[id]/route.ts')
  check('events/[id] DELETE checks for existing TrashItem before creating one',
    /db\.trashItem\.findFirst\(\{[\s\S]*?itemType: 'event'[\s\S]*?eventRef: \{ contains:/.test(eventRoute))
  check('events/[id] DELETE is idempotent when a trash item already exists',
    eventRoute.includes("event_archive_duplicate_skipped"))
}

// ─── Summary ────────────────────────────────────────────────────────

const failed = results.filter((r) => !r.pass).length
const passed = results.length - failed
process.stdout.write(`\nSummary: ${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
