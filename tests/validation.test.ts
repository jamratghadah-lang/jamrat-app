// Zod schema validation tests for the API boundary.
import { z } from 'zod'
import { LoginInput, ChangePasswordInput, CreateGuestInput, CheckinInput, BulkDeleteInput } from '../src/lib/validation'
const results: Array<{ name: string; pass: boolean }> = []
function check(name: string, pass: boolean) {
  results.push({ name, pass })
  process.stdout.write((pass ? '✓ ' : '✗ ') + name + '\n')
}

// Login: rejects bad email + short password
const loginFail = LoginInput.safeParse({ email: 'not-an-email', password: '123' })
check('LoginInput rejects malformed email + short password', !loginFail.success)
const loginOk = LoginInput.safeParse({ email: 'admin@jamraghada.com', password: 'abcdefgh' })
check('LoginInput accepts well-formed login', loginOk.success)

// ChangePassword: requires min 8 chars
const cpFail = ChangePasswordInput.safeParse({ currentPassword: 'abcdef', newPassword: 'short' })
check('ChangePasswordInput rejects short new password', !cpFail.success)
const cpOk = ChangePasswordInput.safeParse({ currentPassword: 'abcdef', newPassword: 'abcdefgh' })
check('ChangePasswordInput accepts valid pair', cpOk.success)

// CreateGuest: rejects empty name
const gFail = CreateGuestInput.safeParse({ eventId: '', name: '' })
check('CreateGuestInput rejects empty eventId/name', !gFail.success)
const gOk = CreateGuestInput.safeParse({ eventId: 'abc', name: 'ضيف' })
check('CreateGuestInput accepts minimal valid guest', gOk.success)

// Checkin: needs at least guestId or qrToken
const cFail = CheckinInput.safeParse({})
check('CheckinInput rejects empty payload', !cFail.success)
const cOk = CheckinInput.safeParse({ guestId: 'some-id', method: 'qr' })
check('CheckinInput accepts guestId+method', cOk.success)
const cOkQr = CheckinInput.safeParse({ qrToken: 'abcdefgh' })
check('CheckinInput accepts qrToken alone', cOkQr.success)

// BulkDelete: bounds
const bdFail = BulkDeleteInput.safeParse({ ids: [] })
check('BulkDeleteInput rejects empty ids', !bdFail.success)
const bdOk = BulkDeleteInput.safeParse({ ids: ['a', 'b'] })
check('BulkDeleteInput accepts non-empty ids', bdOk.success)

const failed = results.filter(r => !r.pass).length
process.stdout.write(`\nSummary: ${results.length - failed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
