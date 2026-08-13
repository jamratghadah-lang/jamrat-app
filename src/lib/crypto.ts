// Symmetric encryption for sensitive integration-config values.
//
// Why: the `integration_configs.config` JSON column stores API tokens
// (WhatsApp, Resend, Cloudinary, Firebase service account). Storing
// them as plaintext means a DB dump leaks every key. We encrypt each
// sensitive field value with AES-256-GCM using a key from env, and
// decrypt lazily when getIntegrationConfig() is called.
//
// Key rotation: change INTEGRATION_ENC_KEY in env and run a one-off
// script to re-encrypt every row. Not included here.

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto'

const ALGO = 'aes-256-gcm'
const IV_LEN = 12 // GCM standard

function getKey(): Buffer {
  const raw = process.env.INTEGRATION_ENC_KEY?.trim() || ''
  if (!raw) {
    // No key configured — return an empty Buffer which signals "no
    // encryption" to callers (they fall back to plaintext). This is
    // OK for development; production should set the env var.
    return Buffer.alloc(0)
  }
  // Accept either a 64-char hex string or a 32-byte base64 string.
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex')
  const b = Buffer.from(raw, 'base64')
  if (b.length === 32) return b
  // As a last resort, hash whatever the user gave us. NOT recommended
  // for production — set a proper 32-byte key.
  return createHash('sha256').update(raw).digest()
}

export function isEncryptionEnabled(): boolean {
  return getKey().length === 32
}

/** Encrypts a string. Returns `v1:<iv>:<tag>:<ct>` (all base64) when
 *  encryption is enabled, or the plaintext input when it's not. */
export function encryptValue(plaintext: string): string {
  const key = getKey()
  if (key.length !== 32) return plaintext // passthrough
  const iv = randomBytes(IV_LEN)
  const cipher = createCipheriv(ALGO, key, iv)
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`
}

/** Decrypts a string produced by encryptValue(). If the input doesn't
 *  match the encryption format, returns it as-is (backwards compat
 *  with rows written before encryption was enabled). */
export function decryptValue(stored: string): string {
  if (!stored.startsWith('v1:')) return stored // passthrough
  const key = getKey()
  if (key.length !== 32) return stored // can't decrypt — return raw
  try {
    const [, ivB64, tagB64, ctB64] = stored.split(':')
    const iv = Buffer.from(ivB64, 'base64')
    const tag = Buffer.from(tagB64, 'base64')
    const ct = Buffer.from(ctB64, 'base64')
    const decipher = createDecipheriv(ALGO, key, iv)
    decipher.setAuthTag(tag)
    const pt = Buffer.concat([decipher.update(ct), decipher.final()])
    return pt.toString('utf8')
  } catch {
    return '' // corrupted or tampered — treat as empty
  }
}

// Field names that contain secrets and should be encrypted at rest.
// Anything not in this set is stored as plaintext (e.g. phone_id,
// cloud_name, from_email — these are not secrets).
export const SENSITIVE_FIELDS = new Set([
  'WHATSAPP_TOKEN',
  'RESEND_API_KEY',
  'CLOUDINARY_API_SECRET',
  'FIREBASE_SERVICE_ACCOUNT_JSON',
  'ROBOT_WEBHOOK_SECRET',
])
