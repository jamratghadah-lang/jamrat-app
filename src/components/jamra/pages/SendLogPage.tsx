'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, useAppStore, escapeHtml } from '@/lib/store';

const inputCls = 'w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-amber-500';

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

const statusBadge: Record<string, string> = {
  success: 'bg-emerald-500/20 text-emerald-400',
  failed: 'bg-red-500/20 text-red-400',
  pending: 'bg-amber-500/20 text-amber-400',
};
const statusLabel: Record<string, string> = { success: 'ناجح', failed: 'فاشل', pending: 'قيد الانتظار' };
const channelLabel: Record<string, string> = { whatsapp: 'واتساب', email: 'إيميل', both: 'الاثنان' };
const typeLabel: Record<string, string> = { invitation: 'دعوة', reminder: 'تذكير', final_reminder: 'تذكير أخير', thanks: 'شكر' };

export default function SendLogPage() {
  const { sendLogs, setData } = useAppStore();
  const { show, ToastContainer } = useToast();
  const [statusFilter, setStatusFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');

  useEffect(() => { api.getSendLogs().then((r: any) => setData('sendLogs', r.data || r)); }, [setData]);

  const filtered = sendLogs.filter((l: any) => {
    if (statusFilter && l.status !== statusFilter) return false;
    if (channelFilter && l.channel !== channelFilter) return false;
    return true;
  });

  const handleResend = async (log: any) => {
    try {
      // BUG FIX (v10.4): previously called api.createEvent({ action: 'resend', ... })
      // which (a) is RBAC-denied for `sender` role (POST /api/events is in DENIED_RULES),
      // and (b) creates a NEW event instead of resending — the payload doesn't match
      // CreateEventInput Zod schema, so it fails for admin/staff too.
      // Correct call: api.sendMessages with the failed log's guestId.
      if (!log.guestId) {
        show('لا يمكن إعادة الإرسال — السجل غير مرتبط بضيف محدد', 'error');
        return;
      }
      await api.sendMessages({
        eventId: log.eventId,
        channel: log.channel || 'whatsapp',
        type: log.type || 'invite',
        guestIds: [log.guestId],
      });
      show('تمت إعادة الإرسال', 'success');
    } catch { show('حدث خطأ', 'error'); }
  };

  return (
    <div dir="rtl" className="space-y-6">
      {ToastContainer}
      <h1 className="text-2xl font-bold text-gray-100">سجل الإرسال</h1>

      <div className="flex flex-wrap gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={inputCls + ' max-w-[160px]'}>
          <option value="">كل الحالات</option>
          <option value="success">ناجح</option>
          <option value="failed">فاشل</option>
          <option value="pending">قيد الانتظار</option>
        </select>
        <select value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} className={inputCls + ' max-w-[160px]'}>
          <option value="">كل القنوات</option>
          <option value="whatsapp">واتساب</option>
          <option value="email">إيميل</option>
        </select>
      </div>

      <div className="rounded-xl border border-[#30363d] bg-[#161b22] overflow-hidden">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#1c2333] text-gray-400 text-right">
                <th className="px-4 py-3 font-medium">المستلم</th>
                <th className="px-4 py-3 font-medium">النوع</th>
                <th className="px-4 py-3 font-medium">القناة</th>
                <th className="px-4 py-3 font-medium">الوقت</th>
                <th className="px-4 py-3 font-medium">الحالة</th>
                <th className="px-4 py-3 font-medium">سبب الفشل</th>
                <th className="px-4 py-3 font-medium">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#30363d]">
              {filtered.map((l: any) => (
                <tr key={l.id} className="hover:bg-[#1c2333]/50">
                  <td className="px-4 py-3 text-gray-200">{escapeHtml(l.recipient)}</td>
                  <td className="px-4 py-3 text-gray-300">{typeLabel[l.type] || l.type}</td>
                  <td className="px-4 py-3 text-gray-300">{channelLabel[l.channel] || l.channel}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{l.time}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge[l.status] || 'bg-gray-500/20 text-gray-400'}`}>{statusLabel[l.status] || l.status}</span></td>
                  <td className="px-4 py-3 text-red-400/70 text-xs max-w-[180px] truncate">{escapeHtml(l.failReason) || '—'}</td>
                  <td className="px-4 py-3">
                    {l.status === 'failed' && <button onClick={() => handleResend(l)} className="text-amber-400 text-xs font-medium hover:underline">إعادة إرسال</button>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">لا توجد سجلات</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
