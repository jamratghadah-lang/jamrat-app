'use client';

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/store'

interface ServiceField {
  key: string
  label: string
  type: 'text' | 'password'
  placeholder: string
  sensitive: boolean
}

interface ServiceCard {
  key: string
  name: string
  icon: string
  color: string
  desc: string
  badges: string[]
  fields: ServiceField[]
}

const services: ServiceCard[] = [
  {
    key: 'firebase',
    name: 'Firebase',
    icon: '🔥',
    color: '#ffca28',
    desc: 'Authentication + Firestore + Storage',
    badges: ['Auth', 'DB', 'Storage', 'Notifications'],
    fields: [
      { key: 'FIREBASE_PROJECT_ID', label: 'Project ID', type: 'text', placeholder: 'jamrat-xxxxx', sensitive: false },
      { key: 'FIREBASE_SERVICE_ACCOUNT_JSON', label: 'Service Account JSON', type: 'password', placeholder: '{ "type": "service_account", ... }', sensitive: true },
    ],
  },
  {
    key: 'whatsapp',
    name: 'WhatsApp Business',
    icon: '💬',
    color: '#25d366',
    desc: 'إرسال الرسائل النصية والوسائط',
    badges: ['Placeholder'],
    fields: [
      { key: 'WHATSAPP_PHONE_ID', label: 'Phone Number ID', type: 'text', placeholder: 'رقم هاتف البزنس', sensitive: false },
      { key: 'WHATSAPP_TOKEN', label: 'Access Token', type: 'password', placeholder: 'EAAGm0PX4ZCps...', sensitive: true },
      { key: 'WHATSAPP_VERIFY_TOKEN', label: 'Verify Token (Webhook)', type: 'text', placeholder: 'my_custom_verify_token', sensitive: false },
    ],
  },
  {
    key: 'resend',
    name: 'Resend (البريد)',
    icon: '📧',
    color: '#bc8cff',
    desc: 'إرسال البريد الإلكتروني والتقارير',
    badges: ['Placeholder'],
    fields: [
      { key: 'RESEND_API_KEY', label: 'API Key', type: 'password', placeholder: 're_xxxxxxxxxxxx', sensitive: true },
      { key: 'SEND_FROM', label: 'From Email', type: 'text', placeholder: 'noreply@jamratghadah.com', sensitive: false },
    ],
  },
  {
    key: 'cloudinary',
    name: 'Cloudinary',
    icon: '☁️',
    color: '#3498db',
    desc: 'تخزين الفيديوهات والصور',
    badges: ['Placeholder'],
    fields: [
      { key: 'CLOUDINARY_CLOUD_NAME', label: 'Cloud Name', type: 'text', placeholder: 'your-cloud-name', sensitive: false },
      { key: 'CLOUDINARY_API_KEY', label: 'API Key', type: 'text', placeholder: 'xxxxxxxxxxxx', sensitive: false },
      { key: 'CLOUDINARY_API_SECRET', label: 'API Secret', type: 'password', placeholder: 'xxxxxxxxxxxx', sensitive: true },
    ],
  },
  {
    key: 'robot',
    name: 'Robot (Webhook)',
    icon: '🤖',
    color: '#9333ea',
    desc: 'Webhook للأتمتة والربط الخارجي',
    badges: ['Webhook'],
    fields: [
      { key: 'ROBOT_WEBHOOK_URL', label: 'Webhook URL', type: 'text', placeholder: 'https://example.com/webhook', sensitive: false },
    ],
  },
]

const statusMap: Record<string, { label: string; cls: string }> = {
  configured: { label: 'مهيّأ', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  partial: { label: 'جزئي', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  empty: { label: 'غير مهيّأ', cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
}

function useToast() {
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: 'success' | 'error' | 'info' }>>([])
  const show = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((p) => [...p, { id, message, type }])
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500)
  }, [])
  const ToastContainer = toasts.length > 0 ? (
    <div className="fixed bottom-6 left-6 z-[9999] flex flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={`px-5 py-3 rounded-lg text-sm font-medium shadow-lg backdrop-blur ${t.type === 'success' ? 'bg-emerald-500/90 text-white' : t.type === 'error' ? 'bg-red-500/90 text-white' : 'bg-amber-500/90 text-white'}`}>{t.message}</div>
      ))}
    </div>
  ) : null
  return { show, ToastContainer }
}

export default function IntegrationsPage() {
  const { show, ToastContainer } = useToast()
  const [expanded, setExpanded] = useState<string | null>(null)
  // Form values (what the user is typing)
  const [values, setValues] = useState<Record<string, string>>({})
  // Persisted state from the server (which fields have a saved value)
  const [persisted, setPersisted] = useState<Record<string, { configured: boolean; enabled: boolean; updatedAt: string | null }>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r: any = await api.getIntegrations()
      const integrations: any[] = Array.isArray(r?.integrations) ? r.integrations : []
      const persistedMap: Record<string, { configured: boolean; enabled: boolean; updatedAt: string | null }> = {}
      const formValues: Record<string, string> = {}
      for (const i of integrations) {
        persistedMap[i.key] = {
          configured: !!i.configured,
          enabled: !!i.enabled,
          updatedAt: i.updatedAt || null,
        }
        // Pre-fill non-sensitive fields that have a saved value
        if (Array.isArray(i.fields)) {
          for (const f of i.fields) {
            if (!f.sensitive && f.hasValue && typeof f.value === 'string') {
              formValues[f.key] = f.value
            }
          }
        }
      }
      setPersisted(persistedMap)
      setValues(formValues)
    } catch (e: any) {
      show(e?.message || 'فشل تحميل التكاملات', 'error')
    } finally {
      setLoading(false)
    }
  }, [show])

  useEffect(() => { load() }, [load])

  const toggle = (key: string) => setExpanded((prev) => (prev === key ? null : key))

  const handleSave = async (svc: ServiceCard) => {
    setSaving(svc.key)
    try {
      // Build config object from current form values for this service's fields
      const config: Record<string, string> = {}
      for (const f of svc.fields) {
        const v = values[f.key]
        if (typeof v === 'string' && v.length > 0) {
          config[f.key] = v
        }
      }
      // For sensitive fields that were previously saved but not re-entered, keep them
      // (server keeps existing values for sensitive fields if the form sends empty)
      const r: any = await api.saveIntegration({ key: svc.key, config, enabled: Object.keys(config).length > 0 })
      show(r?.ok ? `تم حفظ إعدادات ${svc.name} (${r.fieldCount} حقل)` : 'لم يتم الحفظ', r?.ok ? 'success' : 'error')
      await load()
    } catch (e: any) {
      show(e?.message || `فشل حفظ إعدادات ${svc.name}`, 'error')
    } finally {
      setSaving(null)
    }
  }

  const handleClear = async (svc: ServiceCard) => {
    if (!confirm(`هل تريد مسح إعدادات ${svc.name}؟`)) return
    setSaving(svc.key)
    try {
      await api.saveIntegration({ key: svc.key, config: {}, enabled: false })
      // Clear form values for this service
      setValues((prev) => {
        const next = { ...prev }
        for (const f of svc.fields) delete next[f.key]
        return next
      })
      show(`تم مسح إعدادات ${svc.name}`, 'success')
      await load()
    } catch (e: any) {
      show(e?.message || `فشل مسح إعدادات ${svc.name}`, 'error')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-6">
      {ToastContainer}
      <div>
        <h1 className="text-2xl font-extrabold">الربط والخدمات الخارجية</h1>
        <p className="text-sm text-gray-500 mt-1">
          إدارة ربط التطبيق بجميع الخدمات الخارجية — التوكنات والمفاتيح تُحفظ في قاعدة البيانات
        </p>
      </div>

      {loading ? (
        <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-12 text-center text-gray-500">
          جارٍ تحميل التكاملات...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {services.map((svc) => {
            const p = persisted[svc.key] || { configured: false, enabled: false, updatedAt: null }
            const statusKey = p.configured ? 'configured' : 'empty'
            const st = statusMap[statusKey]
            const isOpen = expanded === svc.key
            const filledCount = svc.fields.filter((f) => p.configured && (values[f.key] || f.sensitive)).length
            return (
              <div key={svc.key} className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden transition">
                {/* Card Header */}
                <div className="p-4 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5">{svc.icon}</span>
                    <div>
                      <h3 className="font-bold text-sm">{svc.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{svc.desc}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {svc.badges.map((b) => (
                          <span key={b} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">{b}</span>
                        ))}
                        {p.configured && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {filledCount} حقل محفوظ
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border whitespace-nowrap ${st.cls}`}>{st.label}</span>
                </div>

                {/* Actions */}
                <div className="px-4 pb-3 flex items-center gap-2">
                  <button
                    onClick={() => toggle(svc.key)}
                    className={`flex-1 text-xs py-2 rounded-lg border transition font-medium ${
                      isOpen
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        : 'border-[#30363d] text-gray-400 hover:text-gray-200 hover:border-gray-500'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                      {isOpen ? 'إغلاق' : 'إعدادات'}
                    </span>
                  </button>
                  {p.configured && (
                    <button
                      onClick={() => handleClear(svc)}
                      disabled={saving === svc.key}
                      className="text-[10px] py-2 px-3 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition disabled:opacity-50"
                    >
                      مسح
                    </button>
                  )}
                </div>

                {/* Expandable Fields */}
                {isOpen && (
                  <div className="border-t border-[#30363d] p-4 space-y-3 bg-[#0d1117]/50">
                    {svc.fields.map((f) => {
                      const hasPersistedValue = p.configured && f.sensitive
                      return (
                        <div key={f.key}>
                          <label className="block text-[11px] font-semibold text-gray-400 mb-1.5">
                            {f.label}
                            <span className="text-gray-600 font-mono mr-2 text-[10px]">({f.key})</span>
                            {hasPersistedValue && (
                              <span className="text-emerald-400 text-[10px] mr-2">✓ محفوظ</span>
                            )}
                          </label>
                          <input
                            type={f.type}
                            placeholder={f.sensitive && hasPersistedValue ? '•••••••• (أدخل قيمة جديدة للاستبدال)' : f.placeholder}
                            value={values[f.key] || ''}
                            onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                            className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-gray-200 outline-none focus:border-amber-500 transition placeholder:text-gray-600 font-mono text-xs"
                            dir="ltr"
                          />
                        </div>
                      )
                    })}
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => handleSave(svc)}
                        disabled={saving === svc.key}
                        className="flex-1 text-xs py-2.5 rounded-lg bg-gradient-to-l from-amber-500 to-amber-600 text-[#0d1117] font-bold hover:from-amber-400 hover:to-amber-500 transition disabled:opacity-50"
                      >
                        {saving === svc.key ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}
                      </button>
                    </div>
                    {p.updatedAt && (
                      <p className="text-[10px] text-gray-600 leading-relaxed">
                        آخر تحديث: {new Date(p.updatedAt).toLocaleString('ar-SA')}
                      </p>
                    )}
                    <p className="text-[10px] text-gray-600 leading-relaxed">
                      💡 القيم تُحفظ في قاعدة البيانات (<code className="text-gray-500">integration_configs</code>).
                      الحقول الحساسة تبقى محفوظة لكنها لا تُعرض بعد الحفظ.
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Note about test connection */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">ℹ️</span>
          <div>
            <p className="text-sm font-semibold text-blue-400">ملاحظة حول اختبار الاتصال</p>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              اختبار الاتصال الفعلي مع المزودين (Cloudinary / WhatsApp / Resend) غير مفعّل في هذه النسخة.
              زر &quot;اختبار&quot; في صفحة الإعدادات يُرجع استجابة وهمية. الإعدادات نفسها تُحفظ بشكل حقيقي.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
