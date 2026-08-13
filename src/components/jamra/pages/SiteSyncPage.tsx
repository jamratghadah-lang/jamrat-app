'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, useAppStore, escapeHtml } from '@/lib/store';

const inputCls = 'w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-amber-500 transition';

function useToast() {
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: 'success' | 'error' | 'info' }>>([]);
  const show = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  }, []);
  const ToastContainer = toasts.length > 0 ? (
    <div className="fixed bottom-6 left-6 z-[9999] flex flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={`px-5 py-3 rounded-lg text-sm font-medium shadow-lg backdrop-blur ${t.type === 'success' ? 'bg-emerald-500/90 text-white' : t.type === 'error' ? 'bg-red-500/90 text-white' : 'bg-amber-500/90 text-white'}`}>{t.message}</div>
      ))}
    </div>
  ) : null;
  return { show, ToastContainer };
}

interface SyncItem {
  key: string;
  label: string;
  count: number;
}

export default function SiteSyncPage() {
  const { events, setData } = useAppStore();
  const { show, ToastContainer } = useToast();
  const [siteUrl, setSiteUrl] = useState('https://jamratghadah.com');
  const [syncing, setSyncing] = useState(false);
  const [syncingEntity, setSyncingEntity] = useState<string>('');
  const [items, setItems] = useState<SyncItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [lastSyncAttempt, setLastSyncAttempt] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'api'>('overview');

  // Fetch REAL counts from /api/site-sync
  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const r: any = await api.getSiteSyncStatus();
      setItems(Array.isArray(r?.items) ? r.items : []);
      setSyncEnabled(r?.syncEnabled === true);
      setLastSyncAttempt(r?.lastFullSync || null);
      if (r?.siteUrl) setSiteUrl(r.siteUrl);
    } catch (e: any) {
      show(e?.message || 'فشل تحميل حالة المزامنة', 'error');
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => {
    api.getEvents().then((r: any) => setData('events', r.data || r)).catch(() => {});
    loadStatus();
  }, [setData, loadStatus]);

  // Real sync — calls API, records audit log, shows honest result
  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const r: any = await api.triggerSiteSync({ entity: 'all' });
      setLastSyncAttempt(new Date().toLocaleString('ar-SA'));
      if (r?.success) {
        show('تمت المزامنة بنجاح', 'success');
      } else {
        // Honest message: sync not wired to real external site
        show(r?.message || 'المزامنة غير مفعّلة في هذه النسخة. تم تسجيل المحاولة في السجل.', 'info');
      }
      await loadStatus();
    } catch (e: any) {
      show(e?.message || 'فشل المزامنة', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncSingle = async (key: string) => {
    setSyncingEntity(key);
    try {
      const r: any = await api.triggerSiteSync({ entity: key });
      if (r?.success) {
        show(`تمت مزامنة ${items.find(s => s.key === key)?.label || key}`, 'success');
      } else {
        show(r?.message || 'المزامنة غير مفعّلة في هذه النسخة', 'info');
      }
      await loadStatus();
    } catch (e: any) {
      show(e?.message || 'فشل المزامنة', 'error');
    } finally {
      setSyncingEntity('');
    }
  };

  const handleSyncEvent = async () => {
    if (!selectedEvent) {
      show('اختر مناسبة أولاً', 'error');
      return;
    }
    setSyncing(true);
    try {
      const r: any = await api.triggerSiteSync({ entity: 'event', eventId: selectedEvent });
      if (r?.success) {
        show('تمت مزامنة بيانات المناسبة المحددة', 'success');
      } else {
        show(r?.message || 'المزامنة غير مفعّلة في هذه النسخة', 'info');
      }
    } catch (e: any) {
      show(e?.message || 'فشل المزامنة', 'error');
    } finally {
      setSyncing(false);
    }
  };

  // Real, documented public API endpoints (these all exist in the codebase)
  const apiEndpoints = [
    { method: 'GET', path: '/api/public?eventId=...&password=...', desc: 'بيانات المناسبة للصفحة العامة (محمية بكلمة المرور)' },
    { method: 'GET', path: '/api/qr-verify', desc: 'التحقق من QR (يتطلب مصادقة)' },
    { method: 'POST', path: '/api/checkin', desc: 'تسجيل الحضور (يتطلب مصادقة)' },
    { method: 'GET', path: '/api/events', desc: 'جلب قائمة المناسبات (يتطلب مصادقة)' },
    { method: 'GET', path: '/api/guests', desc: 'جلب قائمة الضيوف (يتطلب مصادقة)' },
  ];

  return (
    <div dir="rtl" className="space-y-6">
      {ToastContainer}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">الربط مع الموقع</h1>
          <p className="text-sm text-gray-500 mt-1">مزامنة البيانات بين لوحة التحكم والموقع العام</p>
        </div>
        <button
          onClick={handleSyncAll}
          disabled={syncing}
          className="flex items-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition"
        >
          {syncing && <span className="animate-spin">⟳</span>}
          مزامنة شاملة الآن
        </button>
      </div>

      {/* Honest status banner */}
      {!syncEnabled && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-400">المزامنة الفعلية مع الموقع غير مفعّلة</p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                هذه النسخة لا تتصل بموقع خارجي. عند الضغط على &quot;مزامنة&quot; يتم تسجيل المحاولة في سجل العمليات
                (<code className="text-amber-400">operation_logs</code>) ولن يتم إرسال أي بيانات إلى موقع خارجي.
                الأرقام أدناه هي الأعداد الحقيقية من قاعدة البيانات المحلية.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Connection Status Bar */}
      <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${syncEnabled ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50' : 'bg-gray-600'}`} />
          <div>
            <p className="text-sm font-medium text-gray-200">حالة الاتصال</p>
            <p className="text-xs text-gray-500">
              آخر محاولة مزامنة: {lastSyncAttempt || '— لم تتم بعد —'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className={`px-2.5 py-1 rounded-full border ${syncEnabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
            {syncEnabled ? 'متصل' : 'غير متصل'}
          </span>
          <span className="text-gray-500" dir="ltr">{siteUrl}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#161b22] rounded-xl border border-[#30363d] p-1">
        {([['overview', 'نظرة عامة'], ['api', 'API العامة']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setActiveTab(k)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition ${activeTab === k ? 'bg-amber-500/15 text-amber-400' : 'text-gray-400 hover:text-gray-200'}`}>
            {l}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Settings (display-only — site URL comes from env) */}
          <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-200">إعدادات الموقع</h2>
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400">رابط الموقع (من <code className="text-amber-400">SITE_URL</code>)</label>
              <input value={siteUrl} onChange={e => setSiteUrl(e.target.value)} className={inputCls} dir="ltr" />
              <p className="text-[10px] text-gray-500">يُقرأ من متغير البيئة <code>SITE_URL</code> عند بدء التشغيل.</p>
            </div>
          </div>

          {/* Real counts table */}
          <div className="rounded-xl border border-[#30363d] bg-[#161b22] overflow-hidden">
            <div className="p-4 border-b border-[#30363d] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-200">البيانات المتاحة للمزامنة</h2>
              <span className="text-[10px] text-gray-500">الأعداد من قاعدة البيانات</span>
            </div>
            {loading ? (
              <div className="p-12 text-center text-gray-500 text-sm">جارٍ تحميل الأعداد...</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#0d1117] text-gray-400 text-right">
                    <th className="px-5 py-3 font-medium">البيان</th>
                    <th className="px-5 py-3 font-medium">العدد الحالي</th>
                    <th className="px-5 py-3 font-medium">إجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={3} className="px-5 py-8 text-center text-gray-500">لا توجد بيانات</td></tr>
                  ) : items.map((item) => (
                    <tr key={item.key} className="border-t border-[#30363d]/50 hover:bg-white/[0.02] transition">
                      <td className="px-5 py-3 text-gray-200 font-medium">{item.label}</td>
                      <td className="px-5 py-3 text-gray-300 font-mono">{item.count.toLocaleString('ar-SA')}</td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => handleSyncSingle(item.key)}
                          disabled={syncingEntity === item.key || syncing}
                          className="text-xs px-3 py-1.5 rounded-lg border border-[#30363d] text-gray-400 hover:text-amber-400 hover:border-amber-500/30 transition disabled:opacity-50"
                        >
                          {syncingEntity === item.key ? 'جارٍ...' : 'مزامنة'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Event-specific sync */}
          <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-200">مزامنة مناسبة محددة</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <select value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)} className={inputCls + ' flex-1'}>
                <option value="">اختر مناسبة...</option>
                {events.map((e: any) => <option key={e.id} value={e.id}>{escapeHtml(e.name)}</option>)}
              </select>
              <button
                onClick={handleSyncEvent}
                disabled={syncing || !selectedEvent}
                className="px-5 py-2.5 rounded-lg bg-[#0d1117] border border-[#30363d] text-sm text-gray-300 hover:border-amber-500/30 hover:text-amber-400 transition disabled:opacity-50"
              >
                {syncing ? 'جارٍ...' : 'مزامنة المناسبة'}
              </button>
            </div>
            <p className="text-[10px] text-gray-500 leading-relaxed">
              سيتم تسجيل محاولة المزامنة في سجل العمليات. المزامنة الفعلية مع الموقع الخارجي غير مفعّلة.
            </p>
          </div>
        </div>
      )}

      {/* Tab: API */}
      {activeTab === 'api' && (
        <div className="rounded-xl border border-[#30363d] bg-[#161b22] overflow-hidden">
          <div className="p-4 border-b border-[#30363d]">
            <h2 className="text-sm font-semibold text-gray-200">نقاط النهاية العامة (API)</h2>
            <p className="text-xs text-gray-500 mt-1">هذه النقاط يستخدمها الموقع العام للتواصل مع لوحة التحكم</p>
          </div>
          <div className="divide-y divide-[#30363d]/50">
            {apiEndpoints.map((ep, i) => (
              <div key={i} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition">
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded ${
                    ep.method === 'GET' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                  }`}>{ep.method}</span>
                  <code className="text-sm text-gray-300 font-mono" dir="ltr">{ep.path}</code>
                </div>
                <span className="text-xs text-gray-500">{ep.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
