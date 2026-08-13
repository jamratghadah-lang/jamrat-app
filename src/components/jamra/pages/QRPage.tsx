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

const QR_COLORS = [
  { value: '#000000', label: 'أسود', style: 'bg-black' },
  { value: '#D4AF37', label: 'ذهبي', style: 'bg-[#D4AF37]' },
];

export default function QRPage() {
  const { events, guests, setData, apiConfig } = useAppStore();
  const { show, ToastContainer } = useToast();
  const [eventId, setEventId] = useState('');
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [selectedColor, setSelectedColor] = useState(apiConfig?.defaultQrColor || '#000000');
  const [revokedIds, setRevokedIds] = useState<Set<string>>(new Set());
  const [showRevokeConfirm, setShowRevokeConfirm] = useState<string | null>(null);
  const [qrLog, setQrLog] = useState<any[]>([]);
  const [showQrLog, setShowQrLog] = useState<string | null>(null);

  useEffect(() => {
    api.getEvents().then((r: any) => setData('events', r.data || r));
    api.getGuests().then((r: any) => setData('guests', r.data || r));
  }, [setData]);

  const filtered = eventId
    ? guests.filter((g: any) => g.eventId === eventId && g.hasQR && !g.qrRevoked)
    : guests.filter((g: any) => g.hasQR && !g.qrRevoked);

  const fetchQR = async (id: string) => {
    const cacheKey = id + '_' + selectedColor;
    if (qrMap[cacheKey]) return;
    try {
      const svg = await api.getGuestQR(id, selectedColor);
      setQrMap((p) => ({ ...p, [cacheKey]: svg }));
    } catch { /* ignore */ }
  };

  useEffect(() => {
    setQrMap({}); // Clear cache when color changes
    filtered.forEach((g: any) => fetchQR(g.id));
  }, [filtered, selectedColor]);

  const getEventName = (eid: string) => (events.find((e: any) => e.id === eid)?.name || '—');

  const handleGenerateAll = async () => {
    setLoading(true);
    try {
      const targets = eventId
        ? guests.filter((g: any) => g.eventId === eventId)
        : guests;
      // BUG FIX (v10.6): previously called api.updateGuest with
      // { hasQR, qrRevoked, qrColor } — but UpdateGuestInput Zod schema
      // (in src/lib/validation.ts) does NOT include these fields, so
      // they were silently dropped and NO QR was actually minted. The
      // user clicked "توليد QR للجميع", saw a success toast, but the
      // guests had no qrToken. The correct call is the /api/guests/[id]/qr
      // endpoint with action=issue, which mints the token and updates
      // the guest row in one step. We don't need the SVG response here
      // (we'll fetch it lazily per-guest in fetchQR), so we discard it.
      for (const g of targets) {
        try {
          await api.getGuestQR(g.id, selectedColor);
        } catch {
          // Per-guest errors (e.g. missing manage permission on one
          // event) shouldn't abort the whole batch — just log and move on.
          console.error('QR generation failed for guest', g.id);
        }
      }
      const r = await api.getGuests();
      setData('guests', r.data || r);
      setQrMap({});
      show('تم توليد QR للجميع بنجاح', 'success');
    } catch { show('حدث خطأ أثناء التوليد', 'error'); }
    setLoading(false);
  };

  const handleDownload = (id: string, name: string) => {
    const cacheKey = id + '_' + selectedColor;
    const svg = qrMap[cacheKey];
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'qr-' + name + (selectedColor === '#D4AF37' ? '-gold' : '') + '.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRevoke = async (id: string) => {
    try {
      await api.revokeGuestQR(id);
      const r = await api.getGuests();
      setData('guests', r.data || r);
      setRevokedIds((p) => new Set([...p, id]));
      // Remove from qrMap
      const newMap = { ...qrMap };
      Object.keys(newMap).forEach(k => { if (k.startsWith(id + '_')) delete newMap[k]; });
      setQrMap(newMap);
      show('تم إبطال QR بنجاح — لن يصبح صالحاً للتسجيل', 'success');
    } catch { show('فشل إبطال QR', 'error'); }
    setShowRevokeConfirm(null);
  };

  const handleShowQrLog = async (guestId: string) => {
    setShowQrLog(guestId);
    try {
      const r: any = await api.getGuestEditLogs(guestId);
      setQrLog([]); // QR usage logs not the same as edit logs
      // Fetch QR usage from a dedicated endpoint
    } catch { setQrLog([]); }
  };

  return (
    <div dir="rtl" className="space-y-6">
      {ToastContainer}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-100">إدارة رموز QR</h1>
        <button onClick={handleGenerateAll} disabled={loading} className="flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
          {loading && <span className="animate-spin">⟳</span>} توليد QR للجميع
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-400">تصفية حسب المناسبة:</label>
          <select value={eventId} onChange={(e) => setEventId(e.target.value)} className={inputCls + ' max-w-xs'}>
            <option value="">الكل</option>
            {events.map((e: any) => <option key={e.id} value={e.id}>{escapeHtml(e.name)}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm text-gray-400">لون QR:</label>
          <div className="flex gap-2">
            {QR_COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => setSelectedColor(c.value)}
                className={`w-10 h-10 rounded-lg border-2 transition-all ${c.style} ${selectedColor === c.value ? 'border-amber-500 ring-2 ring-amber-400 scale-110' : 'border-[#30363d] hover:border-gray-500'}`}
                title={c.label}
              />
            ))}
          </div>
          <span className="text-xs text-gray-500">{selectedColor === '#D4AF37' ? 'ذهبي' : 'أسود'}</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#30363d] bg-[#161b22] py-20">
          <span className="text-4xl mb-3">📱</span>
          <p className="text-gray-400">لا يوجد ضيوف لديهم رمز QR صالح</p>
          {revokedIds.size > 0 && <p className="text-xs text-red-400 mt-2">{revokedIds.size} رمز ملغى</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((g: any) => (
            <div key={g.id} className="rounded-xl border border-[#30363d] bg-[#161b22] p-4 flex flex-col items-center gap-3">
              <div className="w-full aspect-square max-w-[180px] rounded-lg bg-white p-2 flex items-center justify-center overflow-hidden">
                {qrMap[g.id + '_' + selectedColor] ? (
                  <div dangerouslySetInnerHTML={{ __html: qrMap[g.id + '_' + selectedColor] }} className="w-full h-full [&_svg]:w-full [&_svg]:h-full" />
                ) : (
                  <span className="text-gray-400 text-xs">جارٍ التحميل...</span>
                )}
              </div>
              <p className="text-sm font-semibold text-gray-200 text-center">{escapeHtml(g.name)}</p>
              <p className="text-xs text-gray-500">{escapeHtml(getEventName(g.eventId))}</p>
              <div className="flex gap-2 w-full">
                <button onClick={() => handleDownload(g.id, g.name)} className="flex-1 rounded-lg border border-amber-500/40 text-amber-400 text-xs font-semibold py-2 hover:bg-amber-500/10">تحميل</button>
                {showRevokeConfirm === g.id ? (
                  <div className="flex gap-1 flex-1">
                    <button onClick={() => handleRevoke(g.id)} className="flex-1 rounded-lg bg-red-500/20 text-red-400 text-xs font-semibold py-1 hover:bg-red-500/30">تأكيد</button>
                    <button onClick={() => setShowRevokeConfirm(null)} className="rounded-lg bg-[#30363d] text-gray-400 text-xs py-1 px-2">✕</button>
                  </div>
                ) : (
                  <button onClick={() => setShowRevokeConfirm(g.id)} className="flex-1 rounded-lg border border-red-500/40 text-red-400 text-xs font-semibold py-2 hover:bg-red-500/10">إبطال</button>
                )}
              </div>
              {g.qrRevoked && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">ملغى</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
