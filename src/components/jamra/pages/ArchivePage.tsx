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

export default function ArchivePage() {
  const { events, setData } = useAppStore();
  const { show, ToastContainer } = useToast();
  const [archived, setArchived] = useState<any[]>([]);

  useEffect(() => {
    api.getEvents('status=archived').then((r: any) => {
      const data = r.data || r;
      setData('events', data);
      setArchived(Array.isArray(data) ? data.filter((e: any) => e.status === 'archived') : []);
    });
  }, [setData]);

  const handleRestore = async (id: string) => {
    try {
      await api.restoreEvent(id);
      setArchived((p) => p.filter((e) => e.id !== id));
      show('تم استرداد المناسبة', 'success');
    } catch { show('حدث خطأ', 'error'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteEvent(id);
      setArchived((p) => p.filter((e) => e.id !== id));
      show('تم الحذف النهائي', 'success');
    } catch { show('حدث خطأ', 'error'); }
  };

  return (
    <div dir="rtl" className="space-y-6">
      {ToastContainer}
      <h1 className="text-2xl font-bold text-gray-100">الأرشيف</h1>

      {archived.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#30363d] bg-[#161b22] py-20">
          <span className="text-4xl mb-3">📦</span>
          <p className="text-gray-400">لا توجد مناسبات مؤرشفة</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {archived.map((e: any) => (
            <div key={e.id} className="rounded-xl border border-[#30363d] bg-[#161b22] p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-200">{escapeHtml(e.name)}</h3>
                  <p className="text-xs text-gray-500 mt-1">{escapeHtml(e.client)}</p>
                </div>
                <span className="rounded-full bg-gray-500/20 text-gray-400 px-2.5 py-1 text-xs font-semibold">مؤرشف</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-gray-400">
                <span>📅 {e.date}</span>
                <span>👥 {e.guests || 0} ضيف</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleRestore(e.id)} className="flex-1 rounded-lg border border-emerald-500/40 text-emerald-400 text-xs font-medium py-2 hover:bg-emerald-500/10">استرداد</button>
                <button onClick={() => handleDelete(e.id)} className="flex-1 rounded-lg border border-red-500/40 text-red-400 text-xs font-medium py-2 hover:bg-red-500/10">حذف نهائي</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
