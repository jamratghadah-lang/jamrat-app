'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, useAppStore, escapeHtml } from '@/lib/store';

const IconPlus = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
);

const IconSearch = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
);

const IconCalendar = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
);

const IconClock = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
);

const IconMapPin = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
);

const IconUsers = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
);

const IconUserCheck = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><polyline points="16 11 18 13 22 9" /></svg>
);

const IconEdit = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
);

const IconTrash = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
);

const IconArchive = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" /></svg>
);

const IconX = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);

const IconPhone = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72" /></svg>
);

const IconLoader = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="animate-spin"><line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" /><line x1="4.93" y1="4.93" x2="7.76" y2="7.76" /><line x1="16.24" y1="16.24" x2="19.07" y2="19.07" /><line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" /><line x1="4.93" y1="19.07" x2="7.76" y2="16.24" /><line x1="16.24" y1="7.76" x2="19.07" y2="4.93" /></svg>
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
/*  Status badge                                                      */
/* ------------------------------------------------------------------ */

function statusBadge(status: any): React.ReactNode {
  const map: Record<string, { label: string; cls: string }> = {
    active:    { label: 'نشطة',       cls: 'bg-green-500/15 text-green-400 border border-green-500/25' },
    preparing: { label: 'قيد التجهيز', cls: 'bg-amber-500/15 text-amber-400 border border-amber-500/25' },
    ended:     { label: 'منتهية',      cls: 'bg-gray-500/15 text-gray-400 border border-gray-500/25' },
    archived:  { label: 'مؤرشفة',      cls: 'bg-purple-500/15 text-purple-400 border border-purple-500/25' },
  };
  const s = map[status] ?? { label: status, cls: 'bg-gray-500/15 text-gray-400 border border-gray-500/25' };
  return <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}

/* ------------------------------------------------------------------ */
/*  Tabs                                                              */
/* ------------------------------------------------------------------ */

const TABS = [
  { key: 'all',       label: 'الكل' },
  { key: 'active',    label: 'نشطة' },
  { key: 'preparing', label: 'قيد التجهيز' },
  { key: 'ended',     label: 'منتهية' },
  { key: 'archived',  label: 'مؤرشفة' },
] as const;

/* ------------------------------------------------------------------ */
/*  Empty form state                                                  */
/* ------------------------------------------------------------------ */

const emptyForm: Record<string, string> = {
  name: '',
  client: '',
  clientPhone: '',
  date: '',
  time: '',
  location: '',
  status: 'preparing',
  notes: '',
};

/* ------------------------------------------------------------------ */
/*  EventsPage                                                        */
/* ------------------------------------------------------------------ */

function EventsPage() {
  const store = useAppStore();
  const { show, ToastContainer } = useToast();

  const events = (store.events as any[]) ?? [];

  const [activeTab, setActiveTab] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ ...emptyForm });
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [assignmentEvent, setAssignmentEvent] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignUsers, setAssignUsers] = useState<any[]>([]);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignRole, setAssignRole] = useState('staff');
  const [assigning, setAssigning] = useState(false);

  /* ---------- Fetch events on mount ---------- */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      store.setLoading(true);
      try {
        const data = await api.getEvents();
        if (cancelled) return;
        store.setData('events', Array.isArray(data) ? data : []);
      } catch (err: any) {
        console.error('Events load error:', err);
        show('فشل تحميل المناسبات', 'error');
      } finally {
        if (!cancelled) store.setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  /* ---------- Filtering and search ---------- */
  const filtered = events.filter((ev: any) => {
    const matchTab = activeTab === 'all' || ev?.status === activeTab;
    const q = search.trim().toLowerCase();
    const matchSearch = !q
      || (ev?.name ?? '').toLowerCase().includes(q)
      || (ev?.client ?? '').toLowerCase().includes(q)
      || (ev?.location ?? '').toLowerCase().includes(q);
    return matchTab && matchSearch;
  });

  /* ---------- Open create modal ---------- */
  const handleCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  /* ---------- Open edit modal ---------- */
  const handleEdit = (ev: any) => {
    setEditingId(ev?.id ?? null);
    setForm({
      name: ev?.name ?? '',
      client: ev?.client ?? '',
      clientPhone: ev?.clientPhone ?? '',
      date: ev?.date ?? '',
      time: ev?.time ?? '',
      location: ev?.location ?? '',
      status: ev?.status ?? 'preparing',
      notes: ev?.notes ?? '',
    });
    setModalOpen(true);
  };

  /* ---------- Submit (create / update) ---------- */
  const handleSubmit = async () => {
    if (!form.name.trim()) {
      show('يرجى إدخال اسم المناسبة', 'error');
      return;
    }
    setSubmitting(true);
    try {
      if (editingId) {
        await api.updateEvent(editingId, form);
        show('تم تحديث المناسبة بنجاح', 'success');
      } else {
        await api.createEvent(form);
        show('تم إنشاء المناسبة بنجاح', 'success');
      }
      setModalOpen(false);
      const data = await api.getEvents();
      store.setData('events', Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Event save error:', err);
      show(editingId ? 'فشل تحديث المناسبة' : 'فشل إنشاء المناسبة', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  /* ---------- Delete ---------- */
  const handleDelete = async (id: string) => {
    try {
      await api.deleteEvent(id);
      show('تم حذف المناسبة', 'success');
      setDeleteConfirm(null);
      const data = await api.getEvents();
      store.setData('events', Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Event delete error:', err);
      show('فشل حذف المناسبة', 'error');
    }
  };

  /* ---------- Archive ---------- */
  const handleArchive = async (id: string) => {
    try {
      await api.archiveEvent(id);
      show('تم أرشفة المناسبة', 'success');
      const data = await api.getEvents();
      store.setData('events', Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Event archive error:', err);
      show('فشل أرشفة المناسبة', 'error');
    }
  };

  const openAssignments = async (ev: any) => {
    setAssignmentEvent(ev);
    setAssignUserId('');
    setAssignRole('staff');
    try {
      const [a, u] = await Promise.all([api.getEventAssignments(ev.id), api.getUsers()]);
      setAssignments(Array.isArray(a) ? a : []);
      setAssignUsers((Array.isArray(u) ? u : (u.data || [])).filter((x: any) => x.status !== 'disabled' && x.role !== 'admin'));
    } catch (err: any) {
      show(err?.message || 'فشل تحميل تعيينات المناسبة', 'error');
      setAssignmentEvent(null);
    }
  };

  const handleAssign = async () => {
    if (!assignmentEvent || !assignUserId) { show('اختر مستخدمًا أولاً', 'error'); return; }
    setAssigning(true);
    try {
      await api.assignEventUser(assignmentEvent.id, assignUserId, assignRole);
      const a = await api.getEventAssignments(assignmentEvent.id);
      setAssignments(Array.isArray(a) ? a : []);
      setAssignUserId('');
      show('تم تعيين المستخدم للمناسبة', 'success');
    } catch (err: any) { show(err?.message || 'فشل التعيين', 'error'); }
    finally { setAssigning(false); }
  };

  const handleRevoke = async (userId: string) => {
    if (!assignmentEvent) return;
    try {
      await api.revokeEventUser(assignmentEvent.id, userId);
      setAssignments((prev) => prev.filter((a) => a.userId !== userId));
      show('تم إلغاء تعيين المستخدم', 'success');
    } catch (err: any) { show(err?.message || 'فشل إلغاء التعيين', 'error'); }
  };

  /* ---------- Form field setter ---------- */
  const setField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  /* ---------- Helpers ---------- */
  const fmt = (v: any) => (v != null ? String(v) : '—');

  const inputCls = 'w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-amber-500';

  /* ---------- Render ---------- */
  return (
    <div dir="rtl" className="min-h-screen bg-[#0d1117] text-gray-200 p-6 space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black mb-1">إدارة المناسبات</h1>
          <p className="text-sm text-gray-500">عرض وإدارة جميع المناسبات في النظام</p>
        </div>
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm font-bold transition"
        >
          <IconPlus />
          {'إضافة مناسبة'}
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
          <IconSearch />
        </span>
        <input
          type="text"
          placeholder={"ابحث بالاسم أو العميل أو الموقع..."}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-[#30363d] bg-[#161b22] pr-10 pl-4 py-2.5 text-sm text-gray-200 outline-none focus:border-amber-500 placeholder-gray-500 transition"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count = tab.key === 'all'
            ? events.length
            : events.filter((e: any) => e?.status === tab.key).length;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition
                ${isActive
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'bg-[#161b22] text-gray-400 border border-[#30363d] hover:bg-[#1c2333] hover:text-gray-300'
                }`}
            >
              {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-md ${isActive ? 'bg-amber-500/20 text-amber-300' : 'bg-[#30363d] text-gray-500'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Cards grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <IconCalendar />
          <p className="mt-3 text-base font-medium">لا توجد مناسبات</p>
          <p className="text-sm mt-1">لم يتم العثور على نتائج مطابقة</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((ev: any, i: number) => (
            <div
              key={ev?.id ?? i}
              className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 flex flex-col gap-4 hover:border-amber-500/30 transition"
            >
              {/* Card header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-base font-bold text-gray-100 truncate">
                    {escapeHtml(ev?.name)}
                  </h3>
                  <p className="text-sm text-gray-400 mt-0.5 truncate">
                    {escapeHtml(ev?.client)}
                  </p>
                </div>
                {statusBadge(ev?.status)}
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-1.5 text-gray-400">
                  <IconCalendar />
                  <span className="truncate">{fmt(ev?.date)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-400">
                  <IconClock />
                  <span className="truncate">{fmt(ev?.time)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-400">
                  <IconMapPin />
                  <span className="truncate">{escapeHtml(ev?.location)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-400">
                  <IconPhone />
                  <span className="truncate" dir="ltr">{fmt(ev?.clientPhone)}</span>
                </div>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-gray-400">
                  <IconUsers />
                  <span>{'الضيوف: '}{<strong className="text-gray-200">{fmt(ev?.guests)}</strong>}</span>
                </div>
                <div className="flex items-center gap-1.5 text-gray-400">
                  <IconUserCheck />
                  <span>{'المؤكدون: '}{<strong className="text-gray-200">{fmt(ev?.confirmed)}</strong>}</span>
                </div>
              </div>

              {/* Notes */}
              {ev?.notes && (
                <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                  {escapeHtml(ev?.notes)}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-[#30363d]">
                <button
                  onClick={() => handleEdit(ev)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-semibold transition"
                >
                  <IconEdit />
                  {'تعديل'}
                </button>
                {store.user?.role === 'admin' && (
                  <button
                    onClick={() => openAssignments(ev)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-semibold transition"
                  >
                    تعيين
                  </button>
                )}
                <button
                  onClick={() => handleArchive(ev.id)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 text-xs font-semibold transition"
                >
                  <IconArchive />
                </button>
                {deleteConfirm === ev?.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(ev.id)}
                      className="px-3 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-semibold transition"
                    >
                      {'تأكيد'}
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="px-3 py-2 rounded-lg bg-[#30363d] hover:bg-[#3a424d] text-gray-400 text-xs font-semibold transition"
                    >
                      {'إلغاء'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(ev?.id)}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold transition"
                  >
                    <IconTrash />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {assignmentEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setAssignmentEvent(null)} />
          <div className="relative w-full max-w-lg bg-[#161b22] border border-[#30363d] rounded-2xl shadow-2xl p-6 space-y-5" dir="rtl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-100">تعيين مستخدم للمناسبة</h2>
              <button onClick={() => setAssignmentEvent(null)} className="p-1.5 rounded-lg hover:bg-[#30363d] text-gray-400"><IconX /></button>
            </div>
            <p className="text-sm text-gray-400">{escapeHtml(assignmentEvent.name)}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)} className={inputCls}>
                <option value="">اختر المستخدم</option>
                {assignUsers.map((u: any) => <option key={u.id} value={u.id}>{u.name} — {u.email}</option>)}
              </select>
              <select value={assignRole} onChange={(e) => setAssignRole(e.target.value)} className={inputCls}>
                <option value="staff">إدارة</option><option value="checkin">حضور</option><option value="sender">إرسال</option>
              </select>
            </div>
            <button onClick={handleAssign} disabled={assigning || !assignUserId} className="w-full rounded-lg bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-bold py-2.5">
              {assigning ? 'جارٍ التعيين...' : 'تعيين المستخدم'}
            </button>
            <div className="border-t border-[#30363d] pt-4 space-y-2">
              <h3 className="text-sm font-semibold text-gray-300">المستخدمون المعيّنون</h3>
              {assignments.length === 0 ? <p className="text-xs text-gray-500">لا يوجد مستخدمون معيّنون لهذه المناسبة.</p> : assignments.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg bg-[#0d1117] px-3 py-2">
                  <div><p className="text-sm text-gray-200">{a.user?.name || a.userId}</p><p className="text-xs text-gray-500">{a.user?.email || ''} — {a.role}</p></div>
                  <button onClick={() => handleRevoke(a.userId)} className="text-xs text-red-400 hover:text-red-300">إلغاء</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          />
          {/* Dialog */}
          <div className="relative w-full max-w-lg bg-[#161b22] border border-[#30363d] rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="sticky top-0 bg-[#161b22] border-b border-[#30363d] px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <h2 className="text-lg font-bold text-gray-100">
                {editingId ? 'تعديل المناسبة' : 'إضافة مناسبة جديدة'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-[#30363d] text-gray-400 hover:text-gray-200 transition"
              >
                <IconX />
              </button>
            </div>

            {/* Modal body */}
            <div className="px-6 py-5 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">{'اسم المناسبة *'}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setField('name', e.target.value)}
                  placeholder={"مثال: حفل زفاف أحمد"}
                  className={inputCls}
                />
              </div>

              {/* Client and Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">{'اسم العميل'}</label>
                  <input
                    type="text"
                    value={form.client}
                    onChange={(e) => setField('client', e.target.value)}
                    placeholder={"اسم العميل"}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">{'رقم الجوال'}</label>
                  <input
                    type="text"
                    value={form.clientPhone}
                    onChange={(e) => setField('clientPhone', e.target.value)}
                    placeholder="05xxxxxxxx"
                    dir="ltr"
                    className={inputCls + ' text-left'}
                  />
                </div>
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">{'التاريخ'}</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setField('date', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">{'الوقت'}</label>
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => setField('time', e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">{'الموقع'}</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setField('location', e.target.value)}
                  placeholder={"مثال: قاعة الأفراح - الرياض"}
                  className={inputCls}
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">{'الحالة'}</label>
                <select
                  value={form.status}
                  onChange={(e) => setField('status', e.target.value)}
                  className={inputCls}
                >
                  <option value="preparing">{'قيد التجهيز'}</option>
                  <option value="active">{'نشطة'}</option>
                  <option value="ended">{'منتهية'}</option>
                  <option value="archived">{'مؤرشفة'}</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1.5">{'ملاحظات'}</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  rows={3}
                  placeholder={"ملاحظات إضافية..."}
                  className={inputCls + ' resize-none'}
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="sticky bottom-0 bg-[#161b22] border-t border-[#30363d] px-6 py-4 flex items-center justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => setModalOpen(false)}
                className="px-5 py-2.5 rounded-lg border border-[#30363d] text-gray-400 text-sm font-semibold hover:bg-[#30363d] transition"
              >
                {'إلغاء'}
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black text-sm font-bold transition"
              >
                {submitting && <IconLoader />}
                {editingId ? 'حفظ التعديلات' : 'إنشاء المناسبة'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast container */}
      {ToastContainer}
    </div>
  );
}

export default EventsPage;
