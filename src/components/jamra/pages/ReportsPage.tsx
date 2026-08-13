'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, useAppStore, escapeHtml } from '@/lib/store';

function useToast() {
  const [toasts, setToasts] = useState<any[]>([]);
  const show = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3000);
  }, []);
  const ToastContainer = toasts.length > 0 ? (
    <div className="fixed bottom-6 left-6 z-[9999] flex flex-col gap-2">
      {toasts.map((t: any) => (
        <div key={t.id} className={`px-5 py-3 rounded-lg text-sm font-medium shadow-lg backdrop-blur ${t.type === 'success' ? 'bg-emerald-500/90 text-white' : t.type === 'error' ? 'bg-red-500/90 text-white' : 'bg-amber-500/90 text-white'}`}>{t.message}</div>
      ))}
    </div>
  ) : null;
  return { show, ToastContainer };
}

export default function ReportsPage() {
  const { events, guests, checkins, sendLogs, setData, apiConfig } = useAppStore();
  const { show, ToastContainer } = useToast();
  const [sendingManualReport, setSendingManualReport] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'events'>('overview');

  useEffect(() => {
    api.getEvents().then((r: any) => setData('events', r.data || r));
    api.getGuests().then((r: any) => setData('guests', r.data || r));
    api.getCheckins().then((r: any) => setData('checkins', r.data || r));
    api.getSendLogs().then((r: any) => setData('sendLogs', r.data || r));
  }, [setData]);

  const totalGuests = guests.length;
  const confirmedGuests = guests.filter((g: any) => g.confirmed === 'confirmed').length;
  const attendedGuests = guests.filter((g: any) => g.attended === 'attended').length;
  const sentCount = sendLogs.filter((s: any) => s.status === 'sent').length;
  const failedCount = sendLogs.filter((s: any) => s.status === 'failed').length;
  const activeEvents = events.filter((e: any) => e.status === 'active' || e.status === 'preparing').length;

  const statCards = [
    { label: 'إجمالي الضيوف', value: totalGuests, icon: '👥', color: 'from-amber-600/20 to-amber-800/5' },
    { label: 'المؤكدون', value: confirmedGuests, icon: '✅', color: 'from-emerald-600/20 to-emerald-800/5' },
    { label: 'الحاضرون', value: attendedGuests, icon: '📋', color: 'from-sky-600/20 to-sky-800/5' },
    { label: 'رسائل مرسلة', value: sentCount, icon: '📨', color: 'from-purple-600/20 to-purple-800/5' },
    { label: 'رسائل فاشلة', value: failedCount, icon: '❌', color: 'from-red-600/20 to-red-800/5' },
    { label: 'مناسبات نشطة', value: activeEvents, icon: '🎪', color: 'from-teal-600/20 to-teal-800/5' },
  ];

  const handleSendManualReport = async () => {
    setSendingManualReport(true);
    try {
      const res = await fetch('/api/reports/daily', { method: 'POST', headers: { 'Authorization': 'Bearer ' + (useAppStore.getState().token || '') } });
      const r = await res.json();
      if (r.sent) { show('تم إرسال التقرير بنجاح إلى ' + r.to, 'success'); }
      else { show(r.error || 'فشل إرسال التقرير', 'error'); }
    } catch { show('خطأ في الاتصال', 'error'); }
    setSendingManualReport(false);
  };

  // Compute per-event stats
  const eventStats = events.map((ev: any) => {
    const evGuests = guests.filter((g: any) => g.eventId === ev.id);
    const evCheckins = checkins.filter((c: any) => c.eventId === ev.id);
    const evSent = sendLogs.filter((s: any) => s.eventId === ev.id && s.status === 'sent');
    const evFailed = sendLogs.filter((s: any) => s.eventId === ev.id && s.status === 'failed');
    return {
      ...ev,
      totalGuests: evGuests.length,
      confirmed: evGuests.filter((g: any) => g.confirmed === 'confirmed').length,
      attended: evCheckins.length,
      sent: evSent.length,
      failed: evFailed.length,
    };
  });

  return (
    <div dir="rtl" className="space-y-6">
      {ToastContainer}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-100">التقارير</h1>
        <button onClick={handleSendManualReport} disabled={sendingManualReport}
          className="flex items-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black text-sm font-bold transition px-4 py-2.5">
          {sendingManualReport ? 'جارٍ الإرسال...' : '📧 إرسال تقرير الآن'}
        </button>
      </div>

      {/* Cron setup notice */}
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-gray-400">
        <span className="text-amber-400 font-semibold">التقارير اليومية:</span>
        {apiConfig?.dailyReport ? (
          <span> مُفعّلة الساعة {apiConfig.reportTime} — يجب إعداد كرون: </span>
        ) : (
          <span> معطلة — فعّلها من الإعدادات ثم أعد كرون: </span>
        )}
        <span className="font-mono text-amber-400" dir="ltr">POST /api/reports/daily</span>
        <span> يومياً على الساعة المحددة. ضع بريد الاستقبال في DAILY_REPORT_EMAIL بملف .env</span>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className={`rounded-xl border border-[#30363d] bg-gradient-to-br ${s.color} bg-[#161b22] p-4`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl">{s.icon}</span>
              <span className="text-2xl font-bold text-gray-100">{s.value}</span>
            </div>
            <p className="text-xs text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg bg-[#161b22] border border-[#30363d] w-fit">
        <button onClick={() => setActiveTab('overview')} className={'px-4 py-2 rounded-md text-sm font-medium transition ' + (activeTab === 'overview' ? 'bg-amber-500 text-[#0d1117]' : 'text-gray-400 hover:text-gray-200')}>نظرة عامة</button>
        <button onClick={() => setActiveTab('events')} className={'px-4 py-2 rounded-md text-sm font-medium transition ' + (activeTab === 'events' ? 'bg-amber-500 text-[#0d1117]' : 'text-gray-400 hover:text-gray-200')}>حسب المناسبة</button>
      </div>

      {activeTab === 'events' && (
        <div className="rounded-xl border border-[#30363d] bg-[#161b22] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-[#1c2333] text-gray-400 text-right">
                <th className="px-4 py-3 font-medium">المناسبة</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium">التاريخ</th>
                <th className="px-4 py-3 font-medium">الضيوف</th>
                <th className="px-4 py-3 font-medium">المؤكدون</th>
                <th className="px-4 py-3 font-medium">الحاضرون</th>
                <th className="px-4 py-3 font-medium">مرسلة</th>
                <th className="px-4 py-3 font-medium">فاشلة</th>
              </tr></thead>
              <tbody className="divide-y divide-[#30363d]">
                {eventStats.map((r) => {
                  const statusCls = r.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : r.status === 'ended' ? 'bg-gray-500/20 text-gray-400' : 'bg-amber-500/20 text-amber-400';
                  const statusLabel = r.status === 'active' ? 'نشطة' : r.status === 'ended' ? 'منتهية' : r.status === 'archived' ? 'مؤرشفة' : 'تحضير';
                  return (
                    <tr key={r.id} className="hover:bg-[#1c2333]/50">
                      <td className="px-4 py-3 text-gray-200 font-medium">{escapeHtml(r.name)}</td>
                      <td className="px-4 py-3"><span className={'rounded-full px-2.5 py-1 text-xs font-semibold ' + statusCls}>{statusLabel}</span></td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{r.date}</td>
                      <td className="px-4 py-3 text-gray-300">{r.totalGuests}</td>
                      <td className="px-4 py-3 text-gray-300">{r.confirmed}</td>
                      <td className="px-4 py-3 text-gray-300">{r.attended}</td>
                      <td className="px-4 py-3 text-emerald-400">{r.sent}</td>
                      <td className="px-4 py-3 text-red-400">{r.failed}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
