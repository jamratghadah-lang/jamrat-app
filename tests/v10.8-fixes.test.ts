// v10.8 performance-audit verification tests.
//
// Static checks confirming each N+1 fix and each compound index is
// actually present in the code. Same pattern as v10.4/v10.6/v10.7:
// read the file as text, assert the optimized snippet exists, and
// (for the loops) assert the OLD N+1 pattern is gone.

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

// ─── 1. Compound indexes in schema.prisma ──────────────────────────

{
  const schema = read('prisma/schema.prisma')
  check('schema.prisma has guests(eventId, confirmed, archivedAt) index',
    /@@index\(\[eventId,\s*confirmed,\s*archivedAt\]\)/.test(schema))
  check('schema.prisma has guests(eventId, attended) index',
    /@@index\(\[eventId,\s*attended\]\)/.test(schema))
  check('schema.prisma has guests(eventId, hasQR, qrRevoked) index',
    /@@index\(\[eventId,\s*hasQR,\s*qrRevoked\]\)/.test(schema))
  check('schema.prisma has send_logs(eventId, channel, status) index',
    /@@index\(\[eventId,\s*channel,\s*status\]\)/.test(schema))
  check('schema.prisma has media_assets(eventId, type, createdAt) index',
    /@@index\(\[eventId,\s*type,\s*createdAt\]\)/.test(schema))
}

// ─── 2. Migration file exists with the same indexes ────────────────

{
  const migration = read('prisma/migrations/20260814000000_performance_indexes/migration.sql')
  check('migration creates guests_eventId_confirmed_archivedAt_idx',
    migration.includes('guests_eventId_confirmed_archivedAt_idx'))
  check('migration creates guests_eventId_attended_idx',
    migration.includes('guests_eventId_attended_idx'))
  check('migration creates guests_eventId_hasQR_qrRevoked_idx',
    migration.includes('guests_eventId_hasQR_qrRevoked_idx'))
  check('migration creates send_logs_eventId_channel_status_idx',
    migration.includes('send_logs_eventId_channel_status_idx'))
  check('migration creates media_assets_eventId_type_createdAt_idx',
    migration.includes('media_assets_eventId_type_createdAt_idx'))
  // All CREATE INDEX statements use IF NOT EXISTS (idempotent).
  check('migration uses IF NOT EXISTS on all CREATE INDEX',
    (migration.match(/CREATE INDEX IF NOT EXISTS/g) || []).length >= 5)
}

// ─── 3. /api/send — batched createMany instead of loop ─────────────

{
  const send = read('src/app/api/send/route.ts')
  check('send route uses createMany for SendLog batch',
    /tx\.sendLog\.createMany\(/.test(send))
  check('send route no longer has per-guest create() loop',
    !/for \(const g of guests\)[\s\S]*?tx\.sendLog\.create\(/.test(readLiveCode('src/app/api/send/route.ts')))
}

// ─── 4. /api/guests/import — batched duplicate detection + batched inserts ─

{
  const imp = read('src/app/api/guests/import/route.ts')
  check('import previewImport fetches duplicates in batch (findMany by phone IN)',
    /db\.guest\.findMany\(\{[\s\S]*?phone:\s*\{\s*in:\s*phones\s*\}/.test(imp))
  check('import previewImport fetches duplicates in batch (findMany by name IN)',
    /db\.guest\.findMany\(\{[\s\S]*?name:\s*\{\s*in:\s*names\s*\}/.test(imp))
  check('import previewImport builds phoneMap for O(1) lookup',
    imp.includes('const phoneMap = new Map'))
  check('import previewImport builds nameMap for O(1) lookup',
    imp.includes('const nameMap = new Map'))
  check('import previewImport no longer calls findFirst per row',
    !/for \(const row of rows\)[\s\S]*?db\.guest\.findFirst\(/.test(readLiveCode('src/app/api/guests/import/route.ts')))
  check('import commit uses createMany for inserts',
    /tx\.guest\.createMany\(/.test(imp))
  check('import commit no longer has per-row create() loop for inserts',
    !/for \(const r of previewable\.toInsert\)[\s\S]*?tx\.guest\.create\(/.test(readLiveCode('src/app/api/guests/import/route.ts')))
}

// ─── 5. /api/guests/bulk-delete — batched trashItem inserts ────────

{
  const bulk = read('src/app/api/guests/bulk-delete/route.ts')
  check('bulk-delete uses createMany for trashItem batch',
    /tx\.trashItem\.createMany\(/.test(bulk))
  check('bulk-delete no longer has per-guest trashItem.create() loop',
    !/for \(const guest of accessible\)[\s\S]*?tx\.trashItem\.create\(/.test(readLiveCode('src/app/api/guests/bulk-delete/route.ts')))
}

// ─── 6. /api/guests/[id] PUT — batched guestEditLog inserts ────────

{
  const guestPut = read('src/app/api/guests/[id]/route.ts')
  check('guest PUT uses createMany for guestEditLog batch',
    /tx\.guestEditLog\.createMany\(/.test(guestPut))
  check('guest PUT no longer has per-log create() loop',
    !/for \(const log of editLogs\)[\s\S]*?tx\.guestEditLog\.create\(/.test(readLiveCode('src/app/api/guests/[id]/route.ts')))
}

// ─── 7. /api/scheduler/run — batched tick ──────────────────────────

{
  const sched = read('src/app/api/scheduler/run/route.ts')
  check('scheduler uses updateMany for batch status update',
    /tx\.scheduledMessage\.updateMany\(/.test(sched))
  check('scheduler uses createMany for batch audit-log rows',
    /tx\.operationLog\.createMany\(/.test(sched))
  check('scheduler no longer has per-row transaction loop',
    !/for \(const row of due\)[\s\S]*?db\.\$transaction/.test(readLiveCode('src/app/api/scheduler/run/route.ts')))
}

// ─── 8. /api/guests/[id]/qr — resolveRequestUserName called ONCE ──

{
  const qr = read('src/app/api/guests/[id]/qr/route.ts')
  // The route should resolve the name once into a local `actorName`
  // variable and reuse it for every logQrUsage + recordAudit call.
  check('qr route resolves actorName once into a local variable',
    /const actorName = await resolveRequestUserName\(user\)/.test(qr))
  // Count remaining `await resolveRequestUserName(user)` calls in live
  // code — should be exactly 1 (the resolution). The old code had up
  // to 4.
  const liveQr = readLiveCode('src/app/api/guests/[id]/qr/route.ts')
  const callCount = (liveQr.match(/await resolveRequestUserName\(user\)/g) || []).length
  check(`qr route has exactly 1 resolveRequestUserName call (got ${callCount})`,
    callCount === 1)
}

// ─── 9. /api/guests/[id]/revoke-qr — resolveRequestUserName called ONCE ─

{
  const revoke = read('src/app/api/guests/[id]/revoke-qr/route.ts')
  check('revoke-qr resolves actorName once into a local variable',
    /const actorName = await resolveRequestUserName\(user\)/.test(revoke))
  const liveRevoke = readLiveCode('src/app/api/guests/[id]/revoke-qr/route.ts')
  const callCount = (liveRevoke.match(/await resolveRequestUserName\(user\)/g) || []).length
  check(`revoke-qr has exactly 1 resolveRequestUserName call (got ${callCount})`,
    callCount === 1)
}

// ─── Summary ────────────────────────────────────────────────────────

const failed = results.filter((r) => !r.pass).length
const passed = results.length - failed
process.stdout.write(`\nSummary: ${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
