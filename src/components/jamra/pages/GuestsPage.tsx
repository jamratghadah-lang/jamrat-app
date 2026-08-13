'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api, useAppStore, escapeHtml } from '@/lib/store';

/* ------------------------------------------------------------------ */
/*  Toast helper                                                      */
/* ------------------------------------------------------------------ */

function useToast() {
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: 'success' | 'error' | 'info' }>>([]);
  const show = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => { setToasts((prev) => prev.filter((t) => t.id !== id)); }, 3000);
  }, []);
  const ToastContainer = toasts.length > 0 ? (
    <div className="fixed bottom-6 left-6 z-[9999] flex flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={`px-5 py-3 rounded-lg text-sm font-medium shadow-lg backdrop-blur transition-all
          ${t.type === 'success' ? 'bg-emerald-500/90 text-white' : ''}
          ${t.type === 'error' ? 'bg-red-500/90 text-white' : ''}
          ${t.type === 'info' ? 'bg-blue-500/90 text-white' : ''}`}>{t.message}</div>
      ))}
    </div>
  ) : null;
  return { show, ToastContainer };
}

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

const IconPlus = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);
const IconSearch = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
);
const IconEdit = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
);
const IconTrash = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
);
const IconUpload = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
);
const IconX = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);
const IconLoader = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" /></svg>
);
const IconUsers = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
);
const IconHistory = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
);

/* ------------------------------------------------------------------ */
/*  Empty form state                                                  */
/* ------------------------------------------------------------------ */

const emptyForm: Record<string, string> = {
  eventId: '', name: '', phone: '', email: '', companions: '0', notes: '',
};

const inputCls = 'w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-amber-500';

/* ------------------------------------------------------------------ */
/*  GuestsPage                                                        */
/* ------------------------------------------------------------------ */

function GuestsPage() {
  const store = useAppStore();
  const { show, ToastContainer } = useToast();

  const guests = (store.guests as any[]) ?? [];
  const events = (store.events as any[]) ?? [];

  const [filterEvent, setFilterEvent] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Import modal state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importEventId, setImportEventId] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [mergeDuplicates, setMergeDuplicates] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit log modal state
  const [editLogGuestId, setEditLogGuestId] = useState<string | null>(null);
  const [editLogs, setEditLogs] = useState<any[]>([]);

  /* ---------- Fetch data on mount ---------- */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      store.setLoading(true);
      try {
        const [guestsData, eventsData] = await Promise.all([api.getGuests(), api.getEvents()]);
        if (cancelled) return;
        store.setData('guests', Array.isArray(guestsData) ? guestsData : []);
        store.setData('events', Array.isArray(eventsData) ? eventsData : []);
      } catch (err: any) { show('فشل تحميل البيانات', 'error'); }
      finally { if (!cancelled) store.setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  /* ---------- Filtering ---------- */
  const filtered = guests.filter((g: any) => {
    const matchEvent = !filterEvent || g?.eventId === filterEvent;
    const q = search.trim().toLowerCase();
    const matchSearch = !q || (g?.name ?? '').toLowerCase().includes(q) || (g?.phone ?? '').includes(q);
    let matchStatus = true;
    if (filterStatus) {
      if (filterStatus === 'confirmed') matchStatus = g?.confirmed === 'confirmed';
      else if (filterStatus === 'unconfirmed') matchStatus = g?.confirmed === 'unconfirmed';
      else if (filterStatus === 'attended') matchStatus = g?.attended === 'attended';
      else if (filterStatus === 'absent') matchStatus = g?.attended === 'absent';
    }
    return matchEvent && matchSearch && matchStatus;
  });

  const allSelected = filtered.length > 0 && filtered.every((g: any) => selectedIds.has(g?.id));
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((g: any) => g?.id).filter(Boolean)));
  };
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const handleCreate = () => { setEditingId(null); setForm({ ...emptyForm, eventId: filterEvent }); setModalOpen(true); };
  const handleEdit = (g: any) => {
    setEditingId(g?.id ?? null);
    setForm({ eventId: g?.eventId ?? '', name: g?.name ?? '', phone: g?.phone ?? '', email: g?.email ?? '', companions: g?.companions != null ? String(g.companions) : '0', notes: g?.notes ?? '' });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { show('يرجى إدخال اسم الضيف', 'error'); return; }
    if (!form.eventId) { show('يرجى اختيار المناسبة', 'error'); return; }
    setSubmitting(true);
    try {
      const payload = { ...form, companions: Number(form.companions) || 0 };
      if (editingId) { await api.updateGuest(editingId, payload); show('تم تحديث الضيف بنجاح', 'success'); }
      else { await api.createGuest(payload); show('تم إضافة الضيف بنجاح', 'success'); }
      setModalOpen(false);
      const data = await api.getGuests(); store.setData('guests', Array.isArray(data) ? data : []);
    } catch (err: any) { show(editingId ? 'فشل تحديث الضيف' : 'فشل إضافة الضيف', 'error'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteGuest(id); show('تم حذف الضيف', 'success'); setDeleteConfirm(null);
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      const data = await api.getGuests(); store.setData('guests', Array.isArray(data) ? data : []);
    } catch (err: any) { show('فشل حذف الضيف', 'error'); }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) { show('يرجى تحديد ضيوف للحذف', 'error'); return; }
    try {
      await api.bulkDeleteGuests(Array.from(selectedIds)); show(`تم حذف ${selectedIds.size} ضيف`, 'success');
      setSelectedIds(new Set());
      const data = await api.getGuests(); store.setData('guests', Array.isArray(data) ? data : []);
    } catch (err: any) { show('فشل الحذف المجمّع', 'error'); }
  };

  /* ---------- Import ---------- */
  const handleImport = async () => {
    if (!importEventId) { show('يرجى اختيار المناسبة', 'error'); return; }
    if (!importFile) { show('يرجى اختيار ملف', 'error'); return; }
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      formData.append('eventId', importEventId);
      formData.append('mergeDuplicates', String(mergeDuplicates));
      const res = await fetch('/api/guests/import', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + (useAppStore.getState().token || '') },
        body: formData,
      });
      const result = await res.json();
      if (result.error) { show(result.error, 'error'); }
      else {
        setImportResult(result);
        show(`تم استيراد ${result.imported} ودمج ${result.merged} — أخطاء: ${result.errors}`, 'success');
        const data = await api.getGuests(); store.setData('guests', Array.isArray(data) ? data : []);
      }
    } catch { show('فشل استيراد الملف', 'error'); }
    setImporting(false);
  };

  /* ---------- Edit Logs ---------- */
  const handleShowEditLogs = async (guestId: string) => {
    setEditLogGuestId(guestId);
    try {
      const r: any = await api.getGuestEditLogs(guestId);
      setEditLogs(Array.isArray(r) ? r : r.data || []);
    } catch { setEditLogs([]); }
  };

  const setField = (key: string, value: string) => { setForm((prev) => ({ ...prev, [key]: value })); };
  const fmt = (v: any) => (v != null && v !== '' ? String(v) : '—');

  const sendStatusBadge = (status: any) => {
    if (status === 'sent') return <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-400 border border-green-500/25">مرسلة</span>;
    if (status === 'failed') return <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/25">فاشلة</span>;
    return <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/25">لم ترسل</span>;
  };
  const confirmedBadge = (status: any) => {
    if (status === 'confirmed') return <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-400 border border-green-500/25">مؤكد</span>;
    if (status === 'unconfirmed') return <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/25">غير مؤكد</span>;
    return <span className="text-gray-500 text-xs">—</span>;
  };
  const attendedBadge = (status: any) => {
    if (status === 'attended') return <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-400 border border-green-500/25">حاضر</span>;
    if (status === 'absent') return <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/25">غائب</span>;
    return <span className="text-gray-500 text-xs">—</span>;
  };
  const qrBadge = (hasQR: any, qrRevoked?: any) => {
    if (qrRevoked) return <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/25">ملغى</span>;
    if (hasQR) return <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/25">QR</span>;
    return <span className="text-gray-500 text-xs">—</span>;
  };
  const getEventName = (eventId: string) => { const ev = events.find((e: any) => e?.id === eventId); return ev?.name ?? '—'; };

  /* ---------- Render ---------- */
  return (
    <div dir="rtl" className="min-h-screen bg-[#0d1117] text-gray-200 p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black mb-1">إدارة الضيوف</h1>
          <p className="text-sm text-gray-500">عرض وإدارة جميع الضيوف في المناسبات</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { setImportEventId(filterEvent); setImportModalOpen(true); }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#161b22] border border-[#30363d] hover:bg-[#1c2333] text-gray-300 text-sm font-semibold transition">
            <IconUpload /> رفع قائمة
          </button>
          <button onClick={handleCreate} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold transition">
            <IconPlus /> إضافة ضيف
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <select value={filterEvent} onChange={(e) => setFilterEvent(e.target.value)} className={inputCls + ' sm:w-48 shrink-0'}>
          <option value="">كل المناسبات</option>
          {events.map((ev: any) => (<option key={ev?.id} value={ev?.id}>{escapeHtml(ev?.name)}</option>))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className={inputCls + ' sm:w-40 shrink-0'}>
          <option value="">كل الحالات</option>
          <option value="confirmed">مؤكد</option><option value="unconfirmed">غير مؤكد</option>
          <option value="attended">حاضر</option><option value="absent">غائب</option>
        </select>
        <div className="relative flex-1 min-w-0">
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"><IconSearch /></span>
          <input type="text" placeholder="ابحث بالاسم أو الجوال..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] pr-10 pl-4 py-2.5 text-sm text-gray-200 outline-none focus:border-amber-500 placeholder-gray-500 transition" />
        </div>
        {selectedIds.size > 0 && (
          <button onClick={handleBulkDelete} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-500/15 border border-red-500/30 hover:bg-red-500/25 text-red-400 text-sm font-semibold transition shrink-0">
            <IconTrash /> حذف المحدد ({selectedIds.size})
          </button>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500 bg-[#161b22] border border-[#30363d] rounded-xl">
          <IconUsers /><p className="mt-3 text-base font-medium">لا يوجد ضيوف</p>
        </div>
      ) : (
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-[#1c2333] text-gray-400 text-xs font-semibold">
                <th className="px-3 py-3 text-center w-10"><input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="accent-amber-500 w-4 h-4 cursor-pointer" /></th>
                <th className="px-3 py-3 text-right">الاسم</th><th className="px-3 py-3 text-right">الجوال</th>
                <th className="px-3 py-3 text-center">المرافقون</th><th className="px-3 py-3 text-center">الدعوة</th>
                <th className="px-3 py-3 text-center">التأكيد</th><th className="px-3 py-3 text-center">الحضور</th>
                <th className="px-3 py-3 text-center">QR</th><th className="px-3 py-3 text-center">إجراءات</th>
              </tr></thead>
              <tbody className="divide-y divide-[#30363d]">
                {filtered.map((g: any, i: number) => {
                  const id = g?.id ?? i;
                  return (
                    <tr key={id} className="hover:bg-[#1c2333] transition-colors">
                      <td className="px-3 py-3 text-center"><input type="checkbox" checked={selectedIds.has(id)} onChange={() => toggleSelect(id)} className="accent-amber-500 w-4 h-4 cursor-pointer" /></td>
                      <td className="px-3 py-3 text-right"><span className="font-medium text-gray-100">{escapeHtml(g?.name)}</span></td>
                      <td className="px-3 py-3 text-right"><span className="text-gray-300" dir="ltr">{fmt(g?.phone)}</span></td>
                      <td className="px-3 py-3 text-center text-gray-300">{fmt(g?.companions)}</td>
                      <td className="px-3 py-3 text-center">{sendStatusBadge(g?.sendStatus)}</td>
                      <td className="px-3 py-3 text-center">{confirmedBadge(g?.confirmed)}</td>
                      <td className="px-3 py-3 text-center">{attendedBadge(g?.attended)}</td>
                      <td className="px-3 py-3 text-center">{qrBadge(g?.hasQR, g?.qrRevoked)}</td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleEdit(g)} className="p-1.5 rounded-lg hover:bg-amber-500/15 text-amber-400 transition" title="تعديل"><IconEdit /></button>
                          <button onClick={() => handleShowEditLogs(id)} className="p-1.5 rounded-lg hover:bg-blue-500/15 text-blue-400 transition" title="سجل التعديلات"><IconHistory /></button>
                          {deleteConfirm === id ? (
                            <><button onClick={() => handleDelete(id)} className="px-2 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-semibold transition">تأكيد</button>
                            <button onClick={() => setDeleteConfirm(null)} className="px-2 py-1 rounded-lg bg-[#30363d] hover:bg-[#3a424d] text-gray-400 text-xs font-semibold transition">إلغاء</button></>
                          ) : (
                            <button onClick={() => setDeleteConfirm(id)} className="p-1.5 rounded-lg hover:bg-red-500/15 text-red-400 transition" title="حذف"><IconTrash /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-[#30363d] px-4 py-3 text-xs text-gray-500">عرض {filtered.length} من {guests.length} ضيف</div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-lg bg-[#161b22] border border-[#30363d] rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#161b22] border-b border-[#30363d] px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-lg font-bold text-gray-100">{editingId ? 'تعديل الضيف' : 'إضافة ضيف جديد'}</h2>
              <button onClick={() => setModalOpen(false)} className="p-1.5 rounded-lg hover:bg-[#30363d] text-gray-400 hover:text-gray-200 transition"><IconX /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div><label className="block text-sm font-semibold text-gray-300 mb-1.5">المناسبة *</label>
                <select value={form.eventId} onChange={(e) => setField('eventId', e.target.value)} className={inputCls}>
                  <option value="">اختر المناسبة</option>
                  {events.map((ev: any) => (<option key={ev?.id} value={ev?.id}>{escapeHtml(ev?.name)}</option>))}
                </select></div>
              <div><label className="block text-sm font-semibold text-gray-300 mb-1.5">اسم الضيف *</label>
                <input type="text" value={form.name} onChange={(e) => setField('name', e.target.value)} className={inputCls} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-sm font-semibold text-gray-300 mb-1.5">رقم الجوال</label>
                  <input type="text" value={form.phone} onChange={(e) => setField('phone', e.target.value)} dir="ltr" className={inputCls + ' text-left'} /></div>
                <div><label className="block text-sm font-semibold text-gray-300 mb-1.5">البريد الإلكتروني</label>
                  <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} dir="ltr" className={inputCls + ' text-left'} /></div>
              </div>
              <div className="sm:w-1/2"><label className="block text-sm font-semibold text-gray-300 mb-1.5">عدد المرافقين</label>
                <input type="number" min="0" value={form.companions} onChange={(e) => setField('companions', e.target.value)} className={inputCls} /></div>
              <div><label className="block text-sm font-semibold text-gray-300 mb-1.5">ملاحظات</label>
                <textarea value={form.notes} onChange={(e) => setField('notes', e.target.value)} rows={3} className={inputCls + ' resize-none'} /></div>
            </div>
            <div className="sticky bottom-0 bg-[#161b22] border-t border-[#30363d] px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl">
              <button onClick={() => setModalOpen(false)} className="px-5 py-2.5 rounded-lg border border-[#30363d] text-gray-400 text-sm font-semibold hover:bg-[#30363d] transition">إلغاء</button>
              <button onClick={handleSubmit} disabled={submitting} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black text-sm font-bold transition">
                {submitting && <IconLoader />}{editingId ? 'حفظ التعديلات' : 'إضافة الضيف'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {importModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setImportModalOpen(false); setImportResult(null); setImportFile(null); }} />
          <div className="relative w-full max-w-lg bg-[#161b22] border border-[#30363d] rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#161b22] border-b border-[#30363d] px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-lg font-bold text-gray-100">رفع قائمة ضيوف</h2>
              <button onClick={() => { setImportModalOpen(false); setImportResult(null); setImportFile(null); }} className="p-1.5 rounded-lg hover:bg-[#30363d] text-gray-400 hover:text-gray-200 transition"><IconX /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div><label className="block text-sm font-semibold text-gray-300 mb-1.5">المناسبة *</label>
                <select value={importEventId} onChange={(e) => setImportEventId(e.target.value)} className={inputCls}>
                  <option value="">اختر المناسبة</option>
                  {events.map((ev: any) => (<option key={ev?.id} value={ev?.id}>{escapeHtml(ev?.name)}</option>))}
                </select></div>

              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">الملف *</label>
                <input ref={fileInputRef} type="file" accept=".csv,.json,.xlsx,.xls" onChange={(e) => { setImportFile(e.target.files?.[0] || null); setImportResult(null); }} className="hidden" />
                {importFile ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0d1117] border border-[#30363d]">
                    <span className="text-lg">📄</span>
                    <span className="text-sm text-gray-200 flex-1 truncate">{importFile.name}</span>
                    <button onClick={() => { setImportFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="text-red-400 text-xs">إزالة</button>
                  </div>
                ) : (
                  <button onClick={() => fileInputRef.current?.click()} className="w-full py-8 rounded-lg border-2 border-dashed border-[#30363d] text-gray-500 hover:border-amber-500/50 hover:text-amber-400 transition text-sm flex flex-col items-center gap-2">
                    <IconUpload /> اضغط لاختيار ملف
                    <span className="text-[10px] text-gray-600">CSV, JSON, XLSX, XLS</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-[#0d1117] border border-[#30363d]">
                <input type="checkbox" id="merge" checked={mergeDuplicates} onChange={(e) => setMergeDuplicates(e.target.checked)} className="accent-amber-500" />
                <label htmlFor="merge" className="text-sm text-gray-300">دمج التكرارات تلقائياً (ضيوف بنفس الرقم يُدمجون)</label>
              </div>

              <div className="rounded-lg bg-[#0d1117] border border-[#30363d] p-3 text-[10px] text-gray-500">
                <p className="font-semibold text-gray-400 mb-1">تنسيق الملف:</p>
                <p>CSV/Excel: يجب أن يحتوي على أعمدة <span className="font-mono text-amber-400">name, phone, email, companions</span></p>
                <p>JSON: مصفوفة من كائنات بنفس الحقول (أو الأسماء العربية: الاسم، الهاتف، البريد، المرافقين)</p>
              </div>

              {importResult && (
                <div className="rounded-lg bg-[#0d1117] border border-emerald-500/20 p-4 space-y-2">
                  <p className="text-sm font-semibold text-emerald-400">نتيجة الاستيراد:</p>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded bg-emerald-500/10"><p className="text-lg font-bold text-emerald-400">{importResult.imported}</p><p className="text-[10px] text-gray-500">جديد</p></div>
                    <div className="p-2 rounded bg-amber-500/10"><p className="text-lg font-bold text-amber-400">{importResult.merged}</p><p className="text-[10px] text-gray-500">مدمج</p></div>
                    <div className="p-2 rounded bg-red-500/10"><p className="text-lg font-bold text-red-400">{importResult.errors}</p><p className="text-[10px] text-gray-500">أخطاء</p></div>
                  </div>
                  {importResult.details && importResult.details.filter((d: any) => d.status === 'error').length > 0 && (
                    <div className="mt-2 max-h-32 overflow-y-auto">
                      {importResult.details.filter((d: any) => d.status === 'error').map((d: any, i: number) => (
                        <p key={i} className="text-[10px] text-red-400">صف {d.row}: {d.name} — {d.error}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="sticky bottom-0 bg-[#161b22] border-t border-[#30363d] px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl">
              <button onClick={() => { setImportModalOpen(false); setImportResult(null); setImportFile(null); }} className="px-5 py-2.5 rounded-lg border border-[#30363d] text-gray-400 text-sm font-semibold hover:bg-[#30363d] transition">إغلاق</button>
              <button onClick={handleImport} disabled={importing || !importFile} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black text-sm font-bold transition">
                {importing && <IconLoader />}{importResult ? 'إعادة الاستيراد' : 'استيراد'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Logs Modal */}
      {editLogGuestId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setEditLogGuestId(null); setEditLogs([]); }} />
          <div className="relative w-full max-w-lg bg-[#161b22] border border-[#30363d] rounded-2xl shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#161b22] border-b border-[#30363d] px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-lg font-bold text-gray-100">سجل التعديلات</h2>
              <button onClick={() => { setEditLogGuestId(null); setEditLogs([]); }} className="p-1.5 rounded-lg hover:bg-[#30363d] text-gray-400 hover:text-gray-200 transition"><IconX /></button>
            </div>
            <div className="px-6 py-4">
              {editLogs.length === 0 ? (
                <p className="text-center text-gray-500 py-8">لا توجد تعديلات مسجلة</p>
              ) : (
                <div className="space-y-3">
                  {editLogs.map((log: any) => (
                    <div key={log.id} className="p-3 rounded-lg bg-[#0d1117] border border-[#30363d]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-amber-400">{log.field}</span>
                        <span className="text-[10px] text-gray-500" dir="ltr">{new Date(log.time).toLocaleString('ar-SA')}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-red-400 line-through">{log.oldValue || '(فارغ)'}</span>
                        <span className="text-gray-500">→</span>
                        <span className="text-emerald-400">{log.newValue || '(فارغ)'}</span>
                      </div>
                      <p className="text-[10px] text-gray-600 mt-1">بواسطة: {log.user}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {ToastContainer}
    </div>
  );
}

export default GuestsPage;
