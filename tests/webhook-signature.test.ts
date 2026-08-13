// Unit tests for WhatsApp webhook signature verification.
// Verifies the HMAC-SHA256 check that prevents forged webhook POSTs
// from confirming/canceling RSVPs on behalf of arbitrary guests.
//
// Pure-runtime — no DB, no network. Mirrors the exact verifier used by
// src/app/api/webhooks/whatsapp/route.ts (isValidMetaSignature). If
// that function changes, update this copy in tandem — Next.js route
// modules can't be imported directly into a plain tsx script.

import crypto from 'node:crypto'

const results: Array<{ name: string; pass: boolean; detail?: string }> = []
function check(name: string, cond: boolean, detail?: string) {
  results.push({ name, pass: !!cond, detail })
  process.stdout.write((cond ? '✓ ' : '✗ ') + name + (detail ? '  ' + detail : '') + '\n')
}

// ── Mirror of isValidMetaSignature() in route.ts ───────────────────
function isValidMetaSignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader || !appSecret) return false
  const prefix = 'sha256='
  if (!signatureHeader.startsWith(prefix)) return false
  const expectedHex = crypto.createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')
  const expected = Buffer.from(prefix + expectedHex)
  const supplied = Buffer.from(signatureHeader)
  if (expected.length !== supplied.length) return false
  return crypto.timingSafeEqual(expected, supplied)
}

function sign(secret: string, body: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex')
}

const SECRET = 'test-app-secret-32-chars-long!!'
const BODY = JSON.stringify({
  entry: [{ changes: [{ value: { messages: [{
    from: '966500000000', type: 'interactive',
    interactive: { type: 'button_reply', button_reply: { id: 'RSVP_YES:guest-abc', title: 'سأحضر' } },
  }] } }] }],
})

// ── Tests ─────────────────────────────────────────────────────────

check('valid signature accepts', isValidMetaSignature(BODY, sign(SECRET, BODY), SECRET) === true)
check('signature with wrong secret rejects', isValidMetaSignature(BODY, sign('wrong-secret', BODY), SECRET) === false)
check('tampered body rejects (signature no longer matches)',
  isValidMetaSignature(BODY.replace('guest-abc', 'guest-xyz'), sign(SECRET, BODY), SECRET) === false)
check('missing signature header rejects', isValidMetaSignature(BODY, null, SECRET) === false)
check('empty signature header rejects', isValidMetaSignature(BODY, '', SECRET) === false)
check('signature without sha256= prefix rejects', isValidMetaSignature(BODY, 'deadbeef', SECRET) === false)
check('signature with wrong length rejects', isValidMetaSignature(BODY, 'sha256=' + '00'.repeat(31), SECRET) === false)
check('empty app secret rejects even with a well-formed signature',
  isValidMetaSignature(BODY, sign(SECRET, BODY), '') === false)
check('empty body with matching signature accepts (Meta sends empty pings for some events)',
  isValidMetaSignature('', sign(SECRET, ''), SECRET) === true)

// Attacker who knows the guestId but NOT the app secret cannot forge a
// valid signature for their own malicious payload — this is the core
// guarantee that closes the RSVP-forgery hole.
const attackerBody = JSON.stringify({
  entry: [{ changes: [{ value: { messages: [{
    from: '966500000000', type: 'interactive',
    interactive: { type: 'button_reply', button_reply: { id: 'RSVP_NO:guest-victim', title: 'أعتذر' } },
  }] } }] }],
})
check('attacker without the app secret cannot forge a signature',
  isValidMetaSignature(attackerBody, 'sha256=' + 'ff'.repeat(32), SECRET) === false)

const failed = results.filter((r) => !r.pass).length
const passed = results.length - failed
process.stdout.write(`\nSummary: ${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
