import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { signToken, comparePassword, hashPassword, encodeBearer } from '@/lib/auth'
import { LoginInput, formatZodIssues } from '@/lib/validation'
import { isProduction } from '@/lib/env'
import { createOpaqueToken, hashOpaqueToken } from '@/lib/token-hash'
import { isLoginRateLimited, recordLoginAttempt } from '@/lib/login-rate-limit'
import { recordAudit } from '@/lib/audit'
import { forbidden, handleApiError, unauthorized } from '@/lib/api-errors'

function getIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || ''
}

export async function POST(request: NextRequest) {
  const ip = getIp(request)
  let email = ''
  try {
    const parsed = LoginInput.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      await recordAudit({ userName: 'مجهول', text: 'محاولة تسجيل دخول ببيانات غير صالحة', action: 'login_validation_failed', ipAddress: ip })
      return NextResponse.json(formatZodIssues(parsed.error), { status: 400 })
    }
    email = parsed.data.email.trim().toLowerCase()
    const { password } = parsed.data

    if (await isLoginRateLimited(ip, email)) {
      await recordAudit({ userName: email, text: 'تم حظر محاولة تسجيل الدخول مؤقتاً بسبب كثرة المحاولات الفاشلة', action: 'login_rate_limited', ipAddress: ip })
      return NextResponse.json({ error: 'تم تجاوز عدد محاولات تسجيل الدخول. حاول مرة أخرى بعد 15 دقيقة.' }, { status: 429 })
    }

    let user = await db.user.findFirst({ where: { email } })

    // First-run bootstrap: development only.
    if (!user) {
      const userCount = await db.user.count()
      if (userCount === 0 && !isProduction()) {
        const adminPass = await hashPassword(password)
        user = await db.user.create({
          data: { name: 'مدير النظام', email, password: adminPass, role: 'admin', status: 'active' },
        })
      } else {
        await recordLoginAttempt({ ip, email, success: false })
        await recordAudit({ userName: email, text: 'فشل تسجيل الدخول: بيانات الدخول غير صحيحة', action: 'login_failed', ipAddress: ip })
        return unauthorized('بيانات الدخول غير صحيحة')
      }
    }

    const isValid = await comparePassword(password, user.password)
    if (!isValid) {
      await recordLoginAttempt({ ip, email, success: false })
      await recordAudit({ userId: user.id, userName: user.name || email, text: 'فشل تسجيل الدخول: كلمة المرور غير صحيحة', action: 'login_failed', ipAddress: ip })
      return unauthorized('بيانات الدخول غير صحيحة')
    }
    if (user.status === 'disabled') {
      await recordLoginAttempt({ ip, email, success: false })
      await recordAudit({ userId: user.id, userName: user.name || email, text: 'محاولة تسجيل دخول لحساب معطل', action: 'login_disabled', ipAddress: ip })
      return forbidden('الحساب معطل')
    }

    await recordLoginAttempt({ ip, email, success: true })
    await db.user.update({
      where: { id: user.id },
      data: { lastActive: new Date() },
    })

    // Mint an opaque session token (NOT the JWT). Its sha256 hash is
    // stored in sessions.tokenHash; the raw value is returned to the
    // client and NEVER stored server-side. The bearer token sent on
    // subsequent requests is `<jwt>.<opaqueSessionToken>` so a leaked
    // JWT alone is useless.
    const rawSessionToken = createOpaqueToken(32)
    const session = await db.session.create({
      data: {
        userId: user.id,
        tokenHash: hashOpaqueToken(rawSessionToken),
        deviceName: request.headers.get('x-device-name') || 'متصفح',
        userAgent: request.headers.get('user-agent') || '',
        ipAddress: ip,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    const jwtToken = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
      sessionId: session.id,
    })

    // Combined bearer = `<jwt>.<opaqueSessionToken>`.
    const bearer = encodeBearer(jwtToken, rawSessionToken)

    await recordAudit({
      userId: user.id,
      userName: user.name || user.email,
      text: 'تم تسجيل الدخول بنجاح',
      action: 'login_success',
      ipAddress: ip,
    })

    const { password: _p, ...safeUser } = user
    return NextResponse.json({ user: safeUser, token: bearer })
  } catch (error) {
    // v11.0: use handleApiError for consistent error shape + logging.
    // The login_error audit row is kept — it's business logic, not
    // error handling.
    await recordAudit({ userName: email || 'مجهول', text: 'خطأ غير متوقع أثناء تسجيل الدخول', action: 'login_error', ipAddress: ip })
    return handleApiError(error, 'Login POST')
  }
}
