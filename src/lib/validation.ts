// Zod schemas for every API boundary. Keep them thin: validate names,
// types, and ranges. Cross-field / DB-level authorisation belongs in the
// route handler.

import { z } from 'zod'

export const LoginInput = z.object({
  email: z.string().email({ message: 'بريد إلكتروني غير صالح' }),
  password: z.string().min(6, { message: 'كلمة المرور قصيرة جداً' }),
})

export const CreateEventInput = z.object({
  name: z.string().min(1),
  client: z.string().min(1),
  clientPhone: z.string().optional().default(''),
  date: z.string().min(1),
  time: z.string().optional().default(''),
  location: z.string().optional().default(''),
  status: z.enum(['preparing', 'active', 'ended', 'archived']).optional(),
  password: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  hasInteractivePage: z.boolean().optional().default(true),
})

export const CreateGuestInput = z.object({
  eventId: z.string().min(1),
  name: z.string().min(1),
  phone: z.string().optional().default(''),
  email: z.string().email().optional().or(z.literal('')).default(''),
  companions: z.number().int().min(0).max(50).optional().default(0),
  notes: z.string().optional().default(''),
})

export const UpdateGuestInput = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  companions: z.number().int().min(0).max(50).optional(),
  notes: z.string().optional(),
  confirmed: z.enum(['pending', 'confirmed', 'unconfirmed']).optional(),
  attended: z.enum(['pending', 'attended', 'absent']).optional(),
  sendStatus: z.enum(['pending', 'sent', 'failed']).optional(),
})

// Public RSVP submission (unauthenticated — guarded by qrToken or event
// password in the route handler, same rule as GET /api/public).
export const PublicRsvpInput = z.object({
  token: z.string().min(8).optional(),
  eventId: z.string().optional(),
  guestId: z.string().optional(),
  password: z.string().optional(),
  response: z.enum(['confirmed', 'unconfirmed']),
  companions: z.number().int().min(0).max(50).optional().default(0),
})

export const BulkDeleteInput = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
})

export const ChangePasswordInput = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8, { message: 'كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل' }),
})

export const CheckinInput = z.object({
  // Manual check-in may use guestId; QR check-in must use the opaque qrToken.
  guestId: z.string().optional(),
  qrToken: z.string().min(8).optional(),
  eventId: z.string().optional(),
  method: z.enum(['qr', 'manual']).optional().default('manual'),
  companions: z.number().int().min(0).max(50).optional(),
}).refine((v) => v.guestId || v.qrToken, { message: 'guestId أو qrToken مطلوب' })

export const QrIssueInput = z.object({
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

export const QrVerifyInput = z.object({
  qrToken: z.string().min(8),
})

export const CreateUserInput = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'staff', 'checkin', 'sender']),
})

export const UpdateUserInput = z.object({
  name: z.string().optional(),
  role: z.enum(['admin', 'staff', 'checkin', 'sender']).optional(),
  status: z.enum(['active', 'disabled']).optional(),
})

export const CreateTemplateInput = z.object({
  name: z.string().min(1),
  type: z.enum(['invite', 'reminder', 'thank_you', 'custom']).default('invite'),
  text: z.string().min(1),
  design: z.record(z.string(), z.unknown()).optional().default({}),
  eventId: z.string().nullable().optional(),
})

export const ImportGuestRow = z.object({
  name: z.string().min(1),
  phone: z.string().optional().default(''),
  email: z.string().optional().default(''),
  companions: z.number().int().min(0).max(50).optional().default(0),
})

export const EmptyTrashInput = z.object({
  confirm: z.literal(true),
})

// ─── v10.6 — Zod schemas for routes that previously trusted raw JSON ───

export const CreateScheduleInput = z.object({
  eventId: z.string().min(1, { message: 'معرف المناسبة مطلوب' }),
  recipientType: z.enum(['all', 'confirmed', 'unconfirmed']).default('all'),
  channel: z.enum(['whatsapp', 'email', 'both']).default('whatsapp'),
  content: z.record(z.string(), z.unknown()).optional().default({}),
  templateId: z.string().nullable().optional(),
  guestIds: z.array(z.string().min(1)).optional().default([]),
  scheduleAt: z.union([z.string(), z.date()]).refine(
    (v) => {
      const d = typeof v === 'string' ? new Date(v) : v
      return !Number.isNaN(d.getTime())
    },
    { message: 'وقت الجدولة غير صالح' },
  ),
})

export const SendMessageInput = z.object({
  eventId: z.string().min(1, { message: 'معرف المناسبة مطلوب' }),
  channel: z.enum(['whatsapp', 'email', 'both']).default('whatsapp'),
  type: z.enum(['invite', 'reminder', 'final_reminder', 'thank_you']).default('invite'),
  guestIds: z.array(z.string().min(1)).min(1, { message: 'قائمة الضيوف مطلوبة' }),
})

export const SendInvitationInput = z.object({
  eventId: z.string().min(1, { message: 'معرف المناسبة مطلوب' }),
  templateId: z.string().nullable().optional(),
  channel: z.enum(['whatsapp', 'email', 'both']).default('whatsapp'),
  type: z.enum(['invite', 'reminder', 'final_reminder', 'thank_you']).default('invite'),
  recipientType: z.enum(['all', 'confirmed', 'unconfirmed']).default('all'),
  guestIds: z.array(z.string().min(1)).optional(),
  design: z.record(z.string(), z.unknown()).optional(),
})

// PATCH /api/events/[id] — extends the create schema but every field
// is optional, and we explicitly forbid setting status:'archived'
// (must go through /archive so the audit trail stays consistent).
export const UpdateEventInput = z.object({
  name: z.string().min(1).optional(),
  client: z.string().min(1).optional(),
  clientPhone: z.string().optional().default(''),
  date: z.string().min(1).optional(),
  time: z.string().optional().default(''),
  location: z.string().optional().default(''),
  // 'archived' is rejected here — must go through POST /archive.
  status: z.enum(['preparing', 'active', 'ended']).optional(),
  password: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  hasInteractivePage: z.boolean().optional(),
})

// POST /api/events/[id]/assign — admin grants a scoped role to a user
// for one event. Role must be one of the non-admin scopes (admin
// already has wildcard access; assigning 'admin' here would be a
// privilege boundary confusion).
export const AssignEventUserInput = z.object({
  userId: z.string().min(1, { message: 'معرف المستخدم مطلوب' }),
  role: z.enum(['staff', 'checkin', 'sender']).default('staff'),
})

// ─── v10.7 — Zod schemas for the last two unvalidated routes ────────

// POST /api/comments — staff/sender can leave an internal comment on
// an event. `guestName` is an optional free-text label (the comment is
// scoped to the event, not to a specific guest row).
export const CreateCommentInput = z.object({
  eventId: z.string().min(1, { message: 'معرف الحدث مطلوب' }),
  text: z.string().min(1, { message: 'النص مطلوب' }).max(2000, { message: 'النص طويل جداً' }),
  guestName: z.string().max(200).optional().default(''),
})

// POST /api/media — add an external (http/https) media asset to an
// event. URL must be http(s) — relative URLs are rejected because
// they'd resolve against the dashboard host and break in production.
export const CreateMediaInput = z.object({
  eventId: z.string().min(1, { message: 'معرف المناسبة مطلوب' }),
  url: z.string().min(1, { message: 'الرابط مطلوب' }).regex(/^https?:\/\//i, { message: 'يجب أن يكون رابط الوسائط http أو https' }),
  title: z.string().max(300).optional().default(''),
  type: z.enum(['image', 'video']).default('video'),
})

// DELETE /api/media?id=... — query param. Used to be parsed inline with
// `searchParams.get('id')`; now Zod validates it's a non-empty string
// before we hit the DB. (Defensive — the previous code would pass
// `undefined` to Prisma if `id` was missing, which the early-return
// caught, but only after string coercion.)
export const DeleteMediaInput = z.object({
  id: z.string().min(1, { message: 'معرف الوسائط مطلوب' }),
})

// Generic helper to format Zod errors into a friendly Arabic array.
export function formatZodIssues(err: z.ZodError): { error: string; issues: Array<{ path: string; message: string }> } {
  return {
    error: err.issues[0]?.message || 'بيانات غير صالحة',
    issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  }
}
