// ═══════════════════════════════════════════════════════════════
// RBAC — Role-Based Access Control (method-aware)
// ═══════════════════════════════════════════════════════════════
//
// The previous version used prefix-only matching with a deny-list of
// sub-paths. That had a critical bug: blocking `/api/events` for the
// `sender` role also blocked GET (read) which the SendCenterPage
// needs to populate the events dropdown. The fix is to make the
// deny-list method-aware: read methods (GET/HEAD/OPTIONS) are allowed
// on parent paths, write methods (POST/PUT/PATCH/DELETE) on sensitive
// sub-paths are blocked.

export type Role = 'admin' | 'staff' | 'checkin' | 'sender'

// Role hierarchy: admin > staff > sender = checkin
const ROLE_LEVEL: Record<string, number> = {
  admin: 4,
  staff: 3,
  sender: 2,
  checkin: 2,
}

// Which pages each role can access (UI side).
const ROLE_PAGES: Record<string, string[]> = {
  admin: [
    'dashboard', 'events', 'guests', 'checkin', 'qr',
    'sendcenter', 'templates', 'schedule', 'sendlog',
    'videos', 'robot', 'statistics', 'reports',
    'users', 'alerts', 'trash', 'archive', 'log',
    'integrations', 'settings', 'guest-confirm',
    'invitation-editor', 'event-closure', 'site-sync',
  ],
  staff: [
    'dashboard', 'events', 'guests', 'checkin', 'qr',
    'sendcenter', 'templates', 'schedule', 'sendlog',
    'statistics', 'reports', 'guest-confirm',
    'invitation-editor',
  ],
  checkin: [
    'checkin',
  ],
  sender: [
    'sendcenter', 'templates', 'sendlog', 'statistics',
  ],
}

// API routes each role can access (prefix matching). The deny-list
// below further restricts write operations on sensitive sub-paths.
const ROLE_API_ROUTES: Record<string, string[]> = {
  admin: ['*'], // Everything
  staff: [
    '/api/events',
    '/api/guests',
    '/api/checkin',
    '/api/templates',
    '/api/send',
    '/api/send-log',
    '/api/schedules',
    '/api/stats',
    '/api/comments',
    '/api/invitations',
    '/api/reports',
    '/api/operations-log',
    '/api/trash',
    '/api/auth/me',
    '/api/auth/change-password',
    '/api/auth/logout-all',
    '/api/auth/sessions',
    '/api/auth/request-reset',
    '/api/auth/reset-password',
    '/api/guests/export',
    '/api/guests/import',
  ],
  checkin: [
    '/api/checkin',
    '/api/guests', // read only for search (writes blocked below)
    '/api/events',  // read only (writes blocked below)
    '/api/auth/me',
    '/api/auth/change-password',
    '/api/auth/logout-all',
    '/api/auth/sessions',
  ],
  sender: [
    '/api/send',
    '/api/send-log',
    '/api/templates',
    '/api/schedules',
    '/api/stats',
    '/api/events', // read only (writes blocked below)
    '/api/guests', // read only (writes blocked below) + /api/guests/export allowed
    '/api/guests/export',
    '/api/auth/me',
    '/api/auth/change-password',
    '/api/auth/logout-all',
    '/api/auth/sessions',
  ],
}

interface DenyRule {
  role: Role
  pattern: RegExp
  /** HTTP methods this rule blocks. If undefined, blocks ALL methods. */
  methods?: string[]
}

// Sensitive operations that READ-only roles (checkin, sender) must NOT
// perform. Each rule is (role, regex, methods).
//
// IMPORTANT: read methods (GET/HEAD/OPTIONS) on parent paths remain
// allowed — sender can still GET /api/events to populate the send
// center's event dropdown. Only write methods on the matched paths
// are blocked.
const DENIED_RULES: DenyRule[] = [
  // === checkin role ===
  // Cannot create events (POST), but can list (GET) for context.
  { role: 'checkin', pattern: /^\/api\/events$/, methods: ['POST'] },
  // Cannot modify/delete events.
  { role: 'checkin', pattern: /^\/api\/events\/[^/]+$/, methods: ['PATCH', 'PUT', 'DELETE'] },
  // Cannot archive/restore/close/assign events (any method).
  { role: 'checkin', pattern: /^\/api\/events\/[^/]+\/(archive|restore|close|assign)$/ },
  // Cannot bulk-delete or import guests (POST endpoints, block all methods).
  { role: 'checkin', pattern: /^\/api\/guests\/(bulk-delete|import)$/ },
  // Cannot export guests.
  { role: 'checkin', pattern: /^\/api\/guests\/export$/ },
  // Cannot modify/delete a guest.
  { role: 'checkin', pattern: /^\/api\/guests\/[^/]+$/, methods: ['PUT', 'PATCH', 'DELETE'] },
  // Cannot issue/revoke QR, view edit-logs (any method).
  { role: 'checkin', pattern: /^\/api\/guests\/[^/]+\/(qr|revoke-qr|edit-logs)$/ },
  // Cannot access templates/send/schedules/comments/invitations at all.
  { role: 'checkin', pattern: /^\/api\/templates(\/|$)/ },
  { role: 'checkin', pattern: /^\/api\/send(\/|$)/ },
  { role: 'checkin', pattern: /^\/api\/schedules(\/|$)/ },
  { role: 'checkin', pattern: /^\/api\/comments(\/|$)/ },
  { role: 'checkin', pattern: /^\/api\/invitations(\/|$)/ },

  // === sender role ===
  // Cannot create events (POST), but CAN list (GET) — needed by SendCenterPage.
  { role: 'sender', pattern: /^\/api\/events$/, methods: ['POST'] },
  // Cannot modify/delete events.
  { role: 'sender', pattern: /^\/api\/events\/[^/]+$/, methods: ['PATCH', 'PUT', 'DELETE'] },
  // Cannot archive/restore/close/assign events.
  { role: 'sender', pattern: /^\/api\/events\/[^/]+\/(archive|restore|close|assign)$/ },
  // Cannot bulk-delete or import guests.
  { role: 'sender', pattern: /^\/api\/guests\/(bulk-delete|import)$/ },
  // Cannot modify/delete a guest.
  { role: 'sender', pattern: /^\/api\/guests\/[^/]+$/, methods: ['PUT', 'PATCH', 'DELETE'] },
  // Cannot issue/revoke QR, view edit-logs.
  { role: 'sender', pattern: /^\/api\/guests\/[^/]+\/(qr|revoke-qr|edit-logs)$/ },
  // Cannot check in guests.
  { role: 'sender', pattern: /^\/api\/checkin(\/|$)/ },
  // Cannot access comments/invitations.
  { role: 'sender', pattern: /^\/api\/comments(\/|$)/ },
  { role: 'sender', pattern: /^\/api\/invitations(\/|$)/ },
]

// Routes that don't need auth (login, public, cron, webhooks).
// IMPORTANT: keep this list small — every entry is a public surface.
// Cron routes use X-Cron-Secret for auth (see src/lib/cron.ts).
// WhatsApp webhook verifies Meta's X-Hub-Signature-256 HMAC.
//
// NOTE: /api/robot is NOT in this list — it requires an authenticated
// user (the route handler reads X-User-Id). If you want a public
// robot webhook, build a separate /api/webhooks/robot route with
// its own signature verification.
export const SKIP_AUTH_ROUTES = [
  '/api/auth/login',
  '/api/auth/request-reset',
  '/api/auth/reset-password',
  '/api/scheduler/run',
  '/api/reports/daily',
  '/api/maintenance/cleanup',
  '/api/public',
  '/api/webhooks/whatsapp', // Meta webhook — verified via HMAC signature
  '/api/qr-verify',         // QR scanner device may not be logged in
  '/api/health',            // v11.2: public health check for uptime monitors
]

export function canAccessPage(role: string, page: string): boolean {
  const pages = ROLE_PAGES[role]
  if (!pages) return false
  return pages.includes(page)
}

/**
 * Method-aware RBAC check. Returns true if the role may call the given
 * pathname with the given HTTP method.
 *
 * @param role     user role ('admin' | 'staff' | 'checkin' | 'sender')
 * @param pathname request path (e.g. '/api/guests/abc123')
 * @param method   HTTP method (default 'GET')
 */
export function canAccessRoute(role: string, pathname: string, method: string = 'GET'): boolean {
  // Skip auth routes — always allowed.
  for (const skip of SKIP_AUTH_ROUTES) {
    if (pathname === skip || pathname.startsWith(skip + '/')) return true
  }

  const routes = ROLE_API_ROUTES[role]
  if (!routes) return false

  // Admin has wildcard access.
  if (routes.includes('*')) return true

  // Deny-list check: even with prefix access, sensitive operations
  // are blocked for read-only roles. The check is method-aware so
  // GET /api/events is still allowed for `sender` (needed by
  // SendCenterPage), but POST /api/events is blocked.
  if (role === 'checkin' || role === 'sender') {
    const methodUpper = method.toUpperCase()
    for (const rule of DENIED_RULES) {
      if (rule.role !== role) continue
      if (!rule.pattern.test(pathname)) continue
      // If no methods specified, block all methods on this path.
      if (!rule.methods || rule.methods.length === 0) return false
      // Otherwise, block only the specified methods.
      if (rule.methods.includes(methodUpper)) return false
    }
  }

  // Prefix match for the rest.
  return routes.some((route) => pathname.startsWith(route))
}

export function hasMinimumRole(userRole: string, requiredRole: string): boolean {
  const userLevel = ROLE_LEVEL[userRole] || 0
  const requiredLevel = ROLE_LEVEL[requiredRole] || 0
  return userLevel >= requiredLevel
}

export const ROLE_LABELS: Record<string, string> = {
  admin: 'مدير',
  staff: 'موظف إدارة',
  checkin: 'موظف حضور',
  sender: 'موظف إرسال',
}

export const ROLE_PERMISSIONS: Record<string, { label: string; desc: string; color: string }> = {
  admin: {
    label: 'مدير',
    desc: 'وصول كامل لجميع الأقسام والإعدادات',
    color: 'text-amber-400',
  },
  staff: {
    label: 'موظف إدارة الضيوف',
    desc: 'إضافة/تعديل/حذف الضيوف + رفع القوائم + الإرسال + التقارير',
    color: 'text-blue-400',
  },
  checkin: {
    label: 'موظف Check-in',
    desc: 'تسجيل الحضور فقط — صفحة Check-in',
    color: 'text-green-400',
  },
  sender: {
    label: 'موظف الإرسال',
    desc: 'مركز الإرسال + القوالب + السجل',
    color: 'text-purple-400',
  },
}
