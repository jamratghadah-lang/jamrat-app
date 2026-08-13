'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, useAppStore, type EventItem, type SendLogItem, type Stats } from '@/lib/store';

/* ------------------------------------------------------------------ */
/*  Inline SVG icons (lucide-style, stroke-based, 18×18)              */
/* ------------------------------------------------------------------ */

const IconCalendar = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
);

const IconClock = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
);

const IconUsers = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
);

const IconCheck = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
);

const IconX = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
);

const IconEye = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
);

const IconUserCheck = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><polyline points="16 11 18 13 22 9" /></svg>
);

const IconUserPlus = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
);

const IconSend = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
);

const IconWifi = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" /></svg>
);

const IconFlask = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6" /><path d="M10 9V3h4v6l5 8.5a2 2 0 0 1-1.7 3H6.7a2 2 0 0 1-1.7-3L10 9z" /></svg>
);

const IconPlay = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
);

const IconMoreVertical = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" /></svg>
);

const IconTrendingUp = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
);

/* ------------------------------------------------------------------ */
/*  Toast helper                                                      */
/* ------------------------------------------------------------------ */

function useToast() {
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: 'success' | 'error' | 'info' }>>([]);

  const show = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  }, []);

  const ToastContainer = toasts.length > 0 ? (
    <div className="fixed bottom-6 left-6 z-[9999] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`px-5 py-3 rounded-lg text-sm font-medium shadow-lg backdrop-blur transition-all
            ${t.type === 'success' ? 'bg-emerald-500/90 text-white' : ''}
            ${t.type === 'error' ? 'bg-red-500/90 text-white' : ''}
            ${t.type === 'info' ? 'bg-blue-500/90 text-white' : ''}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  ) : null;

  return { show, ToastContainer };
}

/* ------------------------------------------------------------------ */
/*  Status badge helpers                                              */
/* ------------------------------------------------------------------ */

function eventStatusBadge(status: any): React.ReactNode {
  const map: Record<string, { label: string; cls: string }> = {
    active:    { label: 'نشط',    cls: 'bg-green-500/15 text-green-400 border border-green-500/25' },
    preparing: { label: 'تحضير',  cls: 'bg-orange-500/15 text-orange-400 border border-orange-500/25' },
    ended:     { label: 'منتهي',   cls: 'bg-gray-500/15 text-gray-400 border border-gray-500/25' },
    archived:  { label: 'مؤرشف',   cls: 'bg-purple-500/15 text-purple-400 border border-purple-500/25' },
  };
  const s = map[status] ?? { label: status, cls: 'bg-gray-500/15 text-gray-400 border border-gray-500/25' };
  return <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}

function channelBadge(channel: any): React.ReactNode {
  if (channel === 'whatsapp') {
    return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-400 border border-green-500/25">WhatsApp</span>;
  }
  if (channel === 'email') {
    return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/25">بريد إلكتروني</span>;
  }
  if (channel === 'both') {
    return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/25">كلاهما</span>;
  }
  return <span className="text-xs text-gray-500">{channel}</span>;
}

function sendStatusBadge(status: any): React.ReactNode {
  const map: Record<string, { label: string; cls: string }> = {
    sent:   { label: 'تم الإرسال',  cls: 'bg-green-500/15 text-green-400 border border-green-500/25' },
    failed: { label: 'فشل',        cls: 'bg-red-500/15 text-red-400 border border-red-500/25' },
    pending: { label: 'قيد الانتظار', cls: 'bg-orange-500/15 text-orange-400 border border-orange-500/25' },
  };
  const s = map[status] ?? { label: status, cls: 'bg-gray-500/15 text-gray-400 border border-gray-500/25' };
  return <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}

/* ------------------------------------------------------------------ */
/*  Stat card                                                         */
/* ------------------------------------------------------------------ */

interface StatCardDef {
  label: string;
  key: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  trend?: string;
  trendColor?: string;
}

const statCardDefs: StatCardDef[] = [
  { label: 'مناسبات نشطة',   key: 'activeEvents',  icon: <IconCalendar />,   iconBg: 'bg-amber-500/15',   iconColor: 'text-amber-400',   trend: '+3',   trendColor: 'text-green-400' },
  { label: 'مناسبات قادمة',   key: 'upcomingEvents', icon: <IconClock />,     iconBg: 'bg-blue-500/15',    iconColor: 'text-blue-400',    trend: '+5',   trendColor: 'text-green-400' },
  { label: 'إجمالي الضيوف',   key: 'totalGuests',   icon: <IconUsers />,      iconBg: 'bg-green-500/15',   iconColor: 'text-green-400',   trend: '+12%', trendColor: 'text-green-400' },
  { label: 'المؤكدون',        key: 'confirmed',      icon: <IconCheck />,      iconBg: 'bg-purple-500/15',  iconColor: 'text-purple-400',  trend: '+8%',  trendColor: 'text-green-400' },
  { label: 'غير المؤكدين',    key: 'unconfirmed',    icon: <IconX />,         iconBg: 'bg-orange-500/15',  iconColor: 'text-orange-400',  trend: '-2',   trendColor: 'text-red-400' },
  { label: 'غير الحاضرين',    key: 'absent',         icon: <IconEye />,       iconBg: 'bg-red-500/15',     iconColor: 'text-red-400',     trend: '-5',   trendColor: 'text-red-400' },
  { label: 'الحاضرون',       key: 'attended',       icon: <IconUserCheck />, iconBg: 'bg-green-500/15',   iconColor: 'text-green-400',   trend: '+10%', trendColor: 'text-green-400' },
  { label: 'المرافقون',       key: 'companions',     icon: <IconUserPlus />, iconBg: 'bg-blue-500/15',    iconColor: 'text-blue-400',    trend: '+4',   trendColor: 'text-green-400' },
];

function StatCard({ def, stats }: { def: StatCardDef; stats: any }) {
  const value = (stats as any)?.[def.key] ?? 0;
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${def.iconBg} ${def.iconColor}`}>
          {def.icon}
        </div>
        {def.trend && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${def.trendColor}`}>
            <IconTrendingUp />
            {def.trend}
          </span>
        )}
      </div>
      <div className="text-2xl font-black text-gray-200">{value}</div>
      <div className="text-sm text-gray-400">{def.label}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Services data                                                     */
/* ------------------------------------------------------------------ */

const servicesData = [
  { name: 'Firebase',           status: 'متصل',    color: 'bg-green-500',   statusColor: 'text-green-400' },
  { name: 'Cloudinary',         status: 'متصل',    color: 'bg-green-500',   statusColor: 'text-green-400' },
  { name: 'WhatsApp Business',  status: 'متصل',    color: 'bg-green-500',   statusColor: 'text-green-400' },
  { name: 'Resend',             status: 'محدود',   color: 'bg-orange-500',  statusColor: 'text-orange-400' },
];

/* ------------------------------------------------------------------ */
/*  DashboardPage                                                     */
/* ------------------------------------------------------------------ */

function DashboardPage() {
  const store = useAppStore();
  const { show, ToastContainer } = useToast();

  const stats    = store.stats as any;
  const events   = (store.events as any[]) ?? [];
  const sendLogs = (store.sendLogs as any[]) ?? [];

  /* ---------- Fetch data on mount ---------- */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      store.setLoading(true);
      try {
        const [s, e, l] = await Promise.all([
          api.getStats(),
          api.getEvents(),
          api.getSendLogs(),
        ]);
        if (cancelled) return;
        store.setData('stats', s);
        store.setData('events', e);
        store.setData('sendLogs', l);
      } catch (err: any) {
        console.error('Dashboard load error:', err);
      } finally {
        if (!cancelled) store.setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  /* ---------- Helpers ---------- */
  const fmt = (v: any) => (v != null ? String(v) : '—');

  const displayEvents   = Array.isArray(events)   ? events.slice(0, 10)   : [];
  const displaySendLogs = Array.isArray(sendLogs)  ? sendLogs.slice(0, 10) : [];

  /* ---------- Render ---------- */
  return (
    <div dir="rtl" className="min-h-screen bg-[#0d1117] text-gray-200 p-6 space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-black mb-1">لوحة التحكم</h1>
        <p className="text-sm text-gray-500 mb-7">نظرة عامة على مناسبات نظام جمرة غضى</p>
      </div>

      {/* ---------- Stat cards ---------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCardDefs.map((def) => (
          <StatCard key={def.key} def={def} stats={stats} />
        ))}
      </div>

      {/* ---------- Events table ---------- */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#30363d] flex items-center gap-2">
          <IconCalendar />
          <h2 className="text-base font-bold">آخر المناسبات</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1c2333] text-gray-400 text-xs">
                <th className="text-right px-4 py-3 font-semibold">المناسبة</th>
                <th className="text-right px-4 py-3 font-semibold">العميل</th>
                <th className="text-right px-4 py-3 font-semibold">التاريخ</th>
                <th className="text-right px-4 py-3 font-semibold">الضيوف</th>
                <th className="text-right px-4 py-3 font-semibold">المؤكدون</th>
                <th className="text-right px-4 py-3 font-semibold">الحاضرون</th>
                <th className="text-right px-4 py-3 font-semibold">الحالة</th>
                <th className="text-center px-4 py-3 font-semibold">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30363d]">
              {displayEvents.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-gray-500">لا توجد مناسبات حتى الآن</td>
                </tr>
              )}
              {displayEvents.map((ev: any, i: number) => (
                <tr key={ev?.id ?? i} className="hover:bg-[#1c2333] transition">
                  <td className="px-4 py-3 font-medium text-gray-200">{fmt(ev?.name)}</td>
                  <td className="px-4 py-3 text-gray-400">{fmt(ev?.client)}</td>
                  <td className="px-4 py-3 text-gray-400">{fmt(ev?.date)}</td>
                  <td className="px-4 py-3 text-gray-300">{fmt(ev?.guests)}</td>
                  <td className="px-4 py-3 text-gray-300">{fmt(ev?.confirmed)}</td>
                  <td className="px-4 py-3 text-gray-300">{fmt(ev?.attended)}</td>
                  <td className="px-4 py-3">{eventStatusBadge(ev?.status)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-[10px] text-gray-600">—</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- Send Logs table ---------- */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#30363d] flex items-center gap-2">
          <IconSend />
          <h2 className="text-base font-bold">آخر عمليات الإرسال</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1c2333] text-gray-400 text-xs">
                <th className="text-right px-4 py-3 font-semibold">المناسبة</th>
                <th className="text-right px-4 py-3 font-semibold">النوع</th>
                <th className="text-right px-4 py-3 font-semibold">القناة</th>
                <th className="text-right px-4 py-3 font-semibold">المستلم</th>
                <th className="text-right px-4 py-3 font-semibold">الحالة</th>
                <th className="text-right px-4 py-3 font-semibold">الوقت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30363d]">
              {displaySendLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-500">لا توجد عمليات إرسال حتى الآن</td>
                </tr>
              )}
              {displaySendLogs.map((log: any, i: number) => (
                <tr key={log?.id ?? i} className="hover:bg-[#1c2333] transition">
                  <td className="px-4 py-3 font-medium text-gray-200">{fmt(log?.eventName)}</td>
                  <td className="px-4 py-3 text-gray-400">{fmt(log?.type)}</td>
                  <td className="px-4 py-3">{channelBadge(log?.channel)}</td>
                  <td className="px-4 py-3 text-gray-400">{fmt(log?.recipient)}</td>
                  <td className="px-4 py-3">{sendStatusBadge(log?.status)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{fmt(log?.time)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- Services table ---------- */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#30363d] flex items-center gap-2">
          <IconFlask />
          <h2 className="text-base font-bold">حالة الخدمات المتصلة</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#1c2333] text-gray-400 text-xs">
                <th className="text-right px-4 py-3 font-semibold">الخدمة</th>
                <th className="text-right px-4 py-3 font-semibold">الحالة</th>
                <th className="text-center px-4 py-3 font-semibold">اختبار</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30363d]">
              {servicesData.map((svc) => (
                <tr key={svc.name} className="hover:bg-[#1c2333] transition">
                  <td className="px-4 py-3 font-medium text-gray-200">{svc.name}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-2 text-sm font-semibold ${svc.statusColor}`}>
                      <span className={`w-2 h-2 rounded-full ${svc.color}`} />
                      {svc.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
<span className="text-[10px] text-gray-600">Placeholder</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Toast container */}
      {ToastContainer}
    </div>
  );
}

export default DashboardPage
