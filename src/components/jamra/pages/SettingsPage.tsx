'use client'

import type { ReactNode } from 'react'
import { useState, useCallback, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { api } from '@/lib/store'

const labelCls = 'text-xs font-semibold text-gray-400 mb-1.5 block'
const saveBtnCls = 'rounded-lg bg-gradient-to-l from-amber-500 to-amber-600 text-[#0d1117] px-5 py-2.5 text-sm font-bold hover:from-amber-400 hover:to-amber-500 transition'

function useToast() {
  const [toasts, setToasts] = useState<any[]>([])
  const show = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now()
    setToasts(p => [...p, { id, message, type }])
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3000)
  }, [])
  const ToastContainer = toasts.length > 0 ? (
    <div className="fixed bottom-6 left-6 z-[9999] flex flex-col gap-2">
      {toasts.map(t => (
        <div key={t.id} className={'px-5 py-3 rounded-lg text-sm font-medium shadow-lg backdrop-blur ' + (t.type === 'success' ? 'bg-emerald-500/90 text-white' : t.type === 'error' ? 'bg-red-500/90 text-white' : 'bg-amber-500/90 text-white')}>{t.message}</div>
      ))}
    </div>
  ) : null
  return { show, ToastContainer }
}

function Toggle({ value, onToggle }: { value: boolean; onToggle: (v: boolean) => void }) {
  return (
    <button onClick={() => onToggle(!value)} className={'relative w-11 h-6 rounded-full transition-colors ' + (value ? 'bg-amber-500' : 'bg-[#30363d]')}>
      <span className={'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ' + (value ? 'right-0.5' : 'right-[22px]')} />
    </button>
  )
}

function Section({ title, icon, children, defaultOpen = false, status }: { title: string; icon?: string; children: React.ReactNode; defaultOpen?: boolean; status?: 'connected' | 'disconnected' | 'partial' }) {
  const [open, setOpen] = useState(defaultOpen)
  let badge: ReactNode = null
  if (status === 'connected') badge = <span className='mr-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold'>متصل</span>
  else if (status === 'partial') badge = <span className='mr-2 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold'>جزئي</span>
  else if (status === 'disconnected') badge = <span className='mr-2 text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold'>غير متصل</span>
  return (
    <div className="rounded-xl border border-[#30363d] bg-[#161b22] overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-4 text-right hover:bg-[#1c2333]/50 transition-colors">
        <span className="text-sm font-semibold text-gray-200 flex items-center gap-2">{icon && <span>{icon}</span>}{title}{badge}</span>
        <span className={'text-gray-500 text-xs transition-transform ' + (open ? 'rotate-180' : '')}>▾</span>
      </button>
      {open && <div className="px-5 pb-5 space-y-4 border-t border-[#30363d] pt-4">{children}</div>}
    </div>
  )
}

function EnvStatusRow({ label, envVar, configured }: { label: string; envVar: string; configured: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-[#0d1117] border border-[#30363d]">
      <div>
        <p className="text-sm text-gray-300">{label}</p>
        <p className="text-[10px] text-gray-600 font-mono" dir="ltr">{envVar}</p>
      </div>
      {configured ? (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">مُعد</span>
      ) : (
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold">غير مُعد</span>
      )}
    </div>
  )
}

function StatusCard({ label, status, items }: { label: string; status: 'connected' | 'disconnected' | 'partial'; items: { label: string; envVar: string; configured: boolean }[] }) {
  const configured = items.filter(i => i.configured).length
  const total = items.length
  const pct = Math.round((configured / total) * 100)
  const color = pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-500' : 'bg-[#30363d]'
  const labelColor = pct === 100 ? 'text-emerald-400' : pct > 0 ? 'text-amber-400' : 'text-gray-500'
  const statusLabel = pct === 100 ? 'جاهز للاتصال' : pct > 0 ? 'بيانات ناقصة' : 'لم يتم الإعداد'
  return (
    <div>
      <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0d1117] border border-[#30363d] mb-3">
        <div className="flex-1">
          <div className="flex justify-between mb-1">
            <span className={'text-[11px] font-semibold ' + labelColor}>{statusLabel}</span>
            <span className="text-[11px] text-gray-500">{configured}/{total}</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[#30363d]">
            <div className={'h-1.5 rounded-full transition-all ' + color} style={{ width: pct + '%' }} />
          </div>
        </div>
      </div>
      <div className="space-y-2">
        {items.map(item => (
          <EnvStatusRow key={item.envVar} label={item.label} envVar={item.envVar} configured={item.configured} />
        ))}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { user, apiConfig, saveApiConfig } = useAppStore()
  const { show, ToastContainer } = useToast()
  const [activeTab, setActiveTab] = useState<'services' | 'general' | 'roles'>('services')
  const [envStatus, setEnvStatus] = useState<Record<string, boolean>>({})
  const [testing, setTesting] = useState<string | null>(null)

  // Fetch env status from server
  useEffect(() => {
    api.getIntegrations().then((r: any) => {
      if (r?.envStatus) setEnvStatus(r.envStatus)
    }).catch(() => {})
  }, [])

  const handleTest = async (service: string) => {
    setTesting(service)
    try {
      const r = await api.testConnection(service)
      if (r?.success) {
        show(r.message || 'الاتصال ناجح', 'success')
      } else {
        show(r?.error || 'فشل الاتصال', 'error')
      }
      // Refresh status
      const updated = await api.getIntegrations()
      if (updated?.envStatus) setEnvStatus(updated.envStatus)
    } catch {
      show('خطأ في اختبار الاتصال', 'error')
    }
    setTesting(null)
  }

  // Non-secret config (stays in store)
  const updateTop = (field: string, value: string | number | boolean) => {
    saveApiConfig({ ...apiConfig, [field]: value })
    show('تم الحفظ', 'success')
  }

  const updateField = (section: string, field: string, value: string | number | boolean) => {
    saveApiConfig({
      ...apiConfig,
      [section]: { ...((apiConfig[section as keyof typeof apiConfig] as unknown) as Record<string, unknown>), [field]: value },
    } as any)
    show('تم الحفظ', 'success')
  }

  const tabs = [
    { key: 'services' as const, label: 'الخدمات والربط' },
    { key: 'general' as const, label: 'عام' },
    { key: 'roles' as const, label: 'الأدوار' },
  ]

  const is = (key: string) => !!envStatus[key]

  return (
    <div className="space-y-4">
      {ToastContainer}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">الإعدادات</h1>
          <p className="text-sm text-gray-500 mt-1">المفاتيح السرية في ملف .env — هذه الصفحة تعرض حالة الاتصال فقط</p>
        </div>
      </div>

      {/* Security Notice */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <span className="text-xl">🔒</span>
          <div>
            <p className="text-sm font-semibold text-amber-400">مفاتيح آمنة على الخادم</p>
            <p className="text-xs text-gray-400 mt-1">جميع المفاتيح السرية مخزنة في متغيرات بيئة الخادم (.env) ولا يتم إرسالها للمتصفح. لتحديثها، عدّل ملف .env وأعد تشغيل الخادم.</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-[#161b22] border border-[#30363d] w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={'px-4 py-2 rounded-md text-sm font-medium transition ' + (activeTab === t.key ? 'bg-amber-500 text-[#0d1117]' : 'text-gray-400 hover:text-gray-200')}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'services' && <>
        {/* WhatsApp */}
        <Section title="WhatsApp Business API" icon="💬" status={is('WHATSAPP') ? 'connected' : 'disconnected'}>
          <StatusCard label="واتساب" status={is('WHATSAPP') ? 'connected' : 'disconnected'} items={[
            { label: 'Phone Number ID', envVar: 'WHATSAPP_PHONE_NUMBER_ID', configured: is('WHATSAPP_PHONE_NUMBER_ID') },
            { label: 'Access Token', envVar: 'WHATSAPP_ACCESS_TOKEN', configured: is('WHATSAPP_ACCESS_TOKEN') },
            { label: 'Verify Token', envVar: 'WHATSAPP_VERIFY_TOKEN', configured: is('WHATSAPP_VERIFY_TOKEN') },
          ]} />
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#0d1117] border border-[#30363d]">
            <div><h4 className="text-sm font-medium text-gray-200">تفعيل إرسال واتساب</h4><p className="text-[11px] text-gray-500 mt-0.5">تشغيل أو إيقاف إرسال الرسائل عبر واتساب</p></div>
            <Toggle value={apiConfig.whatsapp.enabled} onToggle={v => updateField('whatsapp', 'enabled', v)} />
          </div>
          <button onClick={() => handleTest('whatsapp')} disabled={testing === 'whatsapp'} className="rounded-lg border border-emerald-500/30 text-emerald-400 px-4 py-2.5 text-sm font-medium hover:bg-emerald-500/10 transition disabled:opacity-50">
            {testing === 'whatsapp' ? 'جارٍ الاختبار...' : 'اختبار الاتصال'}
          </button>
        </Section>

        {/* Email / Resend */}
        <Section title="البريد الإلكتروني (Resend)" icon="📧" status={is('RESEND') ? 'connected' : 'disconnected'}>
          <StatusCard label="البريد" status={is('RESEND') ? 'connected' : 'disconnected'} items={[
            { label: 'API Key', envVar: 'RESEND_API_KEY', configured: is('RESEND_API_KEY') },
            { label: 'البريد المرسل', envVar: 'RESEND_FROM_EMAIL', configured: is('RESEND_FROM_EMAIL') },
          ]} />
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#0d1117] border border-[#30363d]">
            <div><h4 className="text-sm font-medium text-gray-200">تفعيل إرسال البريد</h4><p className="text-[11px] text-gray-500 mt-0.5">تشغيل أو إيقاف الرسائل بالبريد الإلكتروني</p></div>
            <Toggle value={apiConfig.email.enabled} onToggle={v => updateField('email', 'enabled', v)} />
          </div>
          <button onClick={() => handleTest('email')} disabled={testing === 'email'} className="rounded-lg border border-emerald-500/30 text-emerald-400 px-4 py-2.5 text-sm font-medium hover:bg-emerald-500/10 transition disabled:opacity-50">
            {testing === 'email' ? 'جارٍ الاختبار...' : 'اختبار الاتصال'}
          </button>
        </Section>

        {/* Cloudinary */}
        <Section title="Cloudinary (الفيديوهات والصور)" icon="☁️" status={is('CLOUDINARY') ? 'connected' : 'disconnected'}>
          <StatusCard label="Cloudinary" status={is('CLOUDINARY') ? 'connected' : 'disconnected'} items={[
            { label: 'Cloud Name', envVar: 'CLOUDINARY_CLOUD_NAME', configured: is('CLOUDINARY_CLOUD_NAME') },
            { label: 'API Key', envVar: 'CLOUDINARY_API_KEY', configured: is('CLOUDINARY_API_KEY') },
            { label: 'API Secret', envVar: 'CLOUDINARY_API_SECRET', configured: is('CLOUDINARY_API_SECRET') },
          ]} />
          <button onClick={() => handleTest('cloudinary')} disabled={testing === 'cloudinary'} className="rounded-lg border border-emerald-500/30 text-emerald-400 px-4 py-2.5 text-sm font-medium hover:bg-emerald-500/10 transition disabled:opacity-50">
            {testing === 'cloudinary' ? 'جارٍ الاختبار...' : 'اختبار الاتصال'}
          </button>
        </Section>

        {/* Firebase */}
        <Section title="Firebase" icon="🔥" status={is('FIREBASE') ? 'connected' : 'disconnected'}>
          <StatusCard label="Firebase" status={is('FIREBASE') ? 'connected' : 'disconnected'} items={[
            { label: 'API Key', envVar: 'FIREBASE_API_KEY', configured: is('FIREBASE_API_KEY') },
            { label: 'Auth Domain', envVar: 'FIREBASE_AUTH_DOMAIN', configured: is('FIREBASE_AUTH_DOMAIN') },
            { label: 'Project ID', envVar: 'FIREBASE_PROJECT_ID', configured: is('FIREBASE_PROJECT_ID') },
          ]} />
        </Section>

        {/* AI */}
        <Section title="الذكاء الاصطناعي" icon="🤖" status={is('AI') ? 'connected' : 'disconnected'}>
          <StatusCard label="AI" status={is('AI') ? 'connected' : 'disconnected'} items={[
            { label: 'OpenAI API Key', envVar: 'OPENAI_API_KEY', configured: is('OPENAI_API_KEY') },
            { label: 'Gemini API Key', envVar: 'GEMINI_API_KEY', configured: is('GEMINI_API_KEY') },
          ]} />
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#0d1117] border border-[#30363d]">
            <div><h4 className="text-sm font-medium text-gray-200">تفعيل الروبوت</h4><p className="text-[11px] text-gray-500 mt-0.5">تشغيل أو إيقاف الردود التلقائية</p></div>
            <Toggle value={apiConfig.robot.enabled} onToggle={v => updateField('robot', 'enabled', v)} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#0d1117] border border-[#30363d]">
            <div><h4 className="text-sm font-medium text-gray-200">الرد على الموعد</h4></div>
            <Toggle value={apiConfig.robot.replyDate} onToggle={v => updateField('robot', 'replyDate', v)} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#0d1117] border border-[#30363d]">
            <div><h4 className="text-sm font-medium text-gray-200">مساعدة التأكيد</h4></div>
            <Toggle value={apiConfig.robot.helpConfirm} onToggle={v => updateField('robot', 'helpConfirm', v)} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#0d1117] border border-[#30363d]">
            <div><h4 className="text-sm font-medium text-gray-200">تحويل للموظف</h4></div>
            <Toggle value={apiConfig.robot.transferToStaff} onToggle={v => updateField('robot', 'transferToStaff', v)} />
          </div>
          <div><label className={labelCls}>رسالة التحويل</label>
            <textarea value={apiConfig.robot.transferMessage} onChange={e => updateField('robot', 'transferMessage', e.target.value)} rows={2} className={'w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-amber-500 transition'} /></div>
        </Section>

        {/* الموقع */}
        <Section title="الموقع والمزامنة" icon="🌐" defaultOpen>
          <div><label className={labelCls}>رابط الموقع</label>
            <input value={apiConfig.site.siteUrl} onChange={e => updateField('site', 'siteUrl', e.target.value)} className={'w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-amber-500 transition'} dir="ltr" /></div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#0d1117] border border-[#30363d]">
            <div><h4 className="text-sm font-medium text-gray-200">المزامنة التلقائية</h4></div>
            <Toggle value={apiConfig.site.autoSync} onToggle={v => updateField('site', 'autoSync', v)} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#0d1117] border border-[#30363d]">
            <div><h4 className="text-sm font-medium text-gray-200">Realtime Updates</h4></div>
            <Toggle value={apiConfig.site.realtime} onToggle={v => updateField('site', 'realtime', v)} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#0d1117] border border-[#30363d]">
            <div><h4 className="text-sm font-medium text-gray-200">API العامة</h4></div>
            <Toggle value={apiConfig.site.publicApi} onToggle={v => updateField('site', 'publicApi', v)} />
          </div>
        </Section>
      </>}

      {activeTab === 'general' && <>
        <Section title="إعدادات الإرسال" icon="📨" defaultOpen>
          <div><label className={labelCls}>الحد الأقصى للإرسال الجماعي (رسالة/دقيقة)</label>
            <input type="number" value={apiConfig.sendRate} onChange={e => updateTop('sendRate', Number(e.target.value))} min={1} max={100} className={'w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-amber-500 transition'} style={{ maxWidth: 200 }} /></div>
        </Section>

        <Section title="التقارير" icon="📊">
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#0d1117] border border-[#30363d]">
            <div><h4 className="text-sm font-medium text-gray-200">التقارير اليومية</h4><p className="text-[11px] text-gray-500 mt-0.5">إرسال تقرير تلقائي كل يوم عبر Resend</p></div>
            <Toggle value={apiConfig.dailyReport} onToggle={v => updateTop('dailyReport', v)} />
          </div>
          <div><label className={labelCls}>وقت الإرسال</label>
            <input type="time" value={apiConfig.reportTime} onChange={e => updateTop('reportTime', e.target.value)} className={'w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-amber-500 transition'} style={{ maxWidth: 200 }} dir="ltr" /></div>
          <div><label className={labelCls}>بريد استقبال التقارير</label>
            <p className="text-[10px] text-gray-600">DAILY_REPORT_EMAIL في ملف .env</p>
            <input type="email" value={apiConfig.reportEmail} onChange={e => updateTop('reportEmail', e.target.value)} className={'w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-amber-500 transition'} dir="ltr" placeholder="admin@example.com" /></div>
        </Section>

        <Section title="الأرشفة والنسخ الاحتياطي" icon="📦">
          <div><label className={labelCls}>مدة الأرشفة التلقائية (يوم)</label>
            <div className="flex items-center gap-2">
              <input type="number" value={apiConfig.archiveDays} onChange={e => updateTop('archiveDays', Number(e.target.value))} min={1} max={365} className={'w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-amber-500 transition'} style={{ maxWidth: 100 }} />
              <span className="text-xs text-gray-500">يوم بعد انتهاء المناسبة</span>
            </div></div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#0d1117] border border-[#30363d]">
            <div><h4 className="text-sm font-medium text-gray-200">أرشفة تلقائية</h4></div>
            <Toggle value={apiConfig.autoArchive} onToggle={v => updateTop('autoArchive', v)} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#0d1117] border border-[#30363d]">
            <div><h4 className="text-sm font-medium text-gray-200">نسخ احتياطي يومي</h4></div>
            <Toggle value={apiConfig.autoBackup} onToggle={v => updateTop('autoBackup', v)} />
          </div>
          <div><label className={labelCls}>وقت النسخ الاحتياطي</label>
            <input type="time" value={apiConfig.backupTime} onChange={e => updateTop('backupTime', e.target.value)} className={'w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-amber-500 transition'} style={{ maxWidth: 200 }} dir="ltr" /></div>
        </Section>

        <Section title="تسجيل الحضور (Check-in)" icon="✅">
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#0d1117] border border-[#30363d]">
            <div><h4 className="text-sm font-medium text-gray-200">منع تكرار QR</h4><p className="text-[11px] text-gray-500 mt-0.5">منع تسجيل نفس QR أكثر من مرة</p></div>
            <Toggle value={apiConfig.checkin.preventDuplicateQR} onToggle={v => updateField('checkin', 'preventDuplicateQR', v)} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#0d1117] border border-[#30363d]">
            <div><h4 className="text-sm font-medium text-gray-200">تسجيل الوقت</h4></div>
            <Toggle value={apiConfig.checkin.logTime} onToggle={v => updateField('checkin', 'logTime', v)} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#0d1117] border border-[#30363d]">
            <div><h4 className="text-sm font-medium text-gray-200">تسجيل المشغل</h4></div>
            <Toggle value={apiConfig.checkin.logOperator} onToggle={v => updateField('checkin', 'logOperator', v)} />
          </div>
        </Section>

        <Section title="إعدادات QR" icon="📱">
          <div><label className={labelCls}>لون QR الأساسي</label>
            <div className="flex gap-3 items-center">
              <button
                onClick={() => updateTop('defaultQrColor', '#000000')}
                className={'w-10 h-10 rounded-lg border-2 transition ' + (apiConfig.defaultQrColor !== '#D4AF37' ? 'border-amber-500 ring-2 ring-amber-400' : 'border-[#30363d]')}
                style={{ background: '#000000' }}
              />
              <button
                onClick={() => updateTop('defaultQrColor', '#D4AF37')}
                className={'w-10 h-10 rounded-lg border-2 transition ' + (apiConfig.defaultQrColor === '#D4AF37' ? 'border-amber-500 ring-2 ring-amber-400' : 'border-[#30363d]')}
                style={{ background: '#D4AF37' }}
              />
            </div>
            <p className="text-[10px] text-gray-500 mt-1">الأسود هو اللون الافتراضي — الذهبي للمناسبات الفاخرة</p>
          </div>
        </Section>
      </>}

      {activeTab === 'roles' && <>
        <Section title="الصلاحيات والأدوار" icon="🔑" defaultOpen>
          <p className="text-xs text-gray-500 mb-3">الأدوار تُطبق فعلياً على جميع نقاط API — كل مستخدم يرى فقط الصفحات المسموحة له</p>
          <div className="space-y-3">
            {[
              { role: 'admin', desc: 'وصول كامل لجميع الأقسام والإعدادات والاستيراد والتقارير والمستخدمين', color: 'text-amber-400', pages: 'كل الصفحات' },
              { role: 'staff', desc: 'إضافة/تعديل/حذف الضيوف + رفع القوائم + الإرسال + التقارير + الدعوات', color: 'text-blue-400', pages: 'لوحة التحكم، الضيوف، الحضور، QR، الإرسال، القوالب، الجدولة، التقارير، الدعوات' },
              { role: 'checkin', desc: 'تسجيل الحضور فقط — صفحة Check-in بالكامل', color: 'text-green-400', pages: 'تسجيل الحضور فقط' },
              { role: 'sender', desc: 'مركز الإرسال + القوالب + سجل الإرسال + الإحصائيات', color: 'text-purple-400', pages: 'مركز الإرسال، القوالب، سجل الإرسال، الإحصائيات' },
            ].map(r => (
              <div key={r.role} className="flex items-center justify-between p-4 rounded-lg bg-[#0d1117] border border-[#30363d]">
                <div className="flex-1">
                  <h4 className={'text-sm font-semibold ' + r.color}>{r.role === 'admin' ? 'مدير' : r.role === 'staff' ? 'موظف إدارة' : r.role === 'checkin' ? 'موظف حضور' : 'موظف إرسال'}</h4>
                  <p className="text-[11px] text-gray-500 mt-1">{r.desc}</p>
                  <p className="text-[10px] text-gray-600 mt-1">الصفحات: {r.pages}</p>
                </div>
                <span className={'text-[10px] px-2 py-0.5 rounded-full ' + r.color + ' bg-[#161b22]'}>{r.role}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Account Settings */}
        {user && <Section title="حسابي" icon="👤" defaultOpen>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-[#0d1117] border border-[#30363d]">
              <div>
                <p className="text-sm font-medium text-gray-200">{user.name}</p>
                <p className="text-[10px] text-gray-500">{user.email} — {user.role}</p>
              </div>
            </div>
            <ChangePasswordSection />
            <LogoutAllSection />
          </div>
        </Section>}
      </>}
    </div>
  )
}

function ChangePasswordSection() {
  const { show } = useToast()
  const [current, setCurrent] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  const handleChange = async () => {
    if (!current || !newPass || !confirm) { show('جميع الحقول مطلوبة', 'error'); return }
    if (newPass !== confirm) { show('كلمة المرور الجديدة غير متطابقة', 'error'); return }
    if (newPass.length < 6) { show('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error'); return }
    setSaving(true)
    try {
      const r = await api.changePassword(current, newPass)
      if (r.token) {
        // Update stored token
        const state = await import('@/lib/store').then(m => m.useAppStore.getState())
        if (state) state.setToken(r.token)
      }
      show(r.message || 'تم تغيير كلمة المرور', 'success')
      setCurrent(''); setNewPass(''); setConfirm('')
    } catch { show('فشل تغيير كلمة المرور', 'error') }
    setSaving(false)
  }

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-200">تغيير كلمة المرور</h4>
      <input type="password" value={current} onChange={e => setCurrent(e.target.value)} placeholder="كلمة المرور الحالية" className={'w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-gray-200 outline-none focus:border-amber-500 transition'} />
      <div className="grid grid-cols-2 gap-3">
        <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="الجديدة" className={'w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-gray-200 outline-none focus:border-amber-500 transition'} />
        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="تأكيد الجديدة" className={'w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-gray-200 outline-none focus:border-amber-500 transition'} />
      </div>
      <button onClick={handleChange} disabled={saving} className="rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 px-4 py-2 text-sm font-medium hover:bg-amber-500/20 transition disabled:opacity-50">
        {saving ? 'جارٍ التغيير...' : 'تغيير كلمة المرور'}
      </button>
    </div>
  )
}

function LogoutAllSection() {
  const { show } = useToast()
  const [loading, setLoading] = useState(false)

  const handleLogoutAll = async () => {
    if (!confirm('هل أنت متأكد من تسجيل الخروج من جميع الأجهزة؟')) return
    setLoading(true)
    try {
      await api.logoutAll()
      show('تم تسجيل الخروج من جميع الأجهزة — يرجى تسجيل الدخول مجدداً', 'info')
      // Clear local state
      const state = await import('@/lib/store').then(m => m.useAppStore.getState())
      if (state) { state.setLoggedIn(false); state.setUser(null); state.setToken(null) }
    } catch { show('فشل العملية', 'error') }
    setLoading(false)
  }

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/5 border border-red-500/20">
      <div><h4 className="text-sm font-medium text-red-400">تسجيل الخروج من جميع الأجهزة</h4><p className="text-[10px] text-gray-500 mt-0.5">سيتم إلغاء جميع الجلسات النشطة</p></div>
      <button onClick={handleLogoutAll} disabled={loading} className="rounded-lg bg-red-500/15 text-red-400 border border-red-500/30 px-4 py-2 text-sm font-medium hover:bg-red-500/25 transition disabled:opacity-50">
        {loading ? 'جارٍ...' : 'تسجيل الخروج'}
      </button>
    </div>
  )
}
