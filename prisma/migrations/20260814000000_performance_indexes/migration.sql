-- Performance indexes (v10.8)
--
-- Adds compound indexes for the hot query paths identified during the
-- performance audit. All statements use IF NOT EXISTS so the migration
-- is safe to re-run.
--
-- Background: /api/stats alone fires 12 parallel count() queries per
-- request. Without compound indexes, each one was a separate seq scan
-- on `guests` or `send_logs`. With the new indexes, each count touches
-- only the index (index-only scan in Postgres when the columns are
-- covered).
--
-- Index choice rationale (leftmost-prefix rule):
--   guests(eventId, confirmed, archivedAt)
--     - covers: WHERE eventId=? AND confirmed=? AND archivedAt IS NULL
--     - used by: /api/stats confirmation counts, /api/guests status
--       filter, /api/guests/[id] PATCH confirmed recount.
--   guests(eventId, attended)
--     - covers: WHERE eventId=? AND attended=?
--     - used by: /api/checkin attendedCount recount, /api/stats
--       attendanceRate.
--   guests(eventId, hasQR, qrRevoked)
--     - covers: WHERE eventId=? AND hasQR=true AND qrRevoked=false
--     - used by: /api/stats qrUsageRate, /api/site-sync qr count.
--   send_logs(eventId, channel, status)
--     - covers: WHERE eventId=? AND channel IN (...) AND status=?
--     - used by: /api/stats 4× sendLog counts (whatsapp/email ×
--       sent/failed).
--   media_assets(eventId, type, createdAt)
--     - covers: WHERE eventId=? AND type=? ORDER BY createdAt DESC
--     - used by: /api/invitations "latest video" lookup.

-- ──── guests: compound indexes ────
CREATE INDEX IF NOT EXISTS "guests_eventId_confirmed_archivedAt_idx"
  ON "guests"("eventId", "confirmed", "archivedAt");

CREATE INDEX IF NOT EXISTS "guests_eventId_attended_idx"
  ON "guests"("eventId", "attended");

CREATE INDEX IF NOT EXISTS "guests_eventId_hasQR_qrRevoked_idx"
  ON "guests"("eventId", "hasQR", "qrRevoked");

-- ──── send_logs: compound index for channel+status counts ────
CREATE INDEX IF NOT EXISTS "send_logs_eventId_channel_status_idx"
  ON "send_logs"("eventId", "channel", "status");

-- ──── media_assets: compound index for "latest video" lookup ────
CREATE INDEX IF NOT EXISTS "media_assets_eventId_type_createdAt_idx"
  ON "media_assets"("eventId", "type", "createdAt");
