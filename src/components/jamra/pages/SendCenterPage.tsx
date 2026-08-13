'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api, useAppStore, escapeHtml } from '@/lib/store';

const inputCls = 'w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-amber-500 transition';
const labelCls = 'text-xs font-semibold text-gray-400 mb-1.5 block';

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

const recipientOptions = [
  { value: 'all', label: 'جميع الضيوف', desc: 'كل المدعوين' },
  { value: 'confirmed', label: 'المؤكدون', desc: 'أكدوا حضورهم' },
  { value: 'unconfirmed', label: 'غير المؤكدين', desc: 'لم يؤكدوا' },
  { value: 'attended', label: 'الحاضرون', desc: 'سجلوا دخولهم' },
  { value: 'absent', label: 'غير الحاضرين', desc: 'أكدوا ولم يحضروا' },
  { value: 'manual', label: 'ضيوف محددون', desc: 'اختر يدوياً' },
];

const contentTypeOptions = [
  { value: 'text', label: 'نص' },
  { value: 'image', label: 'صورة' },
  { value: 'video', label: 'فيديو' },
  { value: 'text_image', label: 'نص + صورة' },
  { value: 'text_video', label: 'نص + فيديو' },
  { value: 'image_video', label: 'صورة + فيديو' },
  { value: 'text_image_video', label: 'نص + صورة + فيديو' },
];

export default function SendCenterPage() {
  const { events, guests, templates, setData } = useAppStore();
  const { show, ToastContainer } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedGuests, setSelectedGuests] = useState<string[]>([]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [form, setForm] = useState({
    eventId: '', channel: '', recipientType: '', contentType: '',
    templateId: '', message: '',
    scheduleType: 'now', scheduleDate: '', scheduleTime: '',
  });

  useEffect(() => {
    api.getEvents().then((r: any) => setData('events', r.data || r));
    api.getTemplates().then((r: any) => setData('templates', r.data || r));
    api.getGuests().then((r: any) => setData('guests', r.data || r));
  }, [setData]);

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const filteredGuests = form.eventId
    ? guests.filter((g: any) => g.eventId === form.eventId || !g.eventId)
    : guests;

  const handleTemplateSelect = (tid: string) => {
    set('templateId', tid);
    if (!tid) return;
    const tpl = templates.find((t: any) => t.id === tid);
    if (tpl) setForm((p) => ({ ...p, message: tpl.text, templateId: tid }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setImagePreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const toggleGuest = (id: string) => {
    setSelectedGuests((p) => p.includes(id) ? p.filter((g) => g !== id) : [...p, id]);
  };

  const getRecipientCount = () => {
    if (!form.eventId) return 0;
    switch (form.recipientType) {
      case 'all': return filteredGuests.length;
      case 'confirmed': return filteredGuests.filter((g: any) => g.confirmed === 'confirmed').length;
      case 'unconfirmed': return filteredGuests.filter((g: any) => g.confirmed !== 'confirmed').length;
      case 'attended': return filteredGuests.filter((g: any) => g.attended === 'attended').length;
      case 'absent': return filteredGuests.filter((g: any) => g.confirmed === 'confirmed' && g.attended !== 'attended').length;
      case 'manual': return selectedGuests.length;
      default: return 0;
    }
  };

  const handleSend = async () => {
    if (!form.eventId || !form.channel || !form.recipientType || !form.contentType) {
      show('يرجى ملء جميع الحقول المطلوبة', 'error'); return;
    }
    if (form.recipientType === 'manual' && selectedGuests.length === 0) {
      show('يرجى اختيار ضيف واحد على الأقل', 'error'); return;
    }
    setSending(true);
    try {
      const payload: Record<string, unknown> = { eventId: form.eventId, channel: form.channel, recipientType: form.recipientType, contentType: form.contentType, message: form.message, guestIds: form.recipientType === 'manual' ? selectedGuests : undefined };
      if (form.scheduleType === 'scheduled' && form.scheduleDate && form.scheduleTime) {
        payload.scheduleAt = form.scheduleDate + 'T' + form.scheduleTime + ':00';
      }
      await api.sendMessages(payload);
      show(form.scheduleType === 'scheduled'
        ? 'تم جدولة الإرسال بنجاح إلى ' + getRecipientCount() + ' مستلم'
        : 'تم بدء الإرسال بنجاح إلى ' + getRecipientCount() + ' مستلم', 'success');
    } catch { show('حدث خطأ أثناء الإرسال', 'error'); }
    setSending(false);
  };

  const recipientCount = getRecipientCount();
  const needsMessage = form.contentType === 'text' || form.contentType?.startsWith('text_');
  const needsImage = form.contentType === 'image' || form.contentType?.includes('image');
  const needsVideo = form.contentType === 'video' || form.contentType?.includes('video');

  return (
    <div dir="rtl" className="space-y-6">
      {ToastContainer}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">مركز الإرسال</h1>
          <p className="text-sm text-gray-500 mt-1">مركز واحد للتحكم بجميع عمليات الإرسال</p>
        </div>
        <button onClick={() => setShowPreview(!showPreview)} className="text-xs px-3 py-1.5 rounded-lg border border-[#30363d] text-gray-400 hover:text-amber-400 hover:border-amber-500/30 transition">
          {showPreview ? 'إخفاء المعاينة' : 'معاينة'}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-5">
          {/* Event & Channel */}
          <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-200">المناسبة والقناة</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={labelCls}>المناسبة *</label>
                <select value={form.eventId} onChange={(e) => { set('eventId', e.target.value); setSelectedGuests([]); }} className={inputCls}>
                  <option value="">اختر المناسبة...</option>
                  {events.map((e: any) => <option key={e.id} value={e.id}>{escapeHtml(e.name)}</option>)}
                </select></div>
              <div><label className={labelCls}>قناة الإرسال *</label>
                <select value={form.channel} onChange={(e) => set('channel', e.target.value)} className={inputCls}>
                  <option value="">اختر القناة...</option>
                  <option value="whatsapp">واتساب</option>
                  <option value="email">إيميل</option>
                  <option value="both">واتساب + إيميل</option>
                </select></div>
            </div>
          </div>

          {/* Recipients */}
          <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-200">تحديد المستلمين</h2>
              <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">{recipientCount} مستلم</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {recipientOptions.map((opt) => (
                <button key={opt.value} onClick={() => set('recipientType', opt.value)}
                  className={"p-3 rounded-lg border text-right transition text-xs " + (form.recipientType === opt.value ? "border-amber-500 bg-amber-500/10 text-amber-400" : "border-[#30363d] bg-[#0d1117] text-gray-400 hover:border-gray-600")}>
                  <p className="font-medium">{opt.label}</p>
                  <p className="text-[10px] opacity-60">{opt.desc}</p>
                </button>
              ))}
            </div>
            {form.recipientType === 'manual' && (
              <div className="border-t border-[#30363d] pt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-400">اختر الضيوف ({selectedGuests.length} محدد)</p>
                  <button onClick={() => setSelectedGuests(filteredGuests.map((g: any) => g.id))} className="text-[10px] px-2 py-1 rounded border border-[#30363d] text-gray-500 hover:text-gray-300">تحديد الكل</button>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-[#30363d] bg-[#0d1117]">
                  {filteredGuests.map((g: any) => (
                    <label key={g.id} className={"flex items-center gap-3 px-3 py-2 border-b border-[#30363d]/50 cursor-pointer hover:bg-white/[0.02] " + (selectedGuests.includes(g.id) ? "bg-amber-500/5" : "")}>
                      <input type="checkbox" checked={selectedGuests.includes(g.id)} onChange={() => toggleGuest(g.id)} className="accent-amber-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-200 truncate">{escapeHtml(g.name)}</p>
                        <p className="text-[10px] text-gray-500" dir="ltr">{g.phone}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Content Type */}
          <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-200">تحديد المحتوى</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {contentTypeOptions.map((opt) => (
                <button key={opt.value} onClick={() => set('contentType', opt.value)}
                  className={"p-3 rounded-lg border text-center transition text-xs " + (form.contentType === opt.value ? "border-amber-500 bg-amber-500/10 text-amber-400" : "border-[#30363d] bg-[#0d1117] text-gray-400 hover:border-gray-600")}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message & Attachments */}
          <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-200">المحتوى</h2>
            <div><label className={labelCls}>نموذج (اختياري)</label>
              <select value={form.templateId} onChange={(e) => handleTemplateSelect(e.target.value)} className={inputCls}>
                <option value="">اختر نموذج...</option>
                {templates.map((t: any) => <option key={t.id} value={t.id}>{escapeHtml(t.name)}</option>)}
              </select></div>
            {needsMessage && (
              <div><label className={labelCls}>الرسالة</label>
                <textarea value={form.message} onChange={(e) => set('message', e.target.value)} rows={6} className={inputCls + ' resize-none'} placeholder="اكتب الرسالة هنا..." />
                <div className="flex gap-2 mt-2 flex-wrap">
                  {['{{اسم}}', '{{المناسبة}}', '{{التاريخ}}', '{{الوقت}}', '{{المكان}}', '{{الرابط}}'].map((tag) => (
                    <button key={tag} onClick={() => set('message', form.message + ' ' + tag)} className="text-[10px] px-2 py-0.5 rounded bg-[#0d1117] border border-[#30363d] text-gray-500 hover:text-amber-400 hover:border-amber-500/30 transition font-mono">{tag}</button>
                  ))}
                </div></div>
            )}
            {needsImage && (
              <div><label className={labelCls}>صورة</label>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                {imagePreview ? (
                  <div className="relative inline-block">
                    <img src={imagePreview} alt="preview" className="max-h-40 rounded-lg border border-[#30363d]" />
                    <button onClick={() => { setImagePreview(null); if (fileRef.current) fileRef.current.value = ''; }} className="absolute top-1 left-1 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">x</button>
                  </div>
                ) : (
                  <button onClick={() => fileRef.current?.click()} className="w-full py-8 rounded-lg border-2 border-dashed border-[#30363d] text-gray-500 hover:border-amber-500/50 hover:text-amber-400 transition text-sm">+ اضغط لرفع صورة</button>
                )}</div>
            )}
            {needsVideo && (
              <div><label className={labelCls}>فيديو</label>
                <select className={inputCls}><option value="">اختر فيديو...</option></select>
              </div>
            )}
          </div>

          {/* Schedule */}
          <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-200">التوقيت</h2>
            <div className="flex gap-2">
              {['now', 'scheduled'].map((type) => (
                <button key={type} onClick={() => set('scheduleType', type)}
                  className={"flex-1 py-2.5 rounded-lg border text-xs font-medium transition " + (form.scheduleType === type ? "border-amber-500 bg-amber-500/10 text-amber-400" : "border-[#30363d] text-gray-400 hover:border-gray-600")}>
                  {type === 'now' ? 'إرسال فوري' : 'بتاريخ محدد'}
                </button>
              ))}
            </div>
            {form.scheduleType === 'scheduled' && (
              <div className="grid grid-cols-2 gap-4">
                <div><label className={labelCls}>التاريخ</label><input type="date" value={form.scheduleDate} onChange={(e) => set('scheduleDate', e.target.value)} className={inputCls} dir="ltr" /></div>
                <div><label className={labelCls}>الوقت</label><input type="time" value={form.scheduleTime} onChange={(e) => set('scheduleTime', e.target.value)} className={inputCls} dir="ltr" /></div>
              </div>
            )}
          </div>

          <button onClick={handleSend} disabled={sending} className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-amber-500 to-amber-700 py-3.5 text-sm font-bold text-[#0d1117] hover:shadow-lg hover:shadow-amber-500/25 transition disabled:opacity-50">
            {sending && <span className="animate-spin">⟳</span>}
            {form.scheduleType === 'now' ? 'إرسال الآن' : 'جدولة الإرسال'} إلى {recipientCount} مستلم
          </button>
        </div>

        {showPreview && (
          <div className="space-y-5">
            <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-5 sticky top-4">
              <h2 className="text-sm font-semibold text-gray-200 mb-4">معاينة الرسالة</h2>
              {form.channel !== 'email' && (
                <div className="mb-4">
                  <p className="text-[10px] text-gray-500 mb-2">واتساب</p>
                  <div className="rounded-xl rounded-tr-none bg-[#005c4b] p-3 max-w-[300px]">
                    {needsImage && imagePreview && <img src={imagePreview} alt="" className="w-full rounded-lg mb-2" />}
                    {needsMessage && form.message && <p className="text-sm text-white whitespace-pre-wrap">{form.message}</p>}
                    {needsVideo && <div className="bg-black/30 rounded-lg p-6 text-center text-gray-400 text-xs">فيديو مرفق</div>}
                    <p className="text-[10px] text-emerald-200/50 text-left mt-1" dir="ltr">12:00 PM</p>
                  </div>
                </div>
              )}
              {form.channel !== 'whatsapp' && (
                <div>
                  <p className="text-[10px] text-gray-500 mb-2">بريد إلكتروني</p>
                  <div className="rounded-xl border border-[#30363d] bg-[#0d1117] p-4">
                    <div className="border-b border-[#30363d] pb-3 mb-3">
                      <p className="text-xs text-gray-400">إلى: guest@example.com</p>
                      <p className="text-xs text-gray-400">الموضوع: دعوة</p>
                    </div>
                    {needsMessage && form.message && <p className="text-sm text-gray-200 whitespace-pre-wrap">{form.message}</p>}
                    {needsVideo && <div className="bg-[#161b22] rounded-lg p-6 text-center text-gray-400 text-xs border border-[#30363d]">فيديو مرفق</div>}
                  </div>
                </div>
              )}
              <div className="mt-4 pt-4 border-t border-[#30363d] space-y-2">
                <div className="flex justify-between text-xs"><span className="text-gray-500">القناة</span><span className="text-gray-200">{form.channel === 'both' ? 'واتساب + إيميل' : form.channel === 'whatsapp' ? 'واتساب' : form.channel === 'email' ? 'إيميل' : '—'}</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-500">عدد المستلمين</span><span className="text-gray-200">{recipientCount}</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-500">نوع المحتوى</span><span className="text-gray-200">{contentTypeOptions.find((c) => c.value === form.contentType)?.label || '—'}</span></div>
                <div className="flex justify-between text-xs"><span className="text-gray-500">التوقيت</span><span className="text-gray-200">{form.scheduleType === 'now' ? 'فوري' : 'مجدول'}</span></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
