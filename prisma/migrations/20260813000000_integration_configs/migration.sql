-- Integration configs table — stores per-service config (API keys, tokens)
-- saved from the dashboard Integrations page. Replaces the previous
-- placeholder POST handler that didn't persist anything.
CREATE TABLE "integration_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL UNIQUE,
    "label" TEXT NOT NULL DEFAULT '',
    "config" TEXT NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
