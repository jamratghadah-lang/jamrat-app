import { NextResponse } from 'next/server'
export async function GET() {
  return NextResponse.json({
    name: 'جمرة غضا API',
    status: 'ok',
    version: '1.1.0',
    security: {
      jwtSecretSource: 'env-required',
      qrSecret: 'random-token-not-row-id',
      checkinUniqueness: 'db-enforced',
      auditLog: 'append-only',
    },
  })
}
