// QR token minting + rotation. Tokens are 256-bit URL-safe random strings;
// they never expose the guest row id.

import { randomBytes } from 'crypto'

export function mintQrToken(): string {
  // 32 bytes ≈ 43 chars base64url
  return randomBytes(32).toString('base64url')
}

const TOKEN_REGEX = /^[A-Za-z0-9_-]{32,64}$/

export function isValidQrToken(token: string | null | undefined): token is string {
  return typeof token === 'string' && TOKEN_REGEX.test(token)
}
