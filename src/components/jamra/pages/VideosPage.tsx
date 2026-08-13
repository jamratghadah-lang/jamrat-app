'use client';

import { useEffect, useState } from 'react';
import { api, useAppStore } from '@/lib/store';

export default function VideosPage() {
  const { events, user } = useAppStore();
  const [media, setMedia] = useState<any[]>([]);
  const [eventId, setEventId] = useState('');
  const [type, setType] = useState<'video' | 'image'>('video');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const result = await api.getMedia(eventId || undefined);
      setMedia(Array.isArray(result) ? result : []);
    } catch (e: any) {
      setMessage({ text: e?.message || 'فشل تحميل الوسائط', error: true });
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [eventId]);

  const addMedia = async () => {
    if (!eventId || !url.trim()) { setMessage({ text: 'اختر المناسبة وأدخل رابط الوسائط', error: true }); return; }
    setSaving(true);
    try {
      await api.createMedia({ eventId, type, title: title.trim(), url: url.trim() });
      setTitle(''); setUrl('');
      setMessage({ text: 'تمت إضافة الوسائط بنجاح' });
      await load();
    } catch (e: any) {
      setMessage({ text: e?.message || 'فشل إضافة الوسائط', error: true });
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    try {
      await api.deleteMedia(id);
      setMedia((prev) => prev.filter((x) => x.id !== id));
      setMessage({ text: 'تم حذف الوسائط' });
    } catch (e: any) { setMessage({ text: e?.message || 'فشل حذف الوسائط', error: true }); }
  };

  return (
    <div dir="rtl" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">الفيديوهات والوسائط</h1>
        <p className="text-sm text-gray-500 mt-1">مكتبة وسائط حقيقية مرتبطة بالمناسبات. أضف روابط HTTPS للفيديوهات أو الصور المخزنة خارجيًا.</p>
      </div>

      {message && <div className={`rounded-lg border px-4 py-3 text-sm ${message.error ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'}`}>{message.text}</div>}

      <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-5">
        <h2 className="text-sm font-bold text-gray-200 mb-4">إضافة وسائط</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm text-gray-200">
            <option value="">اختر المناسبة</option>
            {(events as any[]).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value as 'video' | 'image')} className="rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm text-gray-200">
            <option value="video">فيديو</option><option value="image">صورة</option>
          </select>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="اسم الوسائط (اختياري)" className="rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm text-gray-200" />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." dir="ltr" className="rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm text-gray-200" />
        </div>
        <button onClick={addMedia} disabled={saving} className="mt-3 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 px-4 py-2.5 text-sm font-bold text-black">
          {saving ? 'جارٍ الحفظ...' : 'إضافة الوسائط'}
        </button>
      </div>

      <div className="flex items-center gap-3">
        <select value={eventId} onChange={(e) => setEventId(e.target.value)} className="rounded-lg border border-[#30363d] bg-[#161b22] px-3 py-2 text-sm text-gray-200">
          <option value="">كل المناسبات</option>
          {(events as any[]).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
        {user && <span className="text-xs text-gray-500">المعروض يقتصر تلقائيًا على المناسبات التي تملك صلاحية الوصول إليها.</span>}
      </div>

      {loading ? <div className="text-center py-16 text-gray-500">جارٍ تحميل الوسائط...</div> : media.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#30363d] bg-[#161b22] py-20">
          <span className="text-4xl mb-3">🎬</span>
          <p className="text-gray-300 font-medium">لا توجد وسائط</p>
          <p className="text-gray-500 text-sm mt-1">أضف أول فيديو أو صورة من النموذج أعلاه.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#30363d] bg-[#161b22] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-[#1c2333] text-gray-400 text-right">
                <th className="px-4 py-3 font-medium">المناسبة</th><th className="px-4 py-3 font-medium">النوع</th><th className="px-4 py-3 font-medium">العنوان</th><th className="px-4 py-3 font-medium">الرابط</th><th className="px-4 py-3 font-medium">إجراءات</th>
              </tr></thead>
              <tbody className="divide-y divide-[#30363d]">
                {media.map((m) => <tr key={m.id} className="hover:bg-[#1c2333]/50">
                  <td className="px-4 py-3 text-gray-200">{m.event?.name || (events as any[]).find((e) => e.id === m.eventId)?.name || '—'}</td>
                  <td className="px-4 py-3 text-gray-300">{m.type === 'image' ? 'صورة' : 'فيديو'}</td>
                  <td className="px-4 py-3 text-gray-300">{m.title || 'بدون عنوان'}</td>
                  <td className="px-4 py-3"><a href={m.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-xs" dir="ltr">فتح الرابط</a></td>
                  <td className="px-4 py-3"><button onClick={() => remove(m.id)} className="text-red-400 hover:text-red-300 text-xs font-semibold">حذف</button></td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
