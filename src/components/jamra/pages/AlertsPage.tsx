'use client'

import { useState } from 'react'

interface AlertItem {
  id: string
  type: 'critical' | 'warning' | 'info'
  title: string
  desc: string
  time: string
  read: boolean
}

const sampleAlerts: AlertItem[] = [
  { id: '1', type: 'critical', title: 'انتهت صلاحية توكن الواتساب', desc: 'توكن الواتساب Business منتهي الصلاحية منذ 3 ساعات. لن يتم إرسال أي رسائل حتى تجدده.', time: 'منذ 3 ساعات', read: false },
  { id: '2', type: 'critical', title: 'فشل إرسال 12 رسالة', desc: 'فشل إرسال 12 رسالة واتساب بسبب مشكلة بالـ API. راجع سجل الإرسال.', time: 'منذ ساعة', read: false },
  { id: '3', type: 'warning', title: 'مساحة التخزين 85% ممتلئة', desc: 'مساحة Cloudinary وصلت لـ 85%. حذف الفيديوهات القديمة أو ترقية الباقة.', time: 'منذ ساعتين', read: false },
  { id: '4', type: 'warning', title: 'حصة Resend قاربت على الانتهاء', desc: 'متبقي 45 من 100 رسالة بريد لهذا الشهر.', time: 'منذ 5 ساعات', read: true },
  { id: '5', type: 'warning', title: 'ضيف مكرر في مناسبة زفاف غضى', desc: 'رقم الجوال 0551234567 مكرر مرتين. تحقق من القائمة.', time: 'منذ يوم', read: true },
  { id: '6', type: 'warning', title: 'مناسبة "حفل ليلى" لم يتم إرسال دعواتها', desc: 'المناسبة بعد 3 أيام ولم ترسل أي دعوة بعد.', time: 'منذ يوم', read: false },
  { id: '7', type: 'info', title: 'تم أرشفة مناسبة "حفل سارة" تلقائياً', desc: 'تم أرشفة المناسبة تلقائياً بعد مرور 30 يوم على تاريخها.', time: 'منذ يومين', read: true },
  { id: '8', type: 'info', title: 'نسخة احتياطية جديدة', desc: 'تم إنشاء نسخة احتياطية لقاعدة البيانات بنجاح.', time: 'منذ 3 أيام', read: true },
]

const typeConfig = {
  critical: { label: 'حرج', cls: 'bg-red-500/10 text-red-400 border-red-500/20', icon: '🔴' },
  warning: { label: 'تحذير', cls: 'bg-orange-500/10 text-orange-400 border-orange-500/20', icon: '🟡' },
  info: { label: 'معلومات', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: '🔵' },
}

export default function AlertsPage() {
  const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all')

  const filtered = filter === 'all' ? sampleAlerts : sampleAlerts.filter(a => a.type === filter)

  const counts = {
    all: sampleAlerts.length,
    critical: sampleAlerts.filter(a => a.type === 'critical').length,
    warning: sampleAlerts.filter(a => a.type === 'warning').length,
    info: sampleAlerts.filter(a => a.type === 'info').length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">التنبيهات</h1>
        <p className="text-sm text-gray-500 mt-1">جميع التنبيهات والمشاكل التي تحتاج انتباهك</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(['all', 'critical', 'warning', 'info'] as const).map(f => {
          const labels = { all: 'الكل', critical: 'حرجة', warning: 'تحذيرات', info: 'معلومات' }
          const isActive = filter === f
          return (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition font-medium ${
                isActive
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                  : 'border-[#30363d] text-gray-400 hover:text-gray-200 hover:border-gray-500'
              }`}>
              {labels[f]} ({counts[f]})
            </button>
          )
        })}
      </div>

      {/* Alert Cards */}
      <div className="space-y-3">
        {filtered.map(alert => {
          const cfg = typeConfig[alert.type]
          return (
            <div key={alert.id} className={`bg-[#161b22] border rounded-xl p-4 transition ${alert.read ? 'border-[#30363d] opacity-70' : 'border-[#30363d] hover:border-gray-500'}`}>
              <div className="flex items-start gap-3">
                <span className="text-lg mt-0.5">{cfg.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className={`text-sm font-bold ${!alert.read ? 'text-gray-100' : 'text-gray-400'}`}>{alert.title}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
                    {!alert.read && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{alert.desc}</p>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-[10px] text-gray-600">{alert.time}</span>
                    <div className="flex gap-2">
                      <span className="text-[10px] px-2.5 py-1 rounded-lg border border-[#30363d] text-gray-600">تفاصيل عبر سجل التنبيهات</span>
                      {alert.type === 'critical' && (
                        <span className="text-[10px] px-2.5 py-1 rounded-lg bg-gray-500/10 text-gray-600 border border-gray-500/20">إجراء يدوي</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-600">
          <p className="text-3xl mb-3">🔔</p>
          <p>لا توجد تنبيهات من هذا النوع</p>
        </div>
      )}
    </div>
  )
}
