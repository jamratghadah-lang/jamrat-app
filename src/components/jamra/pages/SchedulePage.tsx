'use client'

import { useState, useEffect, useCallback } from 'react'
import { api, useAppStore, escapeHtml } from '@/lib/store'

const inputCls = 'w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-amber-500 transition'

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

interface ScheduleItem {
  id: string
  eventName: string
  recipientType: string
  channel: string
  content: { text?: string }
  guestIds: string[]
  scheduledAt: string
  status: string
  templateId: string | null
  executedAt: string | null
  result: string
  createdAt: string
}

const statusConfig: Record<string, { label: string; cls: string }> = {
  pending: { label: 'مجدول', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  sent: { label: 'تم الإرسال', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  failed: { label: 'فشل', cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
  cancelled: { label: 'ملغى', cls: 'bg-gray-500/15 text-gray-400 border-gray-500/30' },
}

const typeConfig: Record<string, { label: string; cls: string; icon: string }> = {
  whatsapp: { label: 'واتساب', cls: 'bg-emerald-500/10 text-emerald-400', icon: '💬' },
  email: { label: 'بريد', cls: 'bg-purple-500/10 text-purple-400', icon: '📧' },
  both: { label: 'كلاهما', cls: 'bg-amber-500/10 text-amber-400', icon: '📨' },
}

export default function SchedulePage() {
  const { events, templates, setData } = useAppStore()
  const { show, ToastContainer } = useToast()
  const [schedules, setSchedules] = useState<ScheduleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    eventId: '', recipientType: 'all', channel: 'whatsapp',
    templateId: '', message: '', scheduleDate: '', scheduleTime: '',
  })

  const fetchSchedules = useCallback(async () => {
    try {
      const r: any = await api.getSchedules('status=all')
      setSchedules(Array.isArray(r) ? r : r.data || [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    api.getEvents().then((r: any) => setData('events', r.data || r))
    api.getTemplates().then((r: any) => setData('templates', r.data || r))
    fetchSchedules()
  }, [setData, fetchSchedules])

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleTemplateSelect = (tid: string) => {
    set('templateId', tid)
    if (!tid) return
    const tpl = templates.find((t: any) => t.id === tid)
    if (tpl) setForm(p => ({ ...p, message: tpl.text, templateId: tid }))
  }

  const handleSubmit = async () => {
    if (!form.eventId || !form.scheduleDate || !form.scheduleTime) {
      show('يرجى ملء المناسبة والتاريخ والوقت', 'error'); return
    }
    setSubmitting(true)
    try {
      const scheduleAt = form.scheduleDate + 'T' + form.scheduleTime + ':00'
      await api.createSchedule({
        eventId: form.eventId,
        recipientType: form.recipientType,
        channel: form.channel,
        content: { text: form.message },
        templateId: form.templateId || undefined,
        scheduleAt,
      })
      show('تم إنشاء الجدولة بنجاح', 'success')
      setShowForm(false)
      setForm({ eventId: '', recipientType: 'all', channel: 'whatsapp', templateId: '', message: '', scheduleDate: '', scheduleTime: '' })
      fetchSchedules()
    } catch { show('فشل إنشاء الجدولة', 'error') }
    setSubmitting(false)
  }

  const handleCancel = async (id: string) => {
    try {
      await api.cancelSchedule(id)
      show('تم إلغاء الجدولة', 'success')
      fetchSchedules()
    } catch { show('فشل الإلغاء', 'error') }
  }

  const formatDateTime = (dt: string) => {
    if (!dt) return '—'
    try {
      const d = new Date(dt)
      return d.toLocaleString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    } catch { return dt }
  }

  const recipientLabel: Record<string, string> = {
    all: 'الكل', confirmed: 'المؤكدون', unconfirmed: 'غير المؤكدين', attended: 'الحاضرون', absent: 'الغائبون', manual: 'مخصص',
  }

  return (
    <div className="space-y-6">
      {ToastContainer}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">جدولة الإرسال</h1>
          <p className="text-sm text-gray-500 mt-1">جدولة إرسال الرسائل لأوقات محددة — يتم التنفيذ تلقائياً عبر كرون</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="text-xs px-4 py-2.5 rounded-lg bg-gradient-to-l from-amber-500 to-amber-600 text-[#0d1117] font-bold hover:from-amber-400 hover:to-amber-500 transition flex items-center gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14m-7-7h14"/></svg>
          جدولة جديدة
        </button>
      </div>

      {/* Cron notice */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-gray-400">
        <span className="text-amber-400 font-semibold">ملاحظة:</span> يجب إعداد كرون لاستدعاء <span className="font-mono text-amber-400" dir="ltr">POST /api/scheduler/run</span> كل دقيقة لتنفيذ الرسائل المجدولة. مثال: <span className="font-mono" dir="ltr">* * * * * curl -X POST https://your-domain/api/scheduler/run</span>
      </div>

      {showForm && (
        <div className="bg-[#161b22] border border-amber-500/30 rounded-xl p-5 space-y-4">
          <h3 className="font-bold text-sm text-amber-400">إنشاء جدولة جديدة</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><label className="block text-[11px] font-semibold text-gray-400 mb-1.5">المناسبة</label>
              <select value={form.eventId} onChange={e => set('eventId', e.target.value)} className={inputCls}>
                <option value="">اختر...</option>
                {events.map((e: any) => <option key={e.id} value={e.id}>{escapeHtml(e.name)}</option>)}
              </select></div>
            <div><label className="block text-[11px] font-semibold text-gray-400 mb-1.5">القالب</label>
              <select value={form.templateId} onChange={e => handleTemplateSelect(e.target.value)} className={inputCls}>
                <option value="">بدون قالب</option>
                {templates.map((t: any) => <option key={t.id} value={t.id}>{escapeHtml(t.name)}</option>)}
              </select></div>
            <div><label className="block text-[11px] font-semibold text-gray-400 mb-1.5">نوع الإرسال</label>
              <select value={form.channel} onChange={e => set('channel', e.target.value)} className={inputCls}>
                <option value="whatsapp">واتساب</option>
                <option value="email">بريد إلكتروني</option>
                <option value="both">كلاهما</option>
              </select></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><label className="block text-[11px] font-semibold text-gray-400 mb-1.5">المستلمون</label>
              <select value={form.recipientType} onChange={e => set('recipientType', e.target.value)} className={inputCls}>
                <option value="all">الكل</option>
                <option value="confirmed">المؤكدون فقط</option>
                <option value="unconfirmed">غير المؤكدين</option>
              </select></div>
            <div><label className="block text-[11px] font-semibold text-gray-400 mb-1.5">التاريخ</label>
              <input type="date" value={form.scheduleDate} onChange={e => set('scheduleDate', e.target.value)} className={inputCls} dir="ltr" /></div>
            <div><label className="block text-[11px] font-semibold text-gray-400 mb-1.5">الوقت</label>
              <input type="time" value={form.scheduleTime} onChange={e => set('scheduleTime', e.target.value)} className={inputCls} dir="ltr" /></div>
          </div>
          {!form.templateId && (
            <div><label className="block text-[11px] font-semibold text-gray-400 mb-1.5">الرسالة</label>
              <textarea value={form.message} onChange={e => set('message', e.target.value)} rows={3} className={inputCls + ' resize-none'} placeholder="اكتب الرسالة أو اختر قالب..." /></div>
          )}
          <div className="flex gap-2 pt-2">
            <button onClick={handleSubmit} disabled={submitting} className="text-xs px-5 py-2.5 rounded-lg bg-gradient-to-l from-amber-500 to-amber-600 text-[#0d1117] font-bold hover:from-amber-400 hover:to-amber-500 transition disabled:opacity-50">
              {submitting ? 'جارٍ...' : 'جدولة'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-xs px-4 py-2.5 rounded-lg border border-[#30363d] text-gray-400 hover:text-gray-200 transition">إلغاء</button>
          </div>
        </div>
      )}

      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#30363d] text-gray-500 text-xs">
                <th className="text-right p-3 font-medium">المناسبة</th>
                <th className="text-right p-3 font-medium">النوع</th>
                <th className="text-right p-3 font-medium">المستلمون</th>
                <th className="text-right p-3 font-medium">الوقت المجدول</th>
                <th className="text-right p-3 font-medium">التنفيذ</th>
                <th className="text-right p-3 font-medium">الحالة</th>
                <th className="text-right p-3 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-500">جارٍ التحميل...</td></tr>
              ) : schedules.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-500">لا توجد جدولات</td></tr>
              ) : schedules.map(s => {
                const st = statusConfig[s.status] || statusConfig.pending
                const tp = typeConfig[s.channel] || typeConfig.whatsapp
                return (
                  <tr key={s.id} className="border-b border-[#30363d]/50 hover:bg-[#1c2333]/50 transition">
                    <td className="p-3 font-medium text-sm">{escapeHtml(s.eventName)}</td>
                    <td className="p-3">
                      <span className={'text-[10px] px-2 py-0.5 rounded-full ' + tp.cls + ' flex items-center gap-1 w-fit'}>{tp.icon} {tp.label}</span>
                    </td>
                    <td className="p-3 text-xs">{recipientLabel[s.recipientType] || s.recipientType}</td>
                    <td className="p-3 text-xs text-gray-400" dir="ltr">{formatDateTime(s.scheduledAt)}</td>
                    <td className="p-3 text-xs text-gray-500" dir="ltr">{s.executedAt ? formatDateTime(s.executedAt) : '—'}</td>
                    <td className="p-3"><span className={'text-[10px] px-2 py-0.5 rounded-full border ' + st.cls}>{st.label}</span></td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {s.status === 'pending' && (
                          <button onClick={() => handleCancel(s.id)} className="text-[10px] px-2 py-1 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition">إلغاء</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
