// Reads a service's saved config from the `integration_configs` table —
// the same table /api/integrations writes to. This is the single
// source of truth for outbound credentials: whatever is saved from
// the dashboard's "Integrations" tab is what actually gets used to
// send messages.
//
// Sensitive fields (API tokens, service account JSON) are encrypted
// at rest with AES-256-GCM (see src/lib/crypto.ts). They are
// transparently decrypted here so callers (whatsapp.ts, email.ts, ...)
// don't need to know about encryption.

import { db } from './db'
import { decryptValue, encryptValue, SENSITIVE_FIELDS, isEncryptionEnabled } from './crypto'

export interface IntegrationConfigRow {
  enabled: boolean
  fields: Record<string, string>
}

export async function getIntegrationConfig(key: string): Promise<IntegrationConfigRow> {
  const row = await db.integrationConfig.findUnique({ where: { key } })
  if (!row) return { enabled: false, fields: {} }
  let fields: Record<string, string> = {}
  try {
    const parsed = JSON.parse(row.config)
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string') {
          fields[k] = SENSITIVE_FIELDS.has(k) ? decryptValue(v) : v
        }
      }
    }
  } catch {
    fields = {}
  }
  return { enabled: row.enabled, fields }
}

/** Writes a service's config back to the DB, encrypting sensitive
 *  fields on the way in. Used by /api/integrations POST. */
export async function saveIntegrationConfig(
  key: string,
  label: string,
  fields: Record<string, string>,
  enabled: boolean,
): Promise<void> {
  const encryptedFields: Record<string, string> = {}
  for (const [k, v] of Object.entries(fields)) {
    encryptedFields[k] = SENSITIVE_FIELDS.has(k) ? encryptValue(v) : v
  }
  await db.integrationConfig.upsert({
    where: { key },
    create: {
      key,
      label,
      config: JSON.stringify(encryptedFields),
      enabled,
    },
    update: {
      label,
      config: JSON.stringify(encryptedFields),
      enabled,
    },
  })
}

export { isEncryptionEnabled }
