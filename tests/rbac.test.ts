// RBAC unit tests. Pure-runtime checks — no DB, no network.
// Verifies canAccessRoute() (method-aware) against known sensitive
// sub-paths so a future regression cannot silently grant checkin/
// sender roles write access to /api/guests/bulk-delete etc.
//
// CRITICAL regression test: sender MUST be able to GET /api/events
// (used by SendCenterPage to populate the events dropdown) while
// still being blocked from POST /api/events (creating events).

import { canAccessRoute, canAccessPage, SKIP_AUTH_ROUTES } from '../src/lib/rbac'

const results: Array<{ name: string; pass: boolean; detail?: string }> = []
function check(name: string, cond: boolean, detail?: string) {
  results.push({ name, pass: !!cond, detail })
  process.stdout.write((cond ? '✓ ' : '✗ ') + name + (detail ? '  ' + detail : '') + '\n')
}

// Helper: shorthand for canAccessRoute(role, path, method)
const r = (role: string, path: string, method = 'GET') => canAccessRoute(role, path, method)

// ── Public routes — every role passes ─────────────────────────────
for (const route of SKIP_AUTH_ROUTES) {
  check(`admin can access public route ${route}`, r('admin', route))
  check(`checkin can access public route ${route}`, r('checkin', route))
}

// Sub-paths of public routes are also public.
check('/api/public/rsvp is public', r('checkin', '/api/public/rsvp'))
check('/api/webhooks/whatsapp is public', r('admin', '/api/webhooks/whatsapp'))

// ── Admin wildcard ────────────────────────────────────────────────
check('admin can access /api/users', r('admin', '/api/users'))
check('admin can access /api/backup', r('admin', '/api/backup'))
check('admin can access /api/integrations', r('admin', '/api/integrations'))

// ── /api/robot is NOT a public route (must require auth) ──────────
check('/api/robot is NOT in SKIP_AUTH_ROUTES', !SKIP_AUTH_ROUTES.includes('/api/robot'))
check('unauthenticated role "" cannot access /api/robot', !r('', '/api/robot'))
check('checkin cannot access /api/robot', !r('checkin', '/api/robot'))
check('sender cannot access /api/robot', !r('sender', '/api/robot'))
check('staff cannot access /api/robot', !r('staff', '/api/robot'))
check('admin can access /api/robot', r('admin', '/api/robot'))

// ── checkin role — read-only scoping ──────────────────────────────
// CRITICAL: checkin can GET /api/guests and /api/events (read context)
check('checkin can GET /api/guests', r('checkin', '/api/guests', 'GET'))
check('checkin can GET /api/events', r('checkin', '/api/events', 'GET'))
check('checkin can GET /api/guests/[id] (search)', r('checkin', '/api/guests/abc123', 'GET'))

// But cannot write to them
check('checkin CANNOT POST /api/events', !r('checkin', '/api/events', 'POST'))
check('checkin CANNOT PATCH /api/events/[id]', !r('checkin', '/api/events/abc', 'PATCH'))
check('checkin CANNOT DELETE /api/events/[id]', !r('checkin', '/api/events/abc', 'DELETE'))
check('checkin CANNOT access /api/events/[id]/archive (any method)', !r('checkin', '/api/events/abc/archive', 'POST'))
check('checkin CANNOT access /api/events/[id]/close', !r('checkin', '/api/events/abc/close', 'POST'))
check('checkin CANNOT access /api/events/[id]/assign', !r('checkin', '/api/events/abc/assign', 'POST'))

check('checkin CANNOT access /api/guests/bulk-delete', !r('checkin', '/api/guests/bulk-delete', 'POST'))
check('checkin CANNOT access /api/guests/import', !r('checkin', '/api/guests/import', 'POST'))
check('checkin CANNOT access /api/guests/export', !r('checkin', '/api/guests/export', 'GET'))
check('checkin CANNOT PUT /api/guests/[id]', !r('checkin', '/api/guests/abc123', 'PUT'))
check('checkin CANNOT DELETE /api/guests/[id]', !r('checkin', '/api/guests/abc123', 'DELETE'))
check('checkin CANNOT access /api/guests/[id]/qr', !r('checkin', '/api/guests/abc123/qr', 'GET'))
check('checkin CANNOT access /api/guests/[id]/revoke-qr', !r('checkin', '/api/guests/abc123/revoke-qr', 'POST'))
check('checkin CANNOT access /api/guests/[id]/edit-logs', !r('checkin', '/api/guests/abc123/edit-logs', 'GET'))

check('checkin CANNOT access /api/templates', !r('checkin', '/api/templates', 'GET'))
check('checkin CANNOT access /api/send', !r('checkin', '/api/send', 'POST'))
check('checkin CANNOT access /api/schedules', !r('checkin', '/api/schedules', 'GET'))
check('checkin CANNOT access /api/comments', !r('checkin', '/api/comments', 'GET'))
check('checkin CANNOT access /api/invitations', !r('checkin', '/api/invitations', 'GET'))

// ── sender role — read on parents, blocked on writes ──────────────
// CRITICAL regression test: sender MUST be able to GET /api/events
// (SendCenterPage calls api.getEvents() to populate the events dropdown).
check('sender can GET /api/events (CRITICAL — needed by SendCenterPage)', r('sender', '/api/events', 'GET'))
check('sender can GET /api/guests (search)', r('sender', '/api/guests', 'GET'))
check('sender can GET /api/guests/export', r('sender', '/api/guests/export', 'GET'))

check('sender can access /api/send', r('sender', '/api/send', 'POST'))
check('sender can access /api/templates', r('sender', '/api/templates', 'GET'))
check('sender can access /api/schedules', r('sender', '/api/schedules', 'GET'))

// But cannot write to events/guests
check('sender CANNOT POST /api/events', !r('sender', '/api/events', 'POST'))
check('sender CANNOT PATCH /api/events/[id]', !r('sender', '/api/events/abc', 'PATCH'))
check('sender CANNOT DELETE /api/events/[id]', !r('sender', '/api/events/abc', 'DELETE'))
check('sender CANNOT access /api/events/[id]/archive', !r('sender', '/api/events/abc/archive', 'POST'))
check('sender CANNOT access /api/events/[id]/close', !r('sender', '/api/events/abc/close', 'POST'))
check('sender CANNOT access /api/events/[id]/assign', !r('sender', '/api/events/abc/assign', 'POST'))

check('sender CANNOT access /api/guests/bulk-delete', !r('sender', '/api/guests/bulk-delete', 'POST'))
check('sender CANNOT access /api/guests/import', !r('sender', '/api/guests/import', 'POST'))
check('sender CANNOT PUT /api/guests/[id]', !r('sender', '/api/guests/abc123', 'PUT'))
check('sender CANNOT DELETE /api/guests/[id]', !r('sender', '/api/guests/abc123', 'DELETE'))
check('sender CANNOT access /api/guests/[id]/qr', !r('sender', '/api/guests/abc123/qr', 'GET'))
check('sender CANNOT access /api/guests/[id]/revoke-qr', !r('sender', '/api/guests/abc123/revoke-qr', 'POST'))
check('sender CANNOT access /api/guests/[id]/edit-logs', !r('sender', '/api/guests/abc123/edit-logs', 'GET'))

check('sender CANNOT access /api/checkin', !r('sender', '/api/checkin', 'POST'))
check('sender CANNOT access /api/comments', !r('sender', '/api/comments', 'GET'))
check('sender CANNOT access /api/invitations', !r('sender', '/api/invitations', 'GET'))

// ── staff role — nearly as powerful as admin on event-scoped routes ──
check('staff can GET /api/events', r('staff', '/api/events', 'GET'))
check('staff can POST /api/events', r('staff', '/api/events', 'POST'))
check('staff can GET /api/guests', r('staff', '/api/guests', 'GET'))
check('staff can access /api/guests/bulk-delete', r('staff', '/api/guests/bulk-delete', 'POST'))
check('staff can access /api/guests/import', r('staff', '/api/guests/import', 'POST'))
check('staff CANNOT access /api/users', !r('staff', '/api/users', 'GET'))
check('staff CANNOT access /api/backup', !r('staff', '/api/backup', 'GET'))
check('staff CANNOT access /api/integrations', !r('staff', '/api/integrations', 'GET'))

// ── UI page access ────────────────────────────────────────────────
check('admin sees users page', canAccessPage('admin', 'users'))
check('staff cannot see users page', !canAccessPage('staff', 'users'))
check('checkin sees checkin page', canAccessPage('checkin', 'checkin'))
check('checkin cannot see dashboard', !canAccessPage('checkin', 'dashboard'))
check('sender sees sendcenter', canAccessPage('sender', 'sendcenter'))
check('sender cannot see checkin', !canAccessPage('sender', 'checkin'))

const failed = results.filter((r) => !r.pass).length
const passed = results.length - failed
process.stdout.write(`\nSummary: ${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
