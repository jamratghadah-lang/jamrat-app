// v10.7 fix-verification tests.
//
// Covers the last three low-priority items deferred from v10.6:
//  1. Zod validation on /api/comments POST (CreateCommentInput)
//  2. Zod validation on /api/media POST + DELETE (CreateMediaInput,
//     DeleteMediaInput)
//  3. /api/schedules GET now returns `eventName` (flattened from
//     `event.name` via Prisma include) so SchedulePage.tsx can render
//     the event name column without a second round-trip.
//
// Same pattern as v10.4/v10.6: static greps over the actual source —
// confirms each fix is present in the code and (where relevant) that
// the OLD broken pattern is gone.

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

// ─── 1. /api/comments POST — Zod validation ────────────────────────

{
  const validation = read('src/lib/validation.ts')
  check('validation.ts exports CreateCommentInput',
    validation.includes('export const CreateCommentInput'))
  // Enforce shape: eventId required, text required + max 2000, guestName optional
  check('CreateCommentInput enforces eventId required',
    /CreateCommentInput[\s\S]*?eventId:\s*z\.string\(\)\.min\(1/.test(validation))
  check('CreateCommentInput enforces text min(1) + max(2000)',
    /text:\s*z\.string\(\)\.min\(1[^)]+\)\.max\(2000/.test(validation))
  check('CreateCommentInput guestName optional + max(200)',
    /guestName:\s*z\.string\(\)\.max\(200\)\.optional\(\)\.default\(''\)/.test(validation))

  const comments = read('src/app/api/comments/route.ts')
  check('comments POST imports CreateCommentInput + formatZodIssues',
    comments.includes('CreateCommentInput') && comments.includes('formatZodIssues'))
  check('comments POST uses safeParse on the body',
    /CreateCommentInput\.safeParse\(/.test(comments))
  check('comments POST no longer uses String(body.eventId || "") raw coercion',
    !/String\(body\.eventId\s*\|\|\s*''\)/.test(readLiveCode('src/app/api/comments/route.ts')))
  check('comments POST no longer uses String(body.text || "") raw coercion',
    !/String\(body\.text\s*\|\|\s*''\)/.test(readLiveCode('src/app/api/comments/route.ts')))
}

// ─── 2. /api/media POST + DELETE — Zod validation ──────────────────

{
  const validation = read('src/lib/validation.ts')
  check('validation.ts exports CreateMediaInput',
    validation.includes('export const CreateMediaInput'))
  check('validation.ts exports DeleteMediaInput',
    validation.includes('export const DeleteMediaInput'))
  // CreateMediaInput: eventId required, url regex http/https, type enum
  check('CreateMediaInput enforces eventId required',
    /CreateMediaInput[\s\S]*?eventId:\s*z\.string\(\)\.min\(1/.test(validation))
  check('CreateMediaInput enforces url http/https regex',
    validation.includes('regex(/^https?:\\/\\//i'))
  check('CreateMediaInput type enum is image|video',
    /type:\s*z\.enum\(\[?'image',\s*?'video'\]\)/.test(validation))

  const media = read('src/app/api/media/route.ts')
  check('media POST imports CreateMediaInput + formatZodIssues',
    media.includes('CreateMediaInput') && media.includes('formatZodIssues'))
  check('media POST uses safeParse on the body',
    /CreateMediaInput\.safeParse\(/.test(media))
  check('media POST no longer uses inline typeof body.url === "string" check',
    !/typeof body\.url === 'string'/.test(readLiveCode('src/app/api/media/route.ts')))
  check('media POST no longer uses inline http regex check (moved to schema)',
    !/\/\^https\?:\/\/i\/\.test\(url\)/.test(readLiveCode('src/app/api/media/route.ts')))

  check('media DELETE imports DeleteMediaInput + formatZodIssues',
    media.includes('DeleteMediaInput') && media.includes('formatZodIssues'))
  check('media DELETE uses safeParse on the id query param',
    /DeleteMediaInput\.safeParse\(/.test(media))
  check('media DELETE no longer reads id directly with searchParams.get without validation',
    // The new code reads it into idRaw THEN validates via Zod — the old
    // code passed searchParams.get('id') straight to Prisma.
    media.includes("searchParams.get('id') || ''") &&
    media.includes('DeleteMediaInput.safeParse({ id: idRaw })'))
}

// ─── 3. /api/schedules GET — returns eventName ─────────────────────

{
  const schedules = read('src/app/api/schedules/route.ts')
  check('schedules GET includes event relation for eventName',
    /include:\s*\{\s*event:\s*\{\s*select:\s*\{\s*name:\s*true\s*\}\s*\}\s*\}/.test(schedules))
  check('schedules GET flattens event.name to eventName',
    /eventName:\s*event\?\.name\s*\|\|\s*''/.test(schedules))
  check('schedules GET no longer returns raw scheduledMessage rows without eventName',
    // The old code returned `rows` directly; the new code maps to `flattened`.
    /const flattened = rows\.map\(/.test(schedules) &&
    /NextResponse\.json\(flattened\)/.test(schedules))
}

// ─── Summary ────────────────────────────────────────────────────────

const failed = results.filter((r) => !r.pass).length
const passed = results.length - failed
process.stdout.write(`\nSummary: ${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
