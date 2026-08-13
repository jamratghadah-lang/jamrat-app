// Integration configuration surface.
// GET  — returns the list of services with their REAL persisted config
//         from the `integration_configs` table. Sensitive field values
//         are redacted (only `hasValue: true/false` is exposed).
// POST — saves (upserts) the config for a service. Values are persisted
//         to the DB so they survive page reloads.
//
// No outbound SDK calls live here — the test connection endpoint
// (/api/integrations/test) is still a no-op in this build, but the
// CONFIG itself is now real and persistent.

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getRequestUser, resolveRequestUserName } from '@/lib/event-access'
import { recordAudit } from '@/lib/audit'
import { getRequestIp } from '@/lib/hooks'
import { saveIntegrationConfig, isEncryptionEnabled } from '@/lib/integration-config'
import { badRequest, forbidden, handleApiError } from '@/lib/api-errors'

export const runtime = 'nodejs'

// Known services and their field definitions.
// `sensitive: true` fields are redacted in GET responses (only `hasValue` is exposed).
const SERVICES: Array<{
  key: string
  label: string
  fields: Array<{ key: string; label: string; sensitive: boolean }>
}> = [
  {
    key: 'firebase',
    label: 'Firebase (الإشعارات)',
    fields: [
      { key: 'FIREBASE_PROJECT_ID', label: 'Project ID', sensitive: false },
      { key: 'FIREBASE_SERVICE_ACCOUNT_JSON', label: 'Service Account JSON', sensitive: true },
    ],
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp Business API',
    fields: [
      { key: 'WHATSAPP_PHONE_ID', label: 'Phone Number ID', sensitive: false },
      { key: 'WHATSAPP_TOKEN', label: 'Access Token', sensitive: true },
      { key: 'WHATSAPP_VERIFY_TOKEN', label: 'Verify Token (Webhook)', sensitive: false },
      { key: 'WHATSAPP_TEMPLATE_NAME', label: 'اسم القالب المعتمد (Template Name)', sensitive: false },
      { key: 'WHATSAPP_TEMPLATE_LANG', label: 'لغة القالب (مثال: ar)', sensitive: false },
    ],
  },
  {
    key: 'resend',
    label: 'Resend (البريد الإلكتروني)',
    fields: [
      { key: 'RESEND_API_KEY', label: 'API Key', sensitive: true },
      { key: 'SEND_FROM', label: 'From Email', sensitive: false },
    ],
  },
  {
    key: 'cloudinary',
    label: 'Cloudinary (الصور والفيديو)',
    fields: [
      { key: 'CLOUDINARY_CLOUD_NAME', label: 'Cloud Name', sensitive: false },
      { key: 'CLOUDINARY_API_KEY', label: 'API Key', sensitive: false },
      { key: 'CLOUDINARY_API_SECRET', label: 'API Secret', sensitive: true },
    ],
  },
  {
    key: 'robot',
    label: 'Robot (Webhook للأتمتة)',
    fields: [
      { key: 'ROBOT_WEBHOOK_URL', label: 'Webhook URL', sensitive: false },
    ],
  },
]

function redactConfig(config: Record<string, string>, serviceKey: string) {
  const service = SERVICES.find((s) => s.key === serviceKey)
  if (!service) return { fields: {}, hasValues: false }
  const out: Record<string, { hasValue: boolean; value?: string }> = {}
  let hasAny = false
  for (const f of service.fields) {
    const v = config[f.key]
    if (typeof v === 'string' && v.length > 0) {
      // Non-sensitive fields return the value (so the UI can show masked preview);
      // sensitive fields only return hasValue.
      out[f.key] = f.sensitive ? { hasValue: true } : { hasValue: true, value: v }
      hasAny = true
    } else {
      out[f.key] = { hasValue: false }
    }
  }
  return { fields: out, hasValues: hasAny }
}

export async function GET(request: NextRequest) {
  try {
    const user = getRequestUser(request)
    if (user.role !== 'admin') {
      return forbidden('هذا القسم للمدير فقط')
    }

    // Load all persisted configs from DB
    const rows = await db.integrationConfig.findMany()
    const byKey = new Map(rows.map((r) => [r.key, r]))

    const integrations = SERVICES.map((svc) => {
      const row = byKey.get(svc.key)
      const config = row ? safeParseConfig(row.config) : {}
      const redacted = redactConfig(config, svc.key)
      return {
        key: svc.key,
        label: svc.label,
        configured: redacted.hasValues,
        enabled: row?.enabled ?? false,
        fields: svc.fields.map((f) => ({
          key: f.key,
          label: f.label,
          sensitive: f.sensitive,
          hasValue: redacted.fields[f.key]?.hasValue ?? false,
          // For non-sensitive fields, return the value so the UI can pre-fill the input
          value: f.sensitive ? undefined : redacted.fields[f.key]?.value,
        })),
        updatedAt: row?.updatedAt ?? null,
      }
    })

    const envStatus = Object.fromEntries(integrations.map((i) => [i.key, i.configured]))

    return NextResponse.json({ integrations, envStatus })
  } catch (error) {
    return handleApiError(error, 'Get integrations error:')
  }
}

function safeParseConfig(s: string): Record<string, string> {
  try {
    const parsed = JSON.parse(s)
    if (parsed && typeof parsed === 'object') {
      const out: Record<string, string> = {}
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string') out[k] = v
      }
      return out
    }
  } catch {
    /* ignore */
  }
  return {}
}

export async function POST(request: NextRequest) {
  try {
    const user = getRequestUser(request)
    if (user.role !== 'admin') {
      return forbidden('هذا القسم للمدير فقط')
    }

    const body = await request.json().catch(() => ({})) as {
      key?: string
      config?: Record<string, unknown>
      enabled?: boolean
    }

    const serviceKey = typeof body.key === 'string' ? body.key : ''
    const service = SERVICES.find((s) => s.key === serviceKey)
    if (!service) {
      return badRequest('خدمة غير معروفة')
    }

    // Only persist known fields for this service
    const config: Record<string, string> = {}
    if (body.config && typeof body.config === 'object') {
      for (const f of service.fields) {
        const v = (body.config as Record<string, unknown>)[f.key]
        if (typeof v === 'string' && v.length > 0) {
          config[f.key] = v
        }
      }
    }

    const enabled = typeof body.enabled === 'boolean' ? body.enabled : Object.keys(config).length > 0

    // Persist via saveIntegrationConfig — it transparently encrypts
    // sensitive fields (API tokens, service account JSON) at rest.
    await saveIntegrationConfig(serviceKey, service.label, config, enabled)

    // Fetch back the row to get its id for the audit trail.
    const upserted = await db.integrationConfig.findUnique({ where: { key: serviceKey }, select: { id: true, updatedAt: true } })

    await recordAudit({
      userId: user.id,
      userName: await resolveRequestUserName(user),
      text: `حفظ إعدادات تكامل ${service.label}`,
      entity: 'integration',
      entityId: upserted?.id || '',
      action: 'integration_save',
      oldValue: '',
      newValue: JSON.stringify({ key: serviceKey, enabled, fieldCount: Object.keys(config).length, encrypted: isEncryptionEnabled() }),
      ipAddress: getRequestIp(request),
    })

    return NextResponse.json({
      ok: true,
      key: serviceKey,
      enabled,
      fieldCount: Object.keys(config).length,
      encrypted: isEncryptionEnabled(),
      updatedAt: upserted?.updatedAt ?? null,
    })
  } catch (error) {
    return handleApiError(error, 'Save integrations error:')
  }
}
