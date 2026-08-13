import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createOpaqueToken, hashOpaqueToken } from '@/lib/token-hash'
import { rateLimit, getRequestIpFromRequest } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // Rate limit: 5 reset requests per hour per IP. Prevents reset-email
  // spam when email delivery is wired. Generous enough for legitimate
  // "I forgot my password" retries, tight enough to prevent abuse.
  const ip = getRequestIpFromRequest(request)
  if (!rateLimit('reset:' + ip, { max: 5, windowMs: 60 * 60 * 1000 })) {
    return NextResponse.json({ message: 'إذا كان الحساب موجوداً فسيتم إرسال تعليمات استعادة كلمة المرور.' })
  }

  const body = await request.json().catch(() => ({})) as { email?: string }
  const email = String(body.email || '').trim().toLowerCase()
  const generic = { message: 'إذا كان الحساب موجوداً فسيتم إرسال تعليمات استعادة كلمة المرور.' }
  if (!email) return NextResponse.json(generic)

  const user = await db.user.findUnique({ where: { email } })
  if (!user || user.status !== 'active') return NextResponse.json(generic)

  await db.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } })
  const token = createOpaqueToken(32)
  await db.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hashOpaqueToken(token), expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
  })

  // Email delivery is intentionally not wired yet. Never expose the token in production.
  if (process.env.NODE_ENV !== 'production') return NextResponse.json({ ...generic, developmentToken: token })
  return NextResponse.json(generic)
}
