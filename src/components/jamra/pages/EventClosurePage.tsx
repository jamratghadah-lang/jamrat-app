'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, useAppStore, escapeHtml } from '@/lib/store';

/* ==================== Toast ==================== */
function useToast() {
  const [toasts, setToasts] = useState<{ id: number; message: string; type: 'success' | 'error' | 'info' }[]>([]);
  const show = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  }, []);
  const ToastContainer = toasts.length > 0 ? (
    <div className="fixed bottom-6 left-6 z-[9999] flex flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className={`px-5 py-3 rounded-lg text-sm font-medium shadow-lg backdrop-blur animate-in slide-in-from-bottom-2 ${
          t.type === 'success' ? 'bg-emerald-500/90 text-white' : t.type === 'error' ? 'bg-red-500/90 text-white' : 'bg-amber-500/90 text-white'
        }`}>{t.message}</div>
      ))}
    </div>
  ) : null;
  return { show, ToastContainer };
}

/* ==================== Icons ==================== */
const IconCheck = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);

const IconX = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
);

const IconChevDown = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
);

const IconChevLeft = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
);

const IconClock = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
);

const IconUsers = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
);

const IconSend = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
);

const IconMoney = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>
);

const IconStar = ({ filled }: { filled?: boolean }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
);

const IconShield = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
);

const IconLock = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
);

const IconDownload = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
);

const IconClipboard = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /></svg>
);

const IconMessage = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
);

const IconImage = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
);

/* ==================== Types ==================== */
type TabKey = 'checklist' | 'attendance' | 'communication' | 'financial' | 'notes';

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  category: string;
  checked: boolean;
}

interface ClosureData {
  event: any;
  guests: any[];
  sendLogs: any[];
  checklist: ChecklistItem[];
  rating: number;
  notes: string;
  budgetEstimated: string;
  budgetActual: string;
}

/* ==================== Default Data ==================== */
const defaultChecklist: ChecklistItem[] = [
  { id: 'c1', label: 'تأكيد جميع الضيوف أو تحديد الحالة', description: 'تأكد من أن جميع الضيوف لديهم حالة تأكيد (مؤكد / غير مؤكد)', category: 'الضيوف', checked: false },
  { id: 'c2', label: 'تسجيل حضور جميع الحاضرين', description: 'تأكد من تسجيل حضور كل ضيف حضر المناسبة عبر QR أو يدوياً', category: 'الضيوف', checked: false },
  { id: 'c3', label: 'تحديد حالات الغائبين', description: 'حدد الضيوف المؤكدين الذين لم يحضروا كغائبين', category: 'الضيوف', checked: false },
  { id: 'c4', label: 'إرسال رسائل الدعوة', description: 'تأكد من إرسال رسائل الدعوة لجميع الضيوف', category: 'الإرسال', checked: false },
  { id: 'c5', label: 'إرسال التذكيرات', description: 'إرسال رسائل التذكير للضيوف قبل المناسبة', category: 'الإرسال', checked: false },
  { id: 'c6', label: 'مراجعة سجل الإرسال', description: 'راجع سجل الإرسال وتأكد من عدم وجود أخطاء غير محلولة', category: 'الإرسال', checked: false },
  { id: 'c7', label: 'تسليم الصور والفيديوهات', description: 'تأكد من استلام وتسليم جميع الصور والفيديوهات للعميل', category: 'المحتوى', checked: false },
  { id: 'c8', label: 'إرسال رسائل الشكر', description: 'إرسال رسائل شكر للضيوف بعد المناسبة', category: 'ما بعد المناسبة', checked: false },
  { id: 'c9', label: 'تسوية المدفوعات', description: 'تأكد من اكتمال جميع المدفوعات مع الموردين والعميل', category: 'المالية', checked: false },
  { id: 'c10', label: 'مراجعة التقرير النهائي', description: 'راجع التقرير النهائي للمناسبة بما يشمل الحضور والإرسال', category: 'المراجعة', checked: false },
  { id: 'c11', label: 'إضافة ملاحظات التقييم', description: 'أضف ملاحظات وتقييم للمناسبة لتحسين الخدمات مستقبلاً', category: 'المراجعة', checked: false },
  { id: 'c12', label: 'أرشفة المناسبة', description: 'بعد إتمام جميع الخطوات، أرشفة المناسبة للحفاظ على البيانات', category: 'الإغلاق', checked: false },
];

const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'checklist', label: 'قائمة التحقق', icon: <IconClipboard /> },
  { key: 'attendance', label: 'ملخص الحضور', icon: <IconUsers /> },
  { key: 'communication', label: 'ملخص الإرسال', icon: <IconSend /> },
  { key: 'financial', label: 'المالية', icon: <IconMoney /> },
  { key: 'notes', label: 'الملاحظات والتقييم', icon: <IconMessage /> },
];

/* ==================== Component ==================== */
export default function EventClosurePage() {
  const { events, setData } = useAppStore();
  const { show, ToastContainer } = useToast();

  const [activeEvents, setActiveEvents] = useState<any[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabKey>('checklist');
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showThankYouDialog, setShowThankYouDialog] = useState(false);
  const [thankYouSending, setThankYouSending] = useState(false);

  // Closure-specific state
  const [checklist, setChecklist] = useState<ChecklistItem[]>(defaultChecklist);
  const [guests, setGuests] = useState<any[]>([]);
  const [sendLogs, setSendLogs] = useState<any[]>([]);
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [closureNotes, setClosureNotes] = useState('');
  const [budgetEstimated, setBudgetEstimated] = useState('');
  const [budgetActual, setBudgetActual] = useState('');

  // Fetch active events on mount
  useEffect(() => {
    api.getEvents('status=active,ended').then((r: any) => {
      const data = Array.isArray(r) ? r : r.data || [];
      const filtered = data.filter((e: any) => e.status === 'active' || e.status === 'ended');
      setActiveEvents(filtered);
    });
  }, []);

  // When event is selected, load related data
  useEffect(() => {
    if (!selectedEventId) {
      setGuests([]);
      setSendLogs([]);
      return;
    }
    setLoading(true);
    Promise.all([
      api.getGuests(`eventId=${selectedEventId}`),
      api.getSendLogs(`eventId=${selectedEventId}`),
    ]).then(([gRes, sRes]: any[]) => {
      const gData = Array.isArray(gRes) ? gRes : gRes.data || [];
      const sData = Array.isArray(sRes) ? sRes : sRes.data || [];
      setGuests(gData);
      setSendLogs(sData);

      // Auto-check items based on data
      setChecklist((prev) => {
        const updated = [...prev];
        const totalGuests = gData.length;
        const confirmedCount = gData.filter((g: any) => g.confirmed === 'confirmed').length;
        const attendedCount = gData.filter((g: any) => g.attended === 'attended').length;
        const unconfirmedCount = gData.filter((g: any) => g.confirmed === 'unconfirmed' || g.confirmed === '').length;
        const absentCount = gData.filter((g: any) => g.confirmed === 'confirmed' && g.attended === 'absent').length;
        const sentCount = sData.filter((s: any) => s.status === 'sent').length;
        const inviteSent = sData.some((s: any) => s.type === 'invite' && s.status === 'sent');
        const reminderSent = sData.some((s: any) => s.type === 'reminder' && s.status === 'sent');
        const failedCount = sData.filter((s: any) => s.status === 'failed').length;

        // Auto-detect completed items
        if (totalGuests > 0 && unconfirmedCount === 0) updated[0] = { ...updated[0], checked: true };
        if (totalGuests > 0 && confirmedCount === attendedCount + absentCount && attendedCount > 0) updated[1] = { ...updated[1], checked: true };
        if (totalGuests > 0 && confirmedCount > 0 && confirmedCount === attendedCount + absentCount) updated[2] = { ...updated[2], checked: true };
        if (inviteSent) updated[3] = { ...updated[3], checked: true };
        if (reminderSent) updated[4] = { ...updated[4], checked: true };
        if (sData.length > 0 && failedCount === 0) updated[5] = { ...updated[5], checked: true };

        return updated;
      });
    }).finally(() => setLoading(false));
  }, [selectedEventId]);

  const selectedEvent = activeEvents.find((e) => e.id === selectedEventId);

  // Computed stats
  const totalGuests = guests.length;
  const confirmedGuests = guests.filter((g) => g.confirmed === 'confirmed').length;
  const unconfirmedGuests = guests.filter((g) => g.confirmed === 'unconfirmed' || g.confirmed === '').length;
  const attendedGuests = guests.filter((g) => g.attended === 'attended').length;
  const absentGuests = guests.filter((g) => g.confirmed === 'confirmed' && g.attended === 'absent').length;
  const totalCompanions = guests.reduce((sum, g) => sum + (g.companions || 0), 0);
  const totalAttendees = attendedGuests + guests.filter((g) => g.attended === 'attended').reduce((sum, g) => sum + (g.companions || 0), 0);

  const totalSent = sendLogs.length;
  const successfulSent = sendLogs.filter((s) => s.status === 'sent').length;
  const failedSent = sendLogs.filter((s) => s.status === 'failed').length;
  const inviteCount = sendLogs.filter((s) => s.type === 'invite').length;
  const reminderCount = sendLogs.filter((s) => s.type === 'reminder').length;
  const thankYouCount = sendLogs.filter((s) => s.type === 'thank_you').length;

  const checklistProgress = checklist.filter((c) => c.checked).length;
  const checklistTotal = checklist.length;
  const checklistPercent = checklistTotal > 0 ? Math.round((checklistProgress / checklistTotal) * 100) : 0;
  const allChecklistDone = checklistProgress === checklistTotal;

  const canClose = allChecklistDone && rating > 0 && selectedEventId;

  // Handlers
  const toggleChecklist = (id: string) => {
    if (closing) return;
    setChecklist((prev) => prev.map((c) => c.id === id ? { ...c, checked: !c.checked } : c));
  };

  const handleCloseEvent = async () => {
    if (!selectedEventId || !canClose) return;
    setClosing(true);
    try {
      await api.closeEvent(selectedEventId, {
        rating,
        notes: closureNotes,
        budgetEstimated,
        budgetActual,
        checklist: checklist.filter((c) => c.checked).map((c) => c.id),
      });
      // Remove from active list
      setActiveEvents((prev) => prev.filter((e) => e.id !== selectedEventId));
      setSelectedEventId('');
      setChecklist(defaultChecklist);
      setRating(0);
      setClosureNotes('');
      setBudgetEstimated('');
      setBudgetActual('');
      setShowConfirm(false);
      show('تم إغلاق المناسبة وأرشفتها بنجاح', 'success');
    } catch {
      show('حدث خطأ أثناء إغلاق المناسبة', 'error');
    } finally {
      setClosing(false);
    }
  };

  const handleSendThankYou = async () => {
    if (!selectedEventId) return;
    setThankYouSending(true);
    try {
      await api.sendMessages({
        eventId: selectedEventId,
        type: 'thank_you',
        channel: 'whatsapp',
        filter: 'attended',
      });
      setChecklist((prev) => prev.map((c) => c.id === 'c8' ? { ...c, checked: true } : c));
      setShowThankYouDialog(false);
      show('تم إرسال رسائل الشكر للحاضرين', 'success');
      // Refresh send logs
      api.getSendLogs(`eventId=${selectedEventId}`).then((r: any) => {
        const sData = Array.isArray(r) ? r : r.data || [];
        setSendLogs(sData);
      });
    } catch {
      show('حدث خطأ أثناء إرسال رسائل الشكر', 'error');
    } finally {
      setThankYouSending(false);
    }
  };

  const handleExportReport = () => {
    if (!selectedEvent || totalGuests === 0) return;
    const report = [
      `تقرير إغلاق المناسبة: ${selectedEvent.name}`,
      `العميل: ${selectedEvent.client}`,
      `التاريخ: ${selectedEvent.date} - ${selectedEvent.time}`,
      `المكان: ${selectedEvent.location}`,
      '─'.repeat(40),
      'ملخص الحضور:',
      `  إجمالي الضيوف: ${totalGuests}`,
      `  المؤكدون: ${confirmedGuests}`,
      `  الحاضرون: ${attendedGuests}`,
      `  الغائبون: ${absentGuests}`,
      `  المرافقون: ${totalCompanions}`,
      `  إجمالي الحضور: ${totalAttendees}`,
      '─'.repeat(40),
      'ملخص الإرسال:',
      `  إجمالي الرسائل: ${totalSent}`,
      `  الناجحة: ${successfulSent}`,
      `  الفاشلة: ${failedSent}`,
      `  الدعوات: ${inviteCount}`,
      `  التذكيرات: ${reminderCount}`,
      `  الشكر: ${thankYouCount}`,
      '─'.repeat(40),
      `قائمة التحقق: ${checklistProgress}/${checklistTotal} (${checklistPercent}%)`,
      `التقييم: ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}`,
      closureNotes ? `الملاحظات: ${closureNotes}` : '',
    ].filter(Boolean).join('\n');

    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `closure-report-${selectedEvent.name.replace(/\s+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    show('تم تصدير التقرير بنجاح', 'success');
  };

  /* ==================== Render Helpers ==================== */
  const renderProgressBar = (value: number, color: string, size: 'sm' | 'md' = 'sm') => {
    return (
      <div className={`rounded-full bg-[#0d1117] overflow-hidden ${size === 'sm' ? 'h-2' : 'h-3'}`}>
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    );
  };

  const renderStatCard = (label: string, value: string | number, icon: React.ReactNode, color: string, sub?: string) => (
    <div className={`rounded-xl border border-[#30363d] bg-gradient-to-br ${color} bg-[#161b22] p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-400">{icon}</span>
        <span className="text-2xl font-bold text-gray-100">{value}</span>
      </div>
      <p className="text-sm text-gray-400">{label}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );

  const renderChecklistCategory = (category: string, items: ChecklistItem[]) => {
    const categoryLabels: Record<string, string> = {
      'الضيوف': '👥 الضيوف',
      'الإرسال': '📨 الإرسال',
      'المحتوى': '🖼️ المحتوى',
      'ما بعد المناسبة': '💌 ما بعد المناسبة',
      'المالية': '💰 المالية',
      'المراجعة': '📋 المراجعة',
      'الإغلاق': '🔒 الإغلاق',
    };
    return (
      <div key={category} className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-300 pt-2 pb-1 border-b border-[#30363d]/50">
          {categoryLabels[category] || category}
        </h3>
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => toggleChecklist(item.id)}
            disabled={closing}
            className={`w-full flex items-start gap-3 p-3 rounded-lg border transition text-right group ${
              item.checked
                ? 'border-emerald-500/30 bg-emerald-500/5'
                : 'border-[#30363d] bg-[#0d1117]/50 hover:border-[#30363d] hover:bg-[#1c2333]/50'
            } ${closing ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition ${
              item.checked ? 'bg-emerald-500 border-emerald-500' : 'border-[#30363d] group-hover:border-gray-500'
            }`}>
              {item.checked && <span className="text-white"><IconCheck /></span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium transition ${item.checked ? 'text-emerald-400 line-through' : 'text-gray-200'}`}>{item.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
            </div>
          </button>
        ))}
      </div>
    );
  };

  /* ==================== Main Render ==================== */
  return (
    <div dir="rtl" className="space-y-6">
      {ToastContainer}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">إغلاق المناسبة</h1>
          <p className="text-sm text-gray-400 mt-1">سير عمل شامل لإنهاء المناسبة وأرشفتها بشكل منظم</p>
        </div>
        {selectedEventId && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportReport}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#30363d] text-gray-300 text-sm font-medium hover:bg-[#1c2333] transition"
            >
              <IconDownload />
              تصدير التقرير
            </button>
          </div>
        )}
      </div>

      {/* Event Selector */}
      <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-5">
        <label className="block text-sm font-medium text-gray-300 mb-2">اختر المناسبة للإغلاق</label>
        <div className="relative">
          <select
            value={selectedEventId}
            onChange={(e) => {
              setSelectedEventId(e.target.value);
              setChecklist(defaultChecklist);
              setRating(0);
              setClosureNotes('');
              setBudgetEstimated('');
              setBudgetActual('');
            }}
            className="w-full appearance-none rounded-lg border border-[#30363d] bg-[#0d1117] text-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500 transition cursor-pointer"
          >
            <option value="">-- اختر مناسبة --</option>
            {activeEvents.map((e) => (
              <option key={e.id} value={e.id}>
                {escapeHtml(e.name)} — {escapeHtml(e.client)} ({e.date})
              </option>
            ))}
          </select>
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
            <IconChevDown />
          </span>
        </div>
        {activeEvents.length === 0 && (
          <p className="text-xs text-gray-500 mt-2">لا توجد مناسبات نشطة أو منتهية للإغلاق</p>
        )}
      </div>

      {/* Event Info Banner */}
      {selectedEvent && (
        <div className="rounded-xl border border-amber-500/30 bg-gradient-to-l from-amber-500/5 to-transparent p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-400 flex-shrink-0">
              <IconShield />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-100 truncate">{escapeHtml(selectedEvent.name)}</h2>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-1.5 text-xs text-gray-400">
                <span>👤 {escapeHtml(selectedEvent.client)}</span>
                <span>📅 {selectedEvent.date} {selectedEvent.time ? `— ${selectedEvent.time}` : ''}</span>
                <span>📍 {escapeHtml(selectedEvent.location)}</span>
                <span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    selectedEvent.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {selectedEvent.status === 'active' ? 'نشطة' : 'منتهية'}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* No Event Selected */}
      {!selectedEventId && !loading && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#30363d] bg-[#161b22]/50 py-20">
          <div className="w-16 h-16 rounded-full bg-[#0d1117] flex items-center justify-center mb-4">
            <IconLock />
          </div>
          <p className="text-gray-400 text-sm">اختر مناسبة للبدء بسير عمل الإغلاق</p>
          <p className="text-gray-500 text-xs mt-1">ستظهر هنا جميع الخطوات المطلوبة لإغلاق المناسبة بنجاح</p>
        </div>
      )}

      {/* Main Content */}
      {selectedEventId && !loading && (
        <>
          {/* Overall Progress */}
          <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold ${
                  checklistPercent === 100 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {checklistPercent}%
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-200">تقدم الإغلاق</h3>
                  <p className="text-xs text-gray-500">{checklistProgress} من {checklistTotal} خطوة مكتملة</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {rating > 0 && (
                  <div className="flex items-center gap-1 text-amber-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <IconStar key={i} filled={i < rating} />
                    ))}
                  </div>
                )}
                {!allChecklistDone && (
                  <span className="rounded-full bg-amber-500/20 text-amber-400 px-2.5 py-1 text-[10px] font-semibold">قيد الإغلاق</span>
                )}
                {allChecklistDone && rating > 0 && (
                  <span className="rounded-full bg-emerald-500/20 text-emerald-400 px-2.5 py-1 text-[10px] font-semibold">جاهز للإغلاق</span>
                )}
              </div>
            </div>
            {renderProgressBar(checklistPercent, checklistPercent === 100 ? 'bg-emerald-500' : 'bg-amber-500', 'md')}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto pb-1 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium whitespace-nowrap transition border-b-2 ${
                  activeTab === tab.key
                    ? 'border-amber-500 text-amber-400 bg-[#161b22]'
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-[#161b22]/50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="rounded-b-xl rounded-tr-xl border border-[#30363d] bg-[#161b22] p-5 min-h-[400px]">
            {/* ===== CHECKLIST TAB ===== */}
            {activeTab === 'checklist' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-gray-100">قائمة التحقق للإغلاق</h2>
                  <button
                    onClick={() => setChecklist((prev) => prev.map((c) => ({ ...c, checked: true })))}
                    disabled={closing}
                    className="text-xs text-amber-400 hover:text-amber-300 font-medium transition disabled:opacity-50"
                  >
                    تحديد الكل
                  </button>
                </div>
                {(() => {
                  const categories = [...new Set(checklist.map((c) => c.category))];
                  return categories.map((cat) =>
                    renderChecklistCategory(cat, checklist.filter((c) => c.category === cat))
                  );
                })()}
              </div>
            )}

            {/* ===== ATTENDANCE TAB ===== */}
            {activeTab === 'attendance' && (
              <div className="space-y-6">
                <h2 className="text-base font-bold text-gray-100">ملخص الحضور النهائي</h2>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {renderStatCard('إجمالي الضيوف', totalGuests, <IconUsers />, 'from-amber-600/20 to-amber-800/5')}
                  {renderStatCard('المؤكدون', confirmedGuests, <span className="text-green-400">✓</span>, 'from-green-600/20 to-green-800/5',
                    totalGuests > 0 ? `${Math.round((confirmedGuests / totalGuests) * 100)}% من الإجمالي` : undefined
                  )}
                  {renderStatCard('غير المؤكدين', unconfirmedGuests, <span className="text-orange-400">?</span>, 'from-orange-600/20 to-orange-800/5')}
                  {renderStatCard('الحاضرون', attendedGuests, <span className="text-emerald-400">✓</span>, 'from-emerald-600/20 to-emerald-800/5',
                    confirmedGuests > 0 ? `${Math.round((attendedGuests / confirmedGuests) * 100)}% من المؤكدين` : undefined
                  )}
                  {renderStatCard('الغائبون', absentGuests, <span className="text-red-400">✗</span>, 'from-red-600/20 to-red-800/5')}
                  {renderStatCard('المرافقون', totalCompanions, <span className="text-teal-400">+</span>, 'from-teal-600/20 to-teal-800/5')}
                </div>

                {/* Total Attendees Highlight */}
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-center">
                  <p className="text-sm text-gray-400 mb-1">إجمالي الحضور الفعلي (ضيوف + مرافقون)</p>
                  <p className="text-4xl font-bold text-emerald-400">{totalAttendees}</p>
                </div>

                {/* Attendance Rate Bars */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-300">نسب الحضور</h3>
                  {[
                    { label: 'نسبة التأكيد', value: totalGuests > 0 ? (confirmedGuests / totalGuests) * 100 : 0, color: 'bg-amber-500' },
                    { label: 'نسبة الحضور من المؤكدين', value: confirmedGuests > 0 ? (attendedGuests / confirmedGuests) * 100 : 0, color: 'bg-emerald-500' },
                    { label: 'نسبة الغياب من المؤكدين', value: confirmedGuests > 0 ? (absentGuests / confirmedGuests) * 100 : 0, color: 'bg-red-500' },
                  ].map((bar) => (
                    <div key={bar.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">{bar.label}</span>
                        <span className="text-gray-200 font-semibold">{bar.value.toFixed(1)}%</span>
                      </div>
                      {renderProgressBar(bar.value, bar.color)}
                    </div>
                  ))}
                </div>

                {/* Guest List Summary */}
                {guests.length > 0 && (
                  <div className="rounded-xl border border-[#30363d] overflow-hidden">
                    <div className="bg-[#1c2333] px-4 py-3 border-b border-[#30363d]">
                      <h3 className="text-sm font-semibold text-gray-300">تفاصيل الضيوف</h3>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[#0d1117] text-gray-400 text-right text-xs">
                            <th className="px-4 py-2 font-medium">الاسم</th>
                            <th className="px-4 py-2 font-medium">الحالة</th>
                            <th className="px-4 py-2 font-medium">الحضور</th>
                            <th className="px-4 py-2 font-medium">مرافقين</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#30363d]">
                          {guests.map((g) => (
                            <tr key={g.id} className="hover:bg-[#1c2333]/50">
                              <td className="px-4 py-2 text-gray-200 text-xs">{escapeHtml(g.name)}</td>
                              <td className="px-4 py-2">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  g.confirmed === 'confirmed' ? 'bg-green-500/20 text-green-400' :
                                  g.confirmed === 'unconfirmed' ? 'bg-orange-500/20 text-orange-400' :
                                  'bg-gray-500/20 text-gray-400'
                                }`}>
                                  {g.confirmed === 'confirmed' ? 'مؤكد' : g.confirmed === 'unconfirmed' ? 'غير مؤكد' : '—'}
                                </span>
                              </td>
                              <td className="px-4 py-2">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  g.attended === 'attended' ? 'bg-emerald-500/20 text-emerald-400' :
                                  g.attended === 'absent' ? 'bg-red-500/20 text-red-400' :
                                  'bg-gray-500/20 text-gray-400'
                                }`}>
                                  {g.attended === 'attended' ? 'حضر' : g.attended === 'absent' ? 'غائب' : '—'}
                                </span>
                              </td>
                              <td className="px-4 py-2 text-gray-400 text-xs">{g.companions || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ===== COMMUNICATION TAB ===== */}
            {activeTab === 'communication' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-gray-100">ملخص الإرسال والاتصال</h2>
                  {selectedEventId && (
                    <button
                      onClick={() => setShowThankYouDialog(true)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition"
                    >
                      <IconSend />
                      إرسال رسائل شكر
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {renderStatCard('إجمالي الرسائل', totalSent, <IconSend />, 'from-amber-600/20 to-amber-800/5')}
                  {renderStatCard('رسائل ناجحة', successfulSent, <span className="text-emerald-400">✓</span>, 'from-emerald-600/20 to-emerald-800/5',
                    totalSent > 0 ? `${Math.round((successfulSent / totalSent) * 100)}%` : undefined
                  )}
                  {renderStatCard('رسائل فاشلة', failedSent, <span className="text-red-400">✗</span>, 'from-red-600/20 to-red-800/5')}
                  {renderStatCard('الدعوات', inviteCount, <span className="text-sky-400">💌</span>, 'from-sky-600/20 to-sky-800/5')}
                  {renderStatCard('التذكيرات', reminderCount, <span className="text-orange-400">⏰</span>, 'from-orange-600/20 to-orange-800/5')}
                  {renderStatCard('رسائل الشكر', thankYouCount, <span className="text-pink-400">💝</span>, 'from-pink-600/20 to-pink-800/5')}
                </div>

                {/* Send Rate Bars */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-300">معدلات النجاح</h3>
                  {[
                    { label: 'معدل التسليم', value: totalSent > 0 ? (successfulSent / totalSent) * 100 : 0, color: 'bg-emerald-500' },
                    { label: 'معدل الفشل', value: totalSent > 0 ? (failedSent / totalSent) * 100 : 0, color: 'bg-red-500' },
                  ].map((bar) => (
                    <div key={bar.label} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-400">{bar.label}</span>
                        <span className="text-gray-200 font-semibold">{bar.value.toFixed(1)}%</span>
                      </div>
                      {renderProgressBar(bar.value, bar.color)}
                    </div>
                  ))}
                </div>

                {/* Send Log Table */}
                {sendLogs.length > 0 && (
                  <div className="rounded-xl border border-[#30363d] overflow-hidden">
                    <div className="bg-[#1c2333] px-4 py-3 border-b border-[#30363d]">
                      <h3 className="text-sm font-semibold text-gray-300">سجل الرسائل</h3>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[#0d1117] text-gray-400 text-right text-xs">
                            <th className="px-4 py-2 font-medium">المستلم</th>
                            <th className="px-4 py-2 font-medium">النوع</th>
                            <th className="px-4 py-2 font-medium">القناة</th>
                            <th className="px-4 py-2 font-medium">الحالة</th>
                            <th className="px-4 py-2 font-medium">الوقت</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#30363d]">
                          {sendLogs.map((s) => {
                            const typeLabels: Record<string, string> = { invite: 'دعوة', reminder: 'تذكير', final_reminder: 'تذكير نهائي', thank_you: 'شكر' };
                            const channelLabels: Record<string, string> = { whatsapp: 'واتساب', email: 'بريد', both: 'كلاهما' };
                            const time = s.time ? new Date(s.time).toLocaleString('ar-SA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
                            return (
                              <tr key={s.id} className="hover:bg-[#1c2333]/50">
                                <td className="px-4 py-2 text-gray-200 text-xs">{escapeHtml(s.recipient)}</td>
                                <td className="px-4 py-2 text-gray-300 text-xs">{typeLabels[s.type] || s.type}</td>
                                <td className="px-4 py-2 text-gray-300 text-xs">{channelLabels[s.channel] || s.channel}</td>
                                <td className="px-4 py-2">
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    s.status === 'sent' ? 'bg-emerald-500/20 text-emerald-400' :
                                    s.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                                    'bg-amber-500/20 text-amber-400'
                                  }`}>
                                    {s.status === 'sent' ? 'تم الإرسال' : s.status === 'failed' ? 'فشل' : 'قيد الانتظار'}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-gray-500 text-xs">{time}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {sendLogs.length === 0 && (
                  <div className="text-center py-8 text-gray-500 text-sm">لا توجد رسائل مسجلة لهذه المناسبة</div>
                )}
              </div>
            )}

            {/* ===== FINANCIAL TAB ===== */}
            {activeTab === 'financial' && (
              <div className="space-y-6">
                <h2 className="text-base font-bold text-gray-100">المالية والميزانية</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">الميزانية المقدرة (ر.س)</label>
                    <input
                      type="number"
                      value={budgetEstimated}
                      onChange={(e) => setBudgetEstimated(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] text-gray-200 px-4 py-2.5 text-sm outline-none focus:border-amber-500 transition"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-300">الميزانية الفعلية (ر.س)</label>
                    <input
                      type="number"
                      value={budgetActual}
                      onChange={(e) => setBudgetActual(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] text-gray-200 px-4 py-2.5 text-sm outline-none focus:border-amber-500 transition"
                    />
                  </div>
                </div>

                {/* Budget Comparison */}
                {budgetEstimated && budgetActual && (
                  <div className="rounded-xl border border-[#30363d] bg-[#0d1117] p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-gray-300">مقارنة الميزانية</h3>
                    {(() => {
                      const est = parseFloat(budgetEstimated) || 0;
                      const act = parseFloat(budgetActual) || 0;
                      const diff = act - est;
                      const diffPercent = est > 0 ? ((diff / est) * 100) : 0;
                      const isOver = diff > 0;
                      return (
                        <>
                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                              <p className="text-xs text-gray-500">المقدرة</p>
                              <p className="text-lg font-bold text-gray-200">{est.toLocaleString('ar-SA')}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">الفعلية</p>
                              <p className="text-lg font-bold text-gray-200">{act.toLocaleString('ar-SA')}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">الفرق</p>
                              <p className={`text-lg font-bold ${isOver ? 'text-red-400' : 'text-emerald-400'}`}>
                                {isOver ? '+' : ''}{diff.toLocaleString('ar-SA')}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-400">نسبة الانحراف</span>
                              <span className={`font-semibold ${isOver ? 'text-red-400' : 'text-emerald-400'}`}>
                                {isOver ? '+' : ''}{diffPercent.toFixed(1)}%
                              </span>
                            </div>
                            {renderProgressBar(Math.min(Math.abs(diffPercent), 100), isOver ? 'bg-red-500' : 'bg-emerald-500')}
                          </div>
                          {/* Visual bar comparison */}
                          <div className="space-y-2 pt-2">
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-gray-500 w-16">المقدرة</span>
                              <div className="flex-1 h-6 rounded bg-[#161b22] overflow-hidden relative">
                                <div className="h-full rounded bg-amber-500/40 flex items-center justify-end px-2" style={{ width: `${Math.min(100, (est / Math.max(est, act)) * 100)}%` }}>
                                  {est > 0 && <span className="text-[10px] text-amber-300 font-medium">{est.toLocaleString('ar-SA')}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-gray-500 w-16">الفعلية</span>
                              <div className="flex-1 h-6 rounded bg-[#161b22] overflow-hidden relative">
                                <div className={`h-full rounded flex items-center justify-end px-2 ${isOver ? 'bg-red-500/40' : 'bg-emerald-500/40'}`} style={{ width: `${Math.min(100, (act / Math.max(est, act)) * 100)}%` }}>
                                  {act > 0 && <span className={`text-[10px] font-medium ${isOver ? 'text-red-300' : 'text-emerald-300'}`}>{act.toLocaleString('ar-SA')}</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}

                {/* Quick financial notes */}
                <div className="rounded-xl border border-[#30363d] bg-[#0d1117] p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-300">ملاحظات مالية</h3>
                  <textarea
                    value={closureNotes.includes('[مالي]') ? closureNotes.split('[مالي]').pop()?.split('[')[0]?.trim() || '' : ''}
                    onChange={(e) => {
                      const existingNotes = closureNotes.replace(/\[مالي\][^[]*/, '').trim();
                      setClosureNotes(e.target.value ? `[مالي] ${e.target.value} ${existingNotes ? `[${existingNotes}]` : ''}` : existingNotes);
                    }}
                    placeholder="أضف ملاحظات حول المدفوعات، الموردين، والمصاريف..."
                    rows={3}
                    className="w-full rounded-lg border border-[#30363d] bg-[#161b22] text-gray-200 px-4 py-2.5 text-sm outline-none focus:border-amber-500 transition resize-none"
                  />
                </div>

                {/* Cost per guest calculation */}
                {budgetActual && totalAttendees > 0 && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-center">
                    <p className="text-sm text-gray-400">تكلفة الضيف الواحد (بناءً على الحضور الفعلي)</p>
                    <p className="text-3xl font-bold text-amber-400 mt-1">
                      {(parseFloat(budgetActual) / totalAttendees).toFixed(2)} <span className="text-lg text-gray-400">ر.س</span>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ===== NOTES & RATING TAB ===== */}
            {activeTab === 'notes' && (
              <div className="space-y-6">
                <h2 className="text-base font-bold text-gray-100">الملاحظات والتقييم</h2>

                {/* Star Rating */}
                <div className="rounded-xl border border-[#30363d] bg-[#0d1117] p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-300">تقييم المناسبة</h3>
                  <p className="text-xs text-gray-500">كيف كانت تجربة إدارة هذه المناسبة؟</p>
                  <div className="flex items-center gap-1 pt-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setRating(i + 1)}
                        onMouseEnter={() => setHoveredStar(i + 1)}
                        onMouseLeave={() => setHoveredStar(0)}
                        className={`transition-transform hover:scale-110 ${rating > i ? 'text-amber-400' : 'text-gray-600'}`}
                      >
                        <IconStar filled={i < (hoveredStar || rating)} />
                      </button>
                    ))}
                    <span className="text-sm text-gray-400 mr-2">
                      {rating === 5 ? 'ممتاز' : rating === 4 ? 'جيد جداً' : rating === 3 ? 'جيد' : rating === 2 ? 'مقبول' : rating === 1 ? 'ضعيف' : 'لم يتم التقييم'}
                    </span>
                  </div>
                </div>

                {/* General Notes */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">ملاحظات عامة</label>
                  <textarea
                    value={closureNotes}
                    onChange={(e) => setClosureNotes(e.target.value)}
                    placeholder="أضف ملاحظاتك حول المناسبة، ما تم بشكل جيد، وما يمكن تحسينه..."
                    rows={5}
                    className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] text-gray-200 px-4 py-3 text-sm outline-none focus:border-amber-500 transition resize-none"
                  />
                </div>

                {/* Quick Feedback Tags */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-300">نقاط سريعة</label>
                  <div className="flex flex-wrap gap-2">
                    {['تنظيم ممتاز', 'تأخر في التنفيذ', 'مشاكل تقنية', 'رضا العميل', 'مشاكل في المكان', 'أداء جيد للفريق', 'تحتاج تحسين', 'عميل متعاون'].map((tag) => {
                      const isActive = closureNotes.includes(tag);
                      return (
                        <button
                          key={tag}
                          onClick={() => {
                            if (isActive) {
                              setClosureNotes((prev) => prev.replace(tag, '').replace(/  +/g, ' '));
                            } else {
                              setClosureNotes((prev) => prev ? `${prev} ${tag}` : tag);
                            }
                          }}
                          className={`rounded-full px-3 py-1.5 text-xs font-medium border transition ${
                            isActive
                              ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                              : 'border-[#30363d] text-gray-400 hover:border-gray-500 hover:text-gray-300'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Event Photos/Videos Delivery Status */}
                <div className="rounded-xl border border-[#30363d] bg-[#0d1117] p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <IconImage />
                    <h3 className="text-sm font-semibold text-gray-300">حالة تسليم المحتوى</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'الصور', id: 'photos' },
                      { label: 'الفيديو الرئيسي', id: 'video' },
                      { label: 'فيديو هايلايت', id: 'highlight' },
                    ].map((item) => {
                      const checkId = item.id === 'photos' ? 'c7' : '';
                      const isChecked = checkId ? checklist.find((c) => c.id === checkId)?.checked : false;
                      return (
                        <div key={item.id} className="rounded-lg border border-[#30363d] p-3 flex items-center justify-between">
                          <span className="text-xs text-gray-400">{item.label}</span>
                          <div className={`w-3 h-3 rounded-full ${isChecked ? 'bg-emerald-500' : 'bg-gray-600'}`} />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Timeline Summary */}
                <div className="rounded-xl border border-[#30363d] bg-[#0d1117] p-5 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-300">الجدول الزمني</h3>
                  <div className="relative space-y-4 pr-6">
                    <div className="absolute right-2 top-1 bottom-1 w-0.5 bg-[#30363d]" />
                    {selectedEvent && [
                      { label: 'إنشاء المناسبة', date: selectedEvent.createdAt, done: true },
                      { label: 'موعد المناسبة', date: selectedEvent.date, done: true },
                      { label: 'بدء عملية الإغلاق', date: new Date().toISOString(), done: false },
                    ].map((step, i) => (
                      <div key={i} className="relative flex items-center gap-3">
                        <div className={`absolute -right-[22px] w-3 h-3 rounded-full border-2 ${step.done ? 'bg-emerald-500 border-emerald-500' : 'bg-amber-500 border-amber-500'}`} />
                        <div>
                          <p className="text-xs text-gray-300 font-medium">{step.label}</p>
                          <p className="text-[10px] text-gray-500">
                            {new Date(step.date).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Action Bar */}
          <div className="sticky bottom-0 left-0 right-0 bg-[#0d1117]/90 backdrop-blur-sm border border-[#30363d] rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${canClose ? 'bg-emerald-500/20' : 'bg-gray-500/20'}`}>
                <IconShield />
              </div>
              <div>
                <p className={`text-sm font-semibold ${canClose ? 'text-emerald-400' : 'text-gray-400'}`}>
                  {canClose ? 'جاهز للإغلاق النهائي' : 'غير جاهز للإغلاق'}
                </p>
                <p className="text-[10px] text-gray-500">
                  {!allChecklistDone && `قائمة التحقق: ${checklistProgress}/${checklistTotal}`}
                  {allChecklistDone && rating === 0 && 'يرجى إضافة تقييم للمناسبة'}
                  {allChecklistDone && rating > 0 && !selectedEventId && 'يرجى اختيار مناسبة'}
                  {allChecklistDone && rating > 0 && selectedEventId && 'جميع المتطلبات مكتملة'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={!canClose || closing}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition ${
                canClose
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              <IconLock />
              {closing ? 'جارٍ الإغلاق...' : 'إغلاق وأرشفة المناسبة'}
            </button>
          </div>
        </>
      )}

      {/* ===== Confirmation Dialog ===== */}
      {showConfirm && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowConfirm(false)} />
          <div className="relative bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-100">تأكيد إغلاق المناسبة</h3>
              <button onClick={() => setShowConfirm(false)} className="text-gray-400 hover:text-gray-200 transition">
                <IconX />
              </button>
            </div>

            <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-4 space-y-2">
              <div className="flex items-center gap-2 text-red-400">
                <svg xmlns="http://www.w3.org/2000/svg" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                <span className="text-sm font-semibold">هذا الإجراء لا يمكن التراجع عنه</span>
              </div>
              <p className="text-xs text-red-400/80">سيتم أرشفة المناسبة ونقلها للأرشيف. لن تتمكن من تعديل البيانات بعد الإغلاق.</p>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">المناسبة:</span>
                <span className="text-gray-200 font-medium">{selectedEvent ? escapeHtml(selectedEvent.name) : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">العميل:</span>
                <span className="text-gray-200 font-medium">{selectedEvent ? escapeHtml(selectedEvent.client) : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">الضيوف:</span>
                <span className="text-gray-200 font-medium">{totalGuests} | حاضر: {attendedGuests}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">التقييم:</span>
                <span className="text-amber-400">{'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">قائمة التحقق:</span>
                <span className="text-emerald-400 font-medium">{checklistProgress}/{checklistTotal}</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-300">اكتب &quot;إغلاق&quot; للتأكيد</label>
              <input
                id="confirm-close-input"
                type="text"
                placeholder='إغلاق'
                className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] text-gray-200 px-4 py-2.5 text-sm outline-none focus:border-red-500 transition text-center"
                onChange={(e) => {
                  const btn = document.getElementById('confirm-close-btn') as HTMLButtonElement;
                  if (btn) btn.disabled = e.target.value !== 'إغلاق';
                }}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-[#30363d] text-gray-300 text-sm font-medium hover:bg-[#1c2333] transition"
              >
                إلغاء
              </button>
              <button
                id="confirm-close-btn"
                onClick={handleCloseEvent}
                disabled={true}
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition ${
                  closing
                    ? 'bg-red-600/50 text-red-200 cursor-wait'
                    : 'bg-red-600 hover:bg-red-700 text-white cursor-pointer disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed'
                }`}
              >
                {closing ? 'جارٍ الإغلاق...' : 'تأكيد الإغلاق'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Thank You Dialog ===== */}
      {showThankYouDialog && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowThankYouDialog(false)} />
          <div className="relative bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-100">إرسال رسائل شكر</h3>
              <button onClick={() => setShowThankYouDialog(false)} className="text-gray-400 hover:text-gray-200 transition">
                <IconX />
              </button>
            </div>

            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4">
              <p className="text-sm text-amber-300">سيتم إرسال رسائل شكر لجميع الضيوف الحاضرين عبر واتساب.</p>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">عدد الحاضرين:</span>
                <span className="text-gray-200 font-medium">{attendedGuests}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">القناة:</span>
                <span className="text-gray-200 font-medium">واتساب</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowThankYouDialog(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-[#30363d] text-gray-300 text-sm font-medium hover:bg-[#1c2333] transition"
              >
                إلغاء
              </button>
              <button
                onClick={handleSendThankYou}
                disabled={thankYouSending}
                className="flex-1 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold transition disabled:opacity-50"
              >
                {thankYouSending ? 'جارٍ الإرسال...' : 'إرسال الآن'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
