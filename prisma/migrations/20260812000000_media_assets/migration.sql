-- Media assets table (videos/images linked to events)
CREATE TABLE "media_assets" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "eventId" TEXT NOT NULL,
  "title" TEXT NOT NULL DEFAULT '',
  "type" TEXT NOT NULL DEFAULT 'video',
  "url" TEXT NOT NULL,
  "size" TEXT NOT NULL DEFAULT '',
  "storage" TEXT NOT NULL DEFAULT 'external',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "media_assets_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "media_assets_eventId_idx" ON "media_assets"("eventId");
CREATE INDEX "media_assets_type_idx" ON "media_assets"("type");
