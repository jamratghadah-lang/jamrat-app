// Integration self-test button. Admin-only. This "test connection"
// probe itself stays a no-op — it does not send a real WhatsApp/email
// message just to test config. Real sending happens from
// /api/invitations (invite/reminder/thank_you) using the same saved
// config via src/lib/whatsapp.ts and src/lib/email.ts.
import { NextRequest, NextResponse } from 'next/server'
import { getRequestUser } from '@/lib/event-access'
import { forbidden } from '@/lib/api-errors'

export async function POST(request: NextRequest) {
  const user = getRequestUser(request)
  if (user.role !== 'admin') {
    return forbidden('هذا القسم للمدير فقط')
  }
  const body = await request.json().catch(() => ({}))
  const key = String(body.key || '').trim()
  const allowed = new Set(['cloudinary', 'whatsapp', 'resend', 'robot', 'firebase'])
  if (!allowed.has(key)) {
    return NextResponse.json({ success: false, error: 'خدمة غير معروفة' }, { status: 400 })
  }
  return NextResponse.json({
    success: false,
    key,
    error: 'زر الاختبار لا يرسل رسالة فعلية',
    message: 'هذا الزر لا يرسل رسالة تجريبية — تحققي من الإعدادات محفوظة، والإرسال الحقيقي يتم من صفحة إرسال الدعوات',
  })
}
