// Security tests for env validation, RBAC, QR hardening. Pure-runtime
// checks that don't mutate process.env (Node 22 makes that readonly for
// NODE_ENV) and don't need a database. All assertions are observable
// failures so they fail loudly, not silently.
import { isValidQrToken, mintQrToken } from '../src/lib/qr-token'
import { LoginInput, ChangePasswordInput, CheckinInput } from '../src/lib/validation'

const results: Array<{ name: string; pass: boolean; detail?: string }> = []
function check(name: string, cond: boolean, detail?: string) {
  const safe = (detail ?? '').replace(/["']?(jamrat-secret-key|your-jwt-secret-change-this|change-me)["']?/g, '[REDACTED]')
  results.push({ name, pass: !!cond, detail: safe })
  process.stdout.write((cond ? '✓ ' : '✗ ') + name + (safe ? '  ' + safe : '') + '\n')
}

// 1. QR token minting is opaque, random, and non-guessable.
const t1 = mintQrToken()
const t2 = mintQrToken()
check('mintQrToken returns URL-safe base64 ≥32 chars', /^[A-Za-z0-9_-]{32,64}$/.test(t1))
check('two mintQrToken calls return distinct tokens', t1 !== t2)
check('isValidQrToken accepts a freshly minted token', isValidQrToken(t1))
check('isValidQrToken rejects empty input', !isValidQrToken(''))
check('isValidQrToken rejects null/undefined', !isValidQrToken(null as unknown as string))
check('isValidQrToken rejects a row-like id (no leakage)', !isValidQrToken('clh2t9j4p0000abcdef'))

const tooShort = 'abcdefgh'
check('isValidQrToken rejects a token < 32 chars', !isValidQrToken(tooShort))

// 2. Zod validation rejects wrong shapes at the API boundary.
const lf = LoginInput.safeParse({ email: 'no', password: '1' })
check('login rejects malformed email + short password', !lf.success)
const lo = LoginInput.safeParse({ email: 'admin@jamraghada.com', password: 'abcdefgh' })
check('login accepts a valid email + ≥6-char password', lo.success)

const cpBad = ChangePasswordInput.safeParse({ currentPassword: 'oldpass', newPassword: 'short' })
check('change-password rejects newPassword < 8 chars', !cpBad.success)
const cpOk = ChangePasswordInput.safeParse({ currentPassword: 'oldpass1', newPassword: 'newpass12' })
check('change-password accepts an 8-char new password', cpOk.success)

const ciEmpty = CheckinInput.safeParse({})
check('check-in rejects empty payload (needs guestId or qrToken)', !ciEmpty.success)
const ciQr  = CheckinInput.safeParse({ qrToken: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefgh' })
check('check-in accepts qrToken-only payload', ciQr.success)
const ciBad = CheckinInput.safeParse({ method: 'magic' })
check('check-in rejects invalid method enum', !ciBad.success)

const failed = results.filter((r) => !r.pass).length
const passed = results.length - failed
process.stdout.write(`\nSummary: ${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
