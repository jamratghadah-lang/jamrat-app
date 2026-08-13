// Resend email sending via their REST API directly (no SDK dependency
// needed — one fetch call). Credentials come from the `integration_configs`
// DB row saved via the dashboard's Integrations tab.

import { getIntegrationConfig } from './integration-config'

export interface EmailSendResult {
  ok: boolean
  error?: string
}

export async function sendEmail(params: {
  to: string
  subject: string
  html: string
}): Promise<EmailSendResult> {
  const { fields } = await getIntegrationConfig('resend')
  const apiKey = fields.RESEND_API_KEY?.trim() || process.env.RESEND_API_KEY?.trim()
  const from = fields.SEND_FROM?.trim() || process.env.RESEND_FROM_EMAIL?.trim()
  if (!apiKey || !from) {
    return { ok: false, error: 'الإيميل غير مفعّل — أضيفي API Key و From Email من لوحة التكاملات' }
  }
  if (!params.to) return { ok: false, error: 'لا يوجد بريد إلكتروني لهذه المدعوة' }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('Resend API error:', res.status, errText)
      let message = errText
      try {
        const parsed = JSON.parse(errText)
        message = parsed?.message || errText
      } catch { /* keep raw text */ }
      return { ok: false, error: message.slice(0, 300) }
    }
    return { ok: true }
  } catch (error) {
    console.error('Email send failed:', error)
    return { ok: false, error: error instanceof Error ? error.message : 'فشل الاتصال بمزود البريد' }
  }
}

// Builds the invitation email body: event details, a link to the video
// (email clients don't reliably play inline video, so it links out),
// and one prominent button to the RSVP page. The button is a GET link
// to a page that only *displays* the invite — the guest still has to
// tap a real button on that page to submit a response, which avoids
// email link-scanners (Outlook Safe Links, corporate proxies) silently
// pre-fetching the link and recording a false confirmation.
export function buildInviteEmailHtml(params: {
  guestName: string
  eventName: string
  date: string
  time: string
  location: string
  videoUrl?: string
  rsvpUrl: string
}): string {
  const { guestName, eventName, date, time, location, videoUrl, rsvpUrl } = params
  return `
  <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;background:#0d1117;padding:32px 16px;">
    <div style="max-width:480px;margin:0 auto;background:#11161d;border:1px solid rgba(201,162,92,.35);border-radius:16px;padding:32px 24px;text-align:center;">
      <h1 style="color:#c9a25c;font-size:20px;margin:0 0 8px;">${escapeHtml(eventName)}</h1>
      ${guestName ? `<p style="color:#d1d5db;margin:0 0 16px;">أهلًا وسهلًا ${escapeHtml(guestName)} 🌸</p>` : ''}
      <p style="color:#9ca3af;font-size:14px;margin:0 0 4px;">${escapeHtml(date)}${time ? ` — ${escapeHtml(time)}` : ''}</p>
      <p style="color:#9ca3af;font-size:14px;margin:0 0 20px;">${escapeHtml(location)}</p>
      ${videoUrl ? `<p style="margin:0 0 20px;"><a href="${escapeHtml(videoUrl)}" style="color:#c9a25c;">🎬 مشاهدة فيديو الدعوة</a></p>` : ''}
      <a href="${escapeHtml(rsvpUrl)}" style="display:inline-block;background:#c9a25c;color:#0d1117;font-weight:bold;padding:14px 32px;border-radius:10px;text-decoration:none;">تأكيد الحضور</a>
    </div>
  </div>`
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}
