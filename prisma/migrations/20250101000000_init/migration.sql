-- ──────────────────────────────────────────────────────────────
-- Initial schema migration for Jamrat Ghadah
-- Creates all base tables. Subsequent migrations add hardening
-- columns (20260101000000_security_hardening) and the media_assets
-- table (20260812000000_media_assets).
-- ──────────────────────────────────────────────────────────────

-- User accounts (admin, staff, checkin, sender)
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '' UNIQUE,
    "password" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT 'staff',
    "status" TEXT NOT NULL DEFAULT 'active',
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);

-- Login attempts for rate limiting (key = ip:email)
CREATE TABLE "login_attempts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "success" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "login_attempts_key_createdAt_idx" ON "login_attempts"("key", "createdAt");
CREATE INDEX "login_attempts_createdAt_idx" ON "login_attempts"("createdAt");

-- Events (the main entity everything else attaches to)
CREATE TABLE "events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL DEFAULT '',
    "client" TEXT NOT NULL DEFAULT '',
    "clientPhone" TEXT NOT NULL DEFAULT '',
    "date" TEXT NOT NULL DEFAULT '',
    "time" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'preparing',
    "password" TEXT NOT NULL DEFAULT '',
    "guests" INTEGER NOT NULL DEFAULT 0,
    "confirmed" INTEGER NOT NULL DEFAULT 0,
    "attended" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "hasInteractivePage" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT
);
CREATE INDEX "events_createdById_idx" ON "events"("createdById");
CREATE INDEX "events_status_idx" ON "events"("status");
CREATE INDEX "events_date_idx" ON "events"("date");
ALTER TABLE "events" ADD CONSTRAINT "events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Event assignments (event isolation: non-admin users only see assigned events)
CREATE TABLE "event_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "event_assignments_eventId_userId_key" ON "event_assignments"("eventId", "userId");
CREATE INDEX "event_assignments_userId_idx" ON "event_assignments"("userId");
CREATE INDEX "event_assignments_eventId_idx" ON "event_assignments"("eventId");
ALTER TABLE "event_assignments" ADD CONSTRAINT "event_assignments_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_assignments" ADD CONSTRAINT "event_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Guests (invited to events)
CREATE TABLE "guests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "companions" INTEGER NOT NULL DEFAULT 0,
    "sendStatus" TEXT NOT NULL DEFAULT 'pending',
    "confirmed" TEXT NOT NULL DEFAULT 'pending',
    "attended" TEXT NOT NULL DEFAULT 'pending',
    "hasQR" BOOLEAN NOT NULL DEFAULT false,
    "qrColor" TEXT NOT NULL DEFAULT '#000000',
    "qrRevoked" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "guests_eventId_idx" ON "guests"("eventId");
CREATE INDEX "guests_eventId_phone_idx" ON "guests"("eventId", "phone");
CREATE INDEX "guests_eventId_name_idx" ON "guests"("eventId", "name");
ALTER TABLE "guests" ADD CONSTRAINT "guests_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Guest edit logs (audit trail for guest changes)
CREATE TABLE "guest_edit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guestId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "field" TEXT NOT NULL DEFAULT '',
    "oldValue" TEXT NOT NULL DEFAULT '',
    "newValue" TEXT NOT NULL DEFAULT '',
    "userId" TEXT,
    "user" TEXT NOT NULL DEFAULT 'النظام',
    "time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "guest_edit_logs_guestId_idx" ON "guest_edit_logs"("guestId");
CREATE INDEX "guest_edit_logs_eventId_idx" ON "guest_edit_logs"("eventId");
CREATE INDEX "guest_edit_logs_time_idx" ON "guest_edit_logs"("time");
ALTER TABLE "guest_edit_logs" ADD CONSTRAINT "guest_edit_logs_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- QR usage logs (audit trail for QR issue/scan/revoke)
CREATE TABLE "qr_usages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guestId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'scan',
    "success" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT NOT NULL DEFAULT '',
    "ipAddress" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "qr_usages_guestId_idx" ON "qr_usages"("guestId");
CREATE INDEX "qr_usages_eventId_idx" ON "qr_usages"("eventId");
CREATE INDEX "qr_usages_time_idx" ON "qr_usages"("time");
CREATE INDEX "qr_usages_action_idx" ON "qr_usages"("action");
ALTER TABLE "qr_usages" ADD CONSTRAINT "qr_usages_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Check-ins (one per guest across all events — unique index backstop)
CREATE TABLE "checkins" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL DEFAULT '',
    "companions" INTEGER NOT NULL DEFAULT 0,
    "method" TEXT NOT NULL DEFAULT 'manual',
    "operator" TEXT NOT NULL DEFAULT '',
    "time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "checkins_guestId_key" ON "checkins"("guestId");
CREATE INDEX "checkins_eventId_idx" ON "checkins"("eventId");
CREATE INDEX "checkins_time_idx" ON "checkins"("time");
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "checkins" ADD CONSTRAINT "checkins_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Send logs (whatsapp/email send history)
CREATE TABLE "send_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "guestId" TEXT,
    "recipient" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'invite',
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "failReason" TEXT NOT NULL DEFAULT '',
    "time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "send_logs_eventId_idx" ON "send_logs"("eventId");
CREATE INDEX "send_logs_guestId_idx" ON "send_logs"("guestId");
CREATE INDEX "send_logs_time_idx" ON "send_logs"("time");
CREATE INDEX "send_logs_status_idx" ON "send_logs"("status");
ALTER TABLE "send_logs" ADD CONSTRAINT "send_logs_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "send_logs" ADD CONSTRAINT "send_logs_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Comments (per-event notes about guests)
CREATE TABLE "comments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL DEFAULT '',
    "text" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "comments_eventId_idx" ON "comments"("eventId");
CREATE INDEX "comments_createdAt_idx" ON "comments"("createdAt");
ALTER TABLE "comments" ADD CONSTRAINT "comments_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Templates (message/invitation templates)
CREATE TABLE "templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'invite',
    "text" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "templates_eventId_idx" ON "templates"("eventId");
CREATE INDEX "templates_type_idx" ON "templates"("type");
ALTER TABLE "templates" ADD CONSTRAINT "templates_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Trash items (soft-deleted entities)
CREATE TABLE "trash_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "itemType" TEXT NOT NULL DEFAULT 'other',
    "eventRef" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "trash_items_eventId_idx" ON "trash_items"("eventId");
CREATE INDEX "trash_items_createdById_idx" ON "trash_items"("createdById");
CREATE INDEX "trash_items_deletedAt_idx" ON "trash_items"("deletedAt");
ALTER TABLE "trash_items" ADD CONSTRAINT "trash_items_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Operation logs (append-only audit log)
CREATE TABLE "operation_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT,
    "text" TEXT NOT NULL DEFAULT '',
    "userId" TEXT,
    "user" TEXT NOT NULL DEFAULT 'النظام',
    "time" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "operation_logs_eventId_idx" ON "operation_logs"("eventId");
CREATE INDEX "operation_logs_time_idx" ON "operation_logs"("time");
ALTER TABLE "operation_logs" ADD CONSTRAINT "operation_logs_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "operation_logs" ADD CONSTRAINT "operation_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Scheduled messages (for the cron scheduler)
CREATE TABLE "scheduled_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL DEFAULT 'all',
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "content" TEXT NOT NULL DEFAULT '{}',
    "templateId" TEXT,
    "guestIds" TEXT NOT NULL DEFAULT '[]',
    "scheduleAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "executedAt" TIMESTAMP(3)
);
CREATE INDEX "scheduled_messages_eventId_idx" ON "scheduled_messages"("eventId");
CREATE INDEX "scheduled_messages_status_scheduleAt_idx" ON "scheduled_messages"("status", "scheduleAt");
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Sessions (DB-backed sessions for JWT validation)
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL UNIQUE,
    "deviceName" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "ipAddress" TEXT NOT NULL DEFAULT '',
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");
CREATE INDEX "sessions_expiresAt_idx" ON "sessions"("expiresAt");
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Password reset tokens (for forgot-password flow)
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL UNIQUE,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");
CREATE INDEX "password_reset_tokens_expiresAt_idx" ON "password_reset_tokens"("expiresAt");
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
