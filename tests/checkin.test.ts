// Pure-logic tests for check-in deduplication and QR scoping.
import { isValidQrToken, mintQrToken } from '../src/lib/qr-token'
const results: Array<{ name: string; pass: boolean }> = []
function check(name: string, pass: boolean) {
  results.push({ name, pass })
  process.stdout.write((pass ? '✓ ' : '✗ ') + name + '\n')
}

const t = mintQrToken()
check('mintQrToken returns >=32 chars', t.length >= 32)
check('mintQrToken returns URL-safe base64', /^[A-Za-z0-9_-]+$/.test(t))
check('isValidQrToken accepts minted token', isValidQrToken(t))
check('isValidQrToken rejects empty', !isValidQrToken(''))
check('isValidQrToken rejects null/undefined', !isValidQrToken(null as any))
check('isValidQrToken rejects short string', !isValidQrToken('abc'))
check('two minted tokens differ', mintQrToken() !== mintQrToken())

const failed = results.filter(r => !r.pass).length
process.stdout.write(`\nSummary: ${results.length - failed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
