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

const typeLabels: Record<string, string> = { invitation: 'دعوة', reminder: 'تذكير', final_reminder: 'تذكير أخير', thanks: 'شكر' };
const typeColors: Record<string, string> = { invitation: 'bg-amber-500/20 text-amber-400', reminder: 'bg-sky-500/20 text-sky-400', final_reminder: 'bg-orange-500/20 text-orange-400', thanks: 'bg-emerald-500/20 text-emerald-400' };

export default function TemplatesPage() {
  const { templates, setData } = useAppStore();
  const { show, ToastContainer } = useToast();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', type: 'invitation', text: '' });

  useEffect(() => { api.getTemplates().then((r: any) => setData('templates', r.data || r)); }, [setData]);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleEdit = async () => {
    if (!editingId || !form.name || !form.text) { show('يرجى ملء الحقول المطلوبة', 'error'); return; }
    try {
      await api.updateTemplate(editingId, form);
      const r = await api.getTemplates(); setData('templates', r.data || r);
      show('تم تعديل النموذج بنجاح', 'success');
      setEditingId(null); setOpen(false); setForm({ name: '', type: 'invitation', text: '' });
    } catch { show('حدث خطأ', 'error'); }
  };

  const handleCreate = async () => {
    if (!form.name || !form.text) { show('يرجى ملء الحقول المطلوبة', 'error'); return; }
    try {
      await api.createTemplate(form);
      const r = await api.getTemplates();
      setData('templates', r.data || r);
      show('تم إنشاء النموذج بنجاح', 'success');
      setOpen(false); setForm({ name: '', type: 'invitation', text: '' });
    } catch { show('حدث خطأ', 'error'); }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteTemplate(id);
      const r = await api.getTemplates();
      setData('templates', r.data || r);
      show('تم حذف النموذج', 'success');
    } catch { show('حدث خطأ', 'error'); }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    show('تم النسخ', 'success');
  };

  return (
    <div dir="rtl" className="space-y-6">
      {ToastContainer}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">القوالب</h1>
        <button onClick={() => setOpen(true)} className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700">+ إضافة نموذج</button>
      </div>

      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#30363d] bg-[#161b22] py-20">
          <span className="text-4xl mb-3">📋</span>
          <p className="text-gray-400">لا توجد قوالب بعد</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t: any) => (
            <div key={t.id} className="rounded-xl border border-[#30363d] bg-[#161b22] p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-200">{escapeHtml(t.name)}</h3>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${typeColors[t.type] || 'bg-gray-500/20 text-gray-400'}`}>{typeLabels[t.type] || t.type}</span>
              </div>
              <div className="max-h-36 overflow-y-auto text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">
                {escapeHtml(t.text)}
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleCopy(t.text)} className="flex-1 rounded-lg border border-[#30363d] text-gray-300 text-xs font-medium py-2 hover:bg-[#1c2333]">نسخ</button>
                <button onClick={() => { setEditingId(t.id); setForm({ name: t.name, type: t.type, text: t.text }); setOpen(true); }} className="flex-1 rounded-lg border border-amber-500/40 text-amber-400 text-xs font-medium py-2 hover:bg-amber-500/10">تعديل</button>
                <button onClick={() => handleDelete(t.id)} className="flex-1 rounded-lg border border-red-500/40 text-red-400 text-xs font-medium py-2 hover:bg-red-500/10">حذف</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-[#30363d] bg-[#161b22] p-6 space-y-4 mx-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-100">{editingId ? 'تعديل النموذج' : 'إضافة نموذج'}</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-200 text-xl">✕</button>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">اسم النموذج</label>
              <input value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} placeholder="مثال: دعوة زفاف" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">النوع</label>
              <select value={form.type} onChange={(e) => set('type', e.target.value)} className={inputCls}>
                <option value="invitation">دعوة</option>
                <option value="reminder">تذكير</option>
                <option value="final_reminder">تذكير أخير</option>
                <option value="thanks">شكر</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-300">نص الرسالة</label>
              <textarea value={form.text} onChange={(e) => set('text', e.target.value)} rows={5} className={inputCls + ' resize-none'} placeholder="اكتب نص الرسالة..." />
            </div>
            <button onClick={editingId ? handleEdit : handleCreate} className="w-full rounded-lg bg-amber-600 py-2.5 text-sm font-semibold text-white hover:bg-amber-700">{editingId ? 'حفظ التعديل' : 'حفظ النموذج'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
