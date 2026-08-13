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

const typeBadge: Record<string, string> = {
  event: 'bg-amber-500/20 text-amber-400',
  guest: 'bg-sky-500/20 text-sky-400',
  template: 'bg-purple-500/20 text-purple-400',
};
const typeLabel: Record<string, string> = { event: 'مناسبة', guest: 'ضيف', template: 'قالب' };

export default function TrashPage() {
  const { trash, setData } = useAppStore();
  const { show, ToastContainer } = useToast();
  const [emptying, setEmptying] = useState(false);

  const load = () => api.getTrash().then((r: any) => setData('trash', r.data || r));
  useEffect(() => { load(); }, [setData]);

  const handleRestore = async (id: string) => {
    try { await api.restoreTrash(id); load(); show('تم استرداد العنصر', 'success'); } catch { show('حدث خطأ', 'error'); }
  };

  const handleDeleteFinal = async (id: string) => {
    try { await api.deleteTrashItem(id); load(); show('تم الحذف النهائي', 'success'); } catch { show('حدث خطأ', 'error'); }
  };

  const handleEmpty = async () => {
    setEmptying(true);
    try { await api.emptyTrash(); load(); show('تم إفراغ السلة', 'success'); } catch { show('حدث خطأ', 'error'); }
    setEmptying(false);
  };

  return (
    <div dir="rtl" className="space-y-6">
      {ToastContainer}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">سلة المحذوفات</h1>
        {trash.length > 0 && (
          <button onClick={handleEmpty} disabled={emptying} className="rounded-lg bg-red-600/80 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50">
            {emptying && <span className="animate-spin ml-1">⟳</span>} إفراغ السلة
          </button>
        )}
      </div>

      {trash.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#30363d] bg-[#161b22] py-20">
          <span className="text-4xl mb-3">🗑️</span>
          <p className="text-gray-400">السلة فارغة</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#30363d] bg-[#161b22] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#1c2333] text-gray-400 text-right">
                  <th className="px-4 py-3 font-medium">العنصر</th>
                  <th className="px-4 py-3 font-medium">النوع</th>
                  <th className="px-4 py-3 font-medium">المناسبة</th>
                  <th className="px-4 py-3 font-medium">تاريخ الحذف</th>
                  <th className="px-4 py-3 font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30363d]">
                {trash.map((item: any) => (
                  <tr key={item.id} className="hover:bg-[#1c2333]/50">
                    <td className="px-4 py-3 text-gray-200 font-medium">{escapeHtml(item.name)}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${typeBadge[item.itemType] || 'bg-gray-500/20 text-gray-400'}`}>{typeLabel[item.itemType] || item.itemType}</span></td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{escapeHtml(item.eventRef) || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{item.deletedAt}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => handleRestore(item.id)} className="rounded-lg border border-emerald-500/40 text-emerald-400 text-xs font-medium px-3 py-1.5 hover:bg-emerald-500/10">استرداد</button>
                        <button onClick={() => handleDeleteFinal(item.id)} className="rounded-lg border border-red-500/40 text-red-400 text-xs font-medium px-3 py-1.5 hover:bg-red-500/10">حذف نهائي</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
