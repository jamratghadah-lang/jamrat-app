-- Security hardening migration
-- Adds QR token + uniqueness, checkin uniqueness, audit columns, useful
-- FK indexes. Runs AFTER 20250101000000_init which creates the base tables.
-- All statements use IF NOT EXISTS so they are safe to re-run.

-- ──── QR token on guests (rotation-friendly, never the row id) ────
ALTER TABLE "guests"
  ADD COLUMN IF NOT EXISTS "qrToken" TEXT,
  ADD COLUMN IF NOT EXISTS "qrGeneratedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "qrRevokedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "guests_qrToken_key"
  ON "guests"("qrToken");

CREATE INDEX IF NOT EXISTS "guests_archivedAt_idx"
  ON "guests"("archivedAt");

-- ──── Check-in: operatorId + FK to users ────
ALTER TABLE "checkins"
  ADD COLUMN IF NOT EXISTS "operatorId" TEXT;

CREATE INDEX IF NOT EXISTS "checkins_operatorId_idx"
  ON "checkins"("operatorId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'checkins_operatorId_fkey'
  ) THEN
    ALTER TABLE "checkins"
      ADD CONSTRAINT "checkins_operatorId_fkey"
      FOREIGN KEY ("operatorId") REFERENCES "users"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- ──── Event assignment: role scoped to this event ────
ALTER TABLE "event_assignments"
  ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'staff';

-- ──── QR usage: actor identity ────
ALTER TABLE "qr_usages"
  ADD COLUMN IF NOT EXISTS "actorUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "actorName" TEXT NOT NULL DEFAULT '';

-- ──── Operation log: structured audit fields ────
ALTER TABLE "operation_logs"
  ADD COLUMN IF NOT EXISTS "entity" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "entityId" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "action" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "oldValue" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "newValue" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "ipAddress" TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS "operation_logs_entity_entityId_idx"
  ON "operation_logs"("entity", "entityId");

-- ──── Template: design payload ────
ALTER TABLE "templates"
  ADD COLUMN IF NOT EXISTS "design" TEXT NOT NULL DEFAULT '{}';

-- ──── Users: role/status indexes ────
CREATE INDEX IF NOT EXISTS "users_role_idx"  ON "users"("role");
CREATE INDEX IF NOT EXISTS "users_status_idx" ON "users"("status");
