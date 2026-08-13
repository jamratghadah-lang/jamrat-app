'use client';

import { useEffect, useState } from 'react';
import { api, useAppStore } from '@/lib/store';

const statsConfig = [
  { key: 'totalEvents', label: 'إجمالي المناسبات', icon: '📅', color: 'from-amber-600/20 to-amber-800/5' },
  { key: 'activeEvents', label: 'المناسبات النشطة', icon: '✨', color: 'from-emerald-600/20 to-emerald-800/5' },
  { key: 'totalGuests', label: 'إجمالي الضيوف', icon: '👥', color: 'from-sky-600/20 to-sky-800/5' },
  { key: 'confirmedGuests', label: 'الضيوف المؤكدين', icon: '✅', color: 'from-green-600/20 to-green-800/5' },
  { key: 'attendedGuests', label: 'الحاضرون', icon: '🎉', color: 'from-purple-600/20 to-purple-800/5' },
  { key: 'unconfirmedGuests', label: 'غير المؤكدين', icon: '⏳', color: 'from-orange-600/20 to-orange-800/5' },
  { key: 'absentGuests', label: 'الغائبون', icon: '❌', color: 'from-red-600/20 to-red-800/5' },
  { key: 'totalCompanions', label: 'إجمالي المرافقين', icon: '🤝', color: 'from-teal-600/20 to-teal-800/5' },
];

// Pull REAL rates from /api/stats. No hardcoded values.
function buildProgressBars(s: any) {
  return [
    { label: 'نسبة التأكيد', value: s.confirmationRate ?? 0, color: 'bg-amber-500', detail: `${s.confirmedGuests ?? 0} من ${s.totalGuests ?? 0}` },
    { label: 'نسبة الحضور', value: s.attendanceRate ?? 0, color: 'bg-emerald-500', detail: `${s.attendedGuests ?? 0} من ${s.totalGuests ?? 0}` },
    { label: 'نسبة استخدام QR', value: s.qrUsageRate ?? 0, color: 'bg-sky-500', detail: `${s.qrGenerated ?? 0} من ${s.totalGuests ?? 0}` },
    {
      label: 'نجاح WhatsApp',
      value: s.whatsappSuccessRate ?? 0,
      color: 'bg-green-500',
      detail: `${s.whatsappSent ?? 0} ناجح / ${s.whatsappFailed ?? 0} فشل`
    },
    {
      label: 'نجاح Email',
      value: s.emailSuccessRate ?? 0,
      color: 'bg-purple-500',
      detail: `${s.emailSent ?? 0} ناجح / ${s.emailFailed ?? 0} فشل`
    },
  ];
}

export default function StatisticsPage() {
  const { stats, setData } = useAppStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.getStats()
      .then((r: any) => { if (!cancelled) setData('stats', r.data || r); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [setData]);

  const progressBars = buildProgressBars(stats as any);

  return (
    <div dir="rtl" className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-100">الإحصائيات</h1>
        <span className="text-[11px] text-gray-500">
          {loading ? 'جارٍ التحديث...' : 'محدّث من قاعدة البيانات'}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statsConfig.map((s) => (
          <div key={s.key} className={`rounded-xl border border-[#30363d] bg-gradient-to-br ${s.color} bg-[#161b22] p-5`}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{s.icon}</span>
              <span className="text-3xl font-bold text-gray-100">
                {loading ? '...' : ((stats as any)[s.key] ?? 0)}
              </span>
            </div>
            <p className="text-sm text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-6 space-y-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-100">النسب المئوية</h2>
          <span className="text-[11px] text-gray-500">محسوبة من البيانات الحقيقية</span>
        </div>
        {progressBars.map((p) => (
          <div key={p.label} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-300">{p.label}</span>
              <div className="flex items-center gap-3">
                <span className="text-gray-500 text-[11px]">{p.detail}</span>
                <span className="text-gray-100 font-semibold">{p.value}%</span>
              </div>
            </div>
            <div className="h-3 rounded-full bg-[#0d1117] overflow-hidden">
              <div
                className={`h-full rounded-full ${p.color} transition-all duration-700`}
                style={{ width: `${Math.min(100, Math.max(0, p.value))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
