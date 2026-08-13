// WhatsApp Cloud API (Meta Graph API). Credentials come from the
// `integration_configs` DB row saved via the dashboard's Integrations
// tab (falls back to env vars if someone prefers that route instead).
//
// Env var names are now CONSISTENT with the DB field names:
//   DB field              env var (fallback)
//   WHATSAPP_PHONE_ID     WHATSAPP_PHONE_ID
//   WHATSAPP_TOKEN        WHATSAPP_TOKEN
//   WHATSAPP_VERIFY_TOKEN WHATSAPP_VERIFY_TOKEN
//   WHATSAPP_TEMPLATE_NAME   WHATSAPP_TEMPLATE_NAME
//   WHATSAPP_TEMPLATE_LANG   WHATSAPP_TEMPLATE_LANG
// (The legacy env names WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN
//  are still accepted as a compatibility shim during migration.)

import { getIntegrationConfig } from './integration-config'

const GRAPH_VERSION = 'v20.0'

async function credentials(): Promise<{ phoneNumberId: string; accessToken: string } | null> {
  const { fields } = await getIntegrationConfig('whatsapp')
  const phoneNumberId =
    fields.WHATSAPP_PHONE_ID?.trim() ||
    process.env.WHATSAPP_PHONE_ID?.trim() ||
    process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() // legacy alias
  const accessToken =
    fields.WHATSAPP_TOKEN?.trim() ||
    process.env.WHATSAPP_TOKEN?.trim() ||
    process.env.WHATSAPP_ACCESS_TOKEN?.trim() // legacy alias
  if (!phoneNumberId || !accessToken) return null
  return { phoneNumberId, accessToken }
}

export interface WhatsAppSendResult {
  ok: boolean
  error?: string
}

async function callGraphApi(body: Record<string, unknown>): Promise<WhatsAppSendResult> {
  const creds = await credentials()
  if (!creds) {
    return { ok: false, error: 'واتساب غير مفعّل — أضيفي Phone Number ID و Access Token من لوحة التكاملات' }
  }
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${creds.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creds.accessToken}`,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('WhatsApp API error:', res.status, errText)
      let message = errText
      try {
        const parsed = JSON.parse(errText)
        message = parsed?.error?.message || errText
      } catch { /* keep raw text */ }
      return { ok: false, error: message.slice(0, 300) }
    }
    return { ok: true }
  } catch (error) {
    console.error('WhatsApp send failed:', error)
    return { ok: false, error: error instanceof Error ? error.message : 'فشل الاتصال بواتساب' }
  }
}

export async function sendWhatsAppText(to: string, text: string): Promise<WhatsAppSendResult> {
  return callGraphApi({
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text },
  })
}

// Up to 3 quick-reply buttons for a SESSION message (only deliverable
// within the 24h window after the guest has messaged in). Used for the
// RSVP follow-up conversation (companion count, thank-you), never for
// the first outbound invite — that must be a template (see below).
export async function sendWhatsAppButtons(
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>,
): Promise<WhatsAppSendResult> {
  return callGraphApi({
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: bodyText },
      action: {
        buttons: buttons.slice(0, 3).map((b) => ({
          type: 'reply',
          reply: { id: b.id, title: b.title.slice(0, 20) },
        })),
      },
    },
  })
}

// The real invitation send: a pre-approved WhatsApp Template message
// (required to message a guest who has never written in first), with
// an optional video header and two RSVP quick-reply buttons whose
// payload embeds the guestId so the webhook needs no extra lookup.
//
// IMPORTANT: `templateName` / `languageCode` must match exactly what
// was approved in Meta Business Manager. The template must have TWO
// quick-reply buttons in this exact order:
//   index 0 → "سأحضر"  (payload will be `RSVP_YES:<guestId>`)
//   index 1 → "أعتذر"  (payload will be `RSVP_NO:<guestId>`)
// If your approved template has the buttons in a different order, the
// RSVP flow will silently record the wrong response. Verify in Meta
// Business Manager before going live.
//
// Configure the template name from the "whatsapp" integration config
// field WHATSAPP_TEMPLATE_NAME, default 'rsvp_confirmation' / 'ar'.
export async function sendWhatsAppInviteTemplate(params: {
  to: string
  guestId: string
  guestName: string
  eventName: string
  videoUrl?: string
}): Promise<WhatsAppSendResult> {
  const { fields } = await getIntegrationConfig('whatsapp')
  const templateName =
    fields.WHATSAPP_TEMPLATE_NAME?.trim() ||
    process.env.WHATSAPP_TEMPLATE_NAME?.trim() ||
    'rsvp_confirmation'
  const languageCode =
    fields.WHATSAPP_TEMPLATE_LANG?.trim() ||
    process.env.WHATSAPP_TEMPLATE_LANG?.trim() ||
    'ar'

  const components: Array<Record<string, unknown>> = []
  if (params.videoUrl) {
    components.push({
      type: 'header',
      parameters: [{ type: 'video', video: { link: params.videoUrl } }],
    })
  }
  components.push({
    type: 'body',
    parameters: [
      { type: 'text', text: params.guestName || 'ضيفتنا الغالية' },
      { type: 'text', text: params.eventName || '' },
    ],
  })
  components.push({
    type: 'button',
    sub_type: 'quick_reply',
    index: '0',
    parameters: [{ type: 'payload', payload: `RSVP_YES:${params.guestId}` }],
  })
  components.push({
    type: 'button',
    sub_type: 'quick_reply',
    index: '1',
    parameters: [{ type: 'payload', payload: `RSVP_NO:${params.guestId}` }],
  })

  return callGraphApi({
    messaging_product: 'whatsapp',
    to: params.to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
      components,
    },
  })
}
