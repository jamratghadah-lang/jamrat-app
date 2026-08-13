'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useAppStore, escapeHtml } from '@/lib/store';

/* ======================== Types ======================== */

type QRPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'bottom-center' | 'center';
type GuestNamePosition = 'top' | 'below-title' | 'below-subtitle' | 'body-start' | 'bottom';
type BackgroundType = 'solid' | 'gradient' | 'image';
type GradientDirection = 'to-bottom' | 'to-top' | 'to-right' | 'to-left' | 'to-br' | 'to-bl' | 'to-tr' | 'to-tl';

interface CardDesign {
  title: string;
  subtitle: string;
  body: string;
  guestName: string;
  guestNamePosition: GuestNamePosition;
  showGuestName: boolean;

  backgroundType: BackgroundType;
  backgroundColor: string;
  gradientColor1: string;
  gradientColor2: string;
  gradientDirection: GradientDirection;
  backgroundImage: string;

  showQR: boolean;
  qrPosition: QRPosition;
  qrSize: number;

  textColor: string;
  accentColor: string;

  titleFontSize: number;
  subtitleFontSize: number;
  bodyFontSize: number;
  guestNameFontSize: number;
}

/* ======================== Constants ======================== */

const defaultDesign: CardDesign = {
  title: 'بسم الله الرحمن الرحيم',
  subtitle: 'يسر العائلة أن تدعوكم',
  body: 'نُسرّ بمعرفتكم حضوركم في حفل زفافنا\nيوم الجمعة ١٥ ذو القعدة ١٤٤٦\nقاعة الملك فيصل - الرياض\nالساعة الثامنة مساءً',
  guestName: '',
  guestNamePosition: 'below-subtitle',
  showGuestName: true,

  backgroundType: 'gradient',
  backgroundColor: '#1a1a2e',
  gradientColor1: '#0d1117',
  gradientColor2: '#1a1a2e',
  gradientDirection: 'to-bottom',
  backgroundImage: '',

  showQR: true,
  qrPosition: 'bottom-center',
  qrSize: 64,

  textColor: '#e5e7eb',
  accentColor: '#f59e0b',

  titleFontSize: 22,
  subtitleFontSize: 16,
  bodyFontSize: 14,
  guestNameFontSize: 18,
};

const inputCls = 'w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-amber-500 transition-colors';
const labelCls = 'text-sm font-medium text-gray-300 mb-1.5 block';

const qrPositions: { key: QRPosition; label: string; gridArea: string }[] = [
  { key: 'top-left', label: 'أعلى يسار', gridArea: '1 / 1 / 2 / 2' },
  { key: 'top-right', label: 'أعلى يمين', gridArea: '1 / 3 / 2 / 4' },
  { key: 'center', label: 'وسط', gridArea: '2 / 2 / 3 / 3' },
  { key: 'bottom-left', label: 'أسفل يسار', gridArea: '3 / 1 / 4 / 2' },
  { key: 'bottom-center', label: 'أسفل وسط', gridArea: '3 / 2 / 4 / 3' },
  { key: 'bottom-right', label: 'أسفل يمين', gridArea: '3 / 3 / 4 / 4' },
];

const gradientDirections: { key: GradientDirection; label: string; cssValue: string }[] = [
  { key: 'to-bottom', label: 'لأسفل', cssValue: 'to bottom' },
  { key: 'to-top', label: 'لأعلى', cssValue: 'to top' },
  { key: 'to-right', label: 'ليمين', cssValue: 'to right' },
  { key: 'to-left', label: 'ليسار', cssValue: 'to left' },
  { key: 'to-br', label: 'قطري ↘', cssValue: 'to bottom right' },
  { key: 'to-bl', label: 'قطري ↙', cssValue: 'to bottom left' },
  { key: 'to-tr', label: 'قطري ↗', cssValue: 'to top right' },
  { key: 'to-tl', label: 'قطري ↖', cssValue: 'to top left' },
];

const guestNamePositions: { key: GuestNamePosition; label: string }[] = [
  { key: 'top', label: 'أعلى البطاقة' },
  { key: 'below-title', label: 'بعد العنوان' },
  { key: 'below-subtitle', label: 'بعد العنوان الفرعي' },
  { key: 'body-start', label: 'بداية النص' },
  { key: 'bottom', label: 'أسفل البطاقة' },
];

/* ======================== Toast Hook ======================== */

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

/* ======================== Collapsible Section ======================== */

function CollapsibleSection({ title, icon, isOpen, onToggle, children }: {
  title: string;
  icon: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#30363d] bg-[#161b22] overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-gray-200 hover:bg-[#1c2333] transition-colors"
      >
        <span className="text-lg">{icon}</span>
        <span className="flex-1 text-right">{title}</span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-[#30363d]">
          {children}
        </div>
      )}
    </div>
  );
}

/* ======================== Color Input ======================== */

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className={labelCls + ' flex-1 mb-0'}>{label}</label>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 font-mono">{value}</span>
        <div className="relative w-9 h-9 rounded-lg border border-[#30363d] overflow-hidden">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-[-4px] w-[calc(100%+8px)] h-[calc(100%+8px)] cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}

/* ======================== Range Slider ======================== */

function RangeSlider({ label, value, onChange, min, max, step = 1, unit = 'px' }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className={labelCls + ' mb-0'}>{label}</label>
        <span className="text-xs font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">{value}{unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${(value / max) * 100}%, #30363d ${(value / max) * 100}%, #30363d 100%)`,
        }}
      />
    </div>
  );
}

/* ======================== QR Placeholder ======================== */

function QRPlaceholder({ size, accentColor }: { size: number; accentColor: string }) {
  const cellSize = Math.max(2, Math.floor(size / 15));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${cellSize * 15} ${cellSize * 15}`} className="rounded">
      {/* Background */}
      <rect width="100%" height="100%" fill="white" rx="2" />
      {/* QR-like pattern */}
      {/* Top-left finder */}
      <rect x={cellSize} y={cellSize} width={cellSize * 5} height={cellSize * 5} fill={accentColor} rx="1" />
      <rect x={cellSize * 2} y={cellSize * 2} width={cellSize * 3} height={cellSize * 3} fill="white" rx="1" />
      <rect x={cellSize * 3} y={cellSize * 3} width={cellSize} height={cellSize} fill={accentColor} />
      {/* Top-right finder */}
      <rect x={cellSize * 9} y={cellSize} width={cellSize * 5} height={cellSize * 5} fill={accentColor} rx="1" />
      <rect x={cellSize * 10} y={cellSize * 2} width={cellSize * 3} height={cellSize * 3} fill="white" rx="1" />
      <rect x={cellSize * 11} y={cellSize * 3} width={cellSize} height={cellSize} fill={accentColor} />
      {/* Bottom-left finder */}
      <rect x={cellSize} y={cellSize * 9} width={cellSize * 5} height={cellSize * 5} fill={accentColor} rx="1" />
      <rect x={cellSize * 2} y={cellSize * 10} width={cellSize * 3} height={cellSize * 3} fill="white" rx="1" />
      <rect x={cellSize * 3} y={cellSize * 11} width={cellSize} height={cellSize} fill={accentColor} />
      {/* Data modules */}
      {[
        [7, 1], [7, 2], [7, 3], [7, 5],
        [1, 7], [3, 7], [5, 7],
        [7, 7], [7, 9], [7, 11], [7, 13],
        [9, 7], [11, 7], [13, 7],
        [9, 9], [9, 11], [9, 13],
        [11, 9], [11, 11],
        [13, 9], [13, 11], [13, 13],
        [1, 9], [3, 11], [5, 13],
        [1, 11], [3, 13], [1, 13],
      ].map(([cx, cy], i) => (
        <rect
          key={i}
          x={cx * cellSize}
          y={cy * cellSize}
          width={cellSize}
          height={cellSize}
          fill={accentColor}
        />
      ))}
    </svg>
  );
}

/* ======================== Decorative Border SVG ======================== */

function DecorativeBorder({ color }: { color: string }) {
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 560" fill="none" preserveAspectRatio="none">
      {/* Outer border */}
      <rect x="8" y="8" width="384" height="544" rx="12" stroke={color} strokeWidth="1" strokeOpacity="0.3" />
      <rect x="14" y="14" width="372" height="532" rx="8" stroke={color} strokeWidth="0.5" strokeOpacity="0.2" strokeDasharray="8 4" />
      {/* Corner ornaments */}
      <g opacity="0.5">
        {/* Top-left */}
        <path d="M24 24 L40 24 M24 24 L24 40" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="24" cy="24" r="2" fill={color} />
        {/* Top-right */}
        <path d="M376 24 L360 24 M376 24 L376 40" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="376" cy="24" r="2" fill={color} />
        {/* Bottom-left */}
        <path d="M24 536 L40 536 M24 536 L24 520" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="24" cy="536" r="2" fill={color} />
        {/* Bottom-right */}
        <path d="M376 536 L360 536 M376 536 L376 520" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="376" cy="536" r="2" fill={color} />
      </g>
      {/* Top center ornament */}
      <g opacity="0.4">
        <line x1="170" y1="12" x2="200" y2="12" stroke={color} strokeWidth="1" />
        <line x1="200" y1="12" x2="230" y2="12" stroke={color} strokeWidth="1" />
        <path d="M195 8 L200 3 L205 8" stroke={color} strokeWidth="0.8" fill="none" />
        <line x1="170" y1="16" x2="230" y2="16" stroke={color} strokeWidth="0.5" />
      </g>
      {/* Bottom center ornament */}
      <g opacity="0.4">
        <line x1="170" y1="548" x2="200" y2="548" stroke={color} strokeWidth="1" />
        <line x1="200" y1="548" x2="230" y2="548" stroke={color} strokeWidth="1" />
        <path d="M195 552 L200 557 L205 552" stroke={color} strokeWidth="0.8" fill="none" />
        <line x1="170" y1="544" x2="230" y2="544" stroke={color} strokeWidth="0.5" />
      </g>
    </svg>
  );
}

/* ======================== Guest Name Component ======================== */

function GuestNameField({ design }: { design: CardDesign }) {
  if (!design.showGuestName) return null;
  const displayText = design.guestName || '{{اسم_الضيف}}';
  return (
    <div
      className="text-center"
      style={{
        fontSize: design.guestNameFontSize + 'px',
        color: design.accentColor,
        fontWeight: 700,
        direction: 'rtl',
        lineHeight: 1.6,
        opacity: design.guestName ? 1 : 0.6,
        fontStyle: design.guestName ? 'normal' : 'italic',
      }}
    >
      {escapeHtml(displayText)}
    </div>
  );
}

/* ======================== QR Position on Card ======================== */

function QRPositioned({ design }: { design: CardDesign }) {
  if (!design.showQR) return null;

  const posClasses: Record<string, string> = {
    'top-left': 'absolute top-6 left-6',
    'top-right': 'absolute top-6 right-6',
    'bottom-left': 'absolute bottom-6 left-6',
    'bottom-right': 'absolute bottom-6 right-6',
    'bottom-center': 'absolute bottom-6 left-1/2 -translate-x-1/2',
    'center': 'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20',
  };

  return (
    <div className={posClasses[design.qrPosition] || posClasses['bottom-right']}>
      <QRPlaceholder size={design.qrSize} accentColor={design.accentColor} />
    </div>
  );
}

/* ======================== Background Style ======================== */

function getBackgroundStyle(design: CardDesign): React.CSSProperties {
  if (design.backgroundType === 'image' && design.backgroundImage) {
    return {
      backgroundImage: `url(${design.backgroundImage})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    };
  }
  if (design.backgroundType === 'gradient') {
    const dir = gradientDirections.find((d) => d.key === design.gradientDirection);
    const dirValue = dir ? dir.cssValue : 'to bottom';
    return {
      background: `linear-gradient(${dirValue}, ${design.gradientColor1}, ${design.gradientColor2})`,
    };
  }
  return { backgroundColor: design.backgroundColor };
}

/* ======================== Card Preview ======================== */

function CardPreview({ design, cardRef }: { design: CardDesign; cardRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div className="flex items-center justify-center">
      <div className="relative">
        {/* Phone frame shadow */}
        <div
          className="absolute -inset-4 rounded-[2rem]"
          style={{
            background: 'linear-gradient(145deg, rgba(245,158,11,0.15), rgba(13,17,23,0.8))',
            filter: 'blur(20px)',
            zIndex: 0,
          }}
        />
        {/* Phone frame */}
        <div className="relative z-10 rounded-[1.5rem] border-2 border-[#30363d] bg-[#0d1117] p-3 shadow-2xl">
          {/* Notch */}
          <div className="flex justify-center mb-2">
            <div className="w-20 h-1.5 rounded-full bg-[#30363d]" />
          </div>
          {/* Card */}
          <div
            ref={cardRef}
            className="relative overflow-hidden rounded-xl"
            style={{
              width: 400,
              height: 560,
              ...getBackgroundStyle(design),
              fontFamily: "'Segoe UI', 'Noto Sans Arabic', Tahoma, Geneva, Verdana, sans-serif",
            }}
          >
            {/* Decorative border */}
            <DecorativeBorder color={design.accentColor} />

            {/* Content */}
            <div
              className="relative z-10 flex flex-col items-center justify-center h-full px-10 text-center"
              style={{ color: design.textColor }}
            >
              {/* Guest name at top */}
              {design.guestNamePosition === 'top' && (
                <div className="mb-3">
                  <GuestNameField design={design} />
                </div>
              )}

              {/* Title */}
              <div
                className="mb-3 font-bold leading-relaxed"
                style={{ fontSize: design.titleFontSize + 'px', color: design.accentColor }}
              >
                {escapeHtml(design.title) || (
                  <span className="opacity-40 italic">العنوان</span>
                )}
              </div>

              {/* Guest name below title */}
              {design.guestNamePosition === 'below-title' && (
                <div className="mb-2">
                  <GuestNameField design={design} />
                </div>
              )}

              {/* Decorative divider */}
              <div className="flex items-center gap-2 mb-3 w-full max-w-[200px]">
                <div className="flex-1 h-px" style={{ backgroundColor: design.accentColor, opacity: 0.4 }} />
                <div
                  className="w-2 h-2 rotate-45"
                  style={{ backgroundColor: design.accentColor, opacity: 0.6 }}
                />
                <div className="flex-1 h-px" style={{ backgroundColor: design.accentColor, opacity: 0.4 }} />
              </div>

              {/* Subtitle */}
              <div
                className="mb-4 font-medium leading-relaxed"
                style={{ fontSize: design.subtitleFontSize + 'px', opacity: 0.9 }}
              >
                {escapeHtml(design.subtitle) || (
                  <span className="opacity-40 italic">العنوان الفرعي</span>
                )}
              </div>

              {/* Guest name below subtitle */}
              {design.guestNamePosition === 'below-subtitle' && (
                <div className="mb-4">
                  <GuestNameField design={design} />
                </div>
              )}

              {/* Guest name at body start */}
              {design.guestNamePosition === 'body-start' && (
                <div className="mb-3">
                  <GuestNameField design={design} />
                </div>
              )}

              {/* Body */}
              <div
                className="leading-loose whitespace-pre-line max-w-[320px]"
                style={{ fontSize: design.bodyFontSize + 'px', opacity: 0.85 }}
              >
                {escapeHtml(design.body) || (
                  <span className="opacity-40 italic">نص الدعوة...</span>
                )}
              </div>

              {/* Guest name at bottom */}
              {design.guestNamePosition === 'bottom' && (
                <div className="mt-auto mb-6">
                  <GuestNameField design={design} />
                </div>
              )}
            </div>

            {/* QR Code */}
            <QRPositioned design={design} />
          </div>
        </div>
        {/* Dimensions label */}
        <div className="text-center mt-3 text-xs text-gray-500 font-mono">
          400 × 560 px
        </div>
      </div>
    </div>
  );
}

/* ======================== Controls Panel ======================== */

function ControlsPanel({ design, setDesign, show, openSections, toggleSection }: {
  design: CardDesign;
  setDesign: React.Dispatch<React.SetStateAction<CardDesign>>;
  show: (msg: string, type?: 'success' | 'error' | 'info') => void;
  openSections: Record<string, boolean>;
  toggleSection: (key: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const update = <K extends keyof CardDesign>(key: K, value: CardDesign[K]) => {
    setDesign((prev) => ({ ...prev, [key]: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      show('حجم الصورة يجب أن يكون أقل من 5 ميجابايت', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      update('backgroundImage', reader.result as string);
      update('backgroundType', 'image');
      show('تم رفع الصورة بنجاح', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleDownload = () => {
    show('تم تحميل البطاقة', 'success');
  };

  const handleSaveTemplate = async () => {
    try {
      const templateData = {
        name: `بطاقة: ${design.title.substring(0, 30)}`,
        type: 'invitation-card',
        text: JSON.stringify(design),
      };
      await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData),
      });
      show('تم حفظ التصميم كنموذج', 'success');
    } catch {
      show('حدث خطأ أثناء الحفظ', 'error');
    }
  };

  return (
    <div className="space-y-3">
      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleDownload}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
          </svg>
          تحميل البطاقة
        </button>
        <button
          onClick={handleSaveTemplate}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-400 hover:bg-amber-500/20 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          حفظ كنموذج
        </button>
      </div>

      {/* ===== النصوص ===== */}
      <CollapsibleSection
        title="النصوص"
        icon="✏️"
        isOpen={openSections['texts'] ?? true}
        onToggle={() => toggleSection('texts')}
      >
        <div>
          <label className={labelCls}>العنوان</label>
          <input
            value={design.title}
            onChange={(e) => update('title', e.target.value)}
            className={inputCls}
            placeholder="بسم الله الرحمن الرحيم"
          />
        </div>
        <div>
          <label className={labelCls}>العنوان الفرعي</label>
          <input
            value={design.subtitle}
            onChange={(e) => update('subtitle', e.target.value)}
            className={inputCls}
            placeholder="يسر العائلة أن تدعوكم"
          />
        </div>
        <div>
          <label className={labelCls}>نص الدعوة</label>
          <textarea
            value={design.body}
            onChange={(e) => update('body', e.target.value)}
            rows={4}
            className={inputCls + ' resize-none'}
            placeholder="اكتب نص الدعوة هنا..."
          />
        </div>
        <div className="pt-1">
          <div className="flex items-center justify-between mb-2">
            <label className={labelCls + ' mb-0'}>اسم الضيف</label>
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-xs text-gray-400">عرض</span>
              <div
                onClick={() => update('showGuestName', !design.showGuestName)}
                className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${design.showGuestName ? 'bg-amber-500' : 'bg-[#30363d]'}`}
              >
                <div
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${design.showGuestName ? 'left-0.5' : 'left-[18px]'}`}
                />
              </div>
            </label>
          </div>
          <input
            value={design.guestName}
            onChange={(e) => update('guestName', e.target.value)}
            className={inputCls}
            placeholder="{{اسم_الضيف}}"
            disabled={!design.showGuestName}
          />
        </div>
        {design.showGuestName && (
          <div>
            <label className={labelCls}>موضع اسم الضيف</label>
            <div className="grid grid-cols-1 gap-1.5">
              {guestNamePositions.map((pos) => (
                <button
                  key={pos.key}
                  onClick={() => update('guestNamePosition', pos.key)}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors text-right ${
                    design.guestNamePosition === pos.key
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                      : 'bg-[#0d1117] text-gray-400 border border-[#30363d] hover:border-gray-500'
                  }`}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </CollapsibleSection>

      {/* ===== الخلفية ===== */}
      <CollapsibleSection
        title="الخلفية"
        icon="🎨"
        isOpen={openSections['background'] ?? true}
        onToggle={() => toggleSection('background')}
      >
        {/* Background type selector */}
        <div>
          <label className={labelCls}>نوع الخلفية</label>
          <div className="flex gap-2">
            {([
              { key: 'solid', label: 'لون ثابت' },
              { key: 'gradient', label: 'تدرج' },
              { key: 'image', label: 'صورة' },
            ] as { key: BackgroundType; label: string }[]).map((opt) => (
              <button
                key={opt.key}
                onClick={() => update('backgroundType', opt.key)}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  design.backgroundType === opt.key
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-[#0d1117] text-gray-400 border border-[#30363d] hover:border-gray-500'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Solid color */}
        {design.backgroundType === 'solid' && (
          <ColorInput
            label="لون الخلفية"
            value={design.backgroundColor}
            onChange={(v) => update('backgroundColor', v)}
          />
        )}

        {/* Gradient */}
        {design.backgroundType === 'gradient' && (
          <>
            <ColorInput
              label="اللون الأول"
              value={design.gradientColor1}
              onChange={(v) => update('gradientColor1', v)}
            />
            <ColorInput
              label="اللون الثاني"
              value={design.gradientColor2}
              onChange={(v) => update('gradientColor2', v)}
            />
            <div>
              <label className={labelCls}>اتجاه التدرج</label>
              <div className="grid grid-cols-4 gap-1.5">
                {gradientDirections.map((dir) => (
                  <button
                    key={dir.key}
                    onClick={() => update('gradientDirection', dir.key)}
                    className={`px-2 py-2 rounded-lg text-[10px] font-medium transition-colors ${
                      design.gradientDirection === dir.key
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                        : 'bg-[#0d1117] text-gray-400 border border-[#30363d] hover:border-gray-500'
                    }`}
                  >
                    {dir.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Image upload */}
        {design.backgroundType === 'image' && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            {design.backgroundImage ? (
              <div className="space-y-2">
                <div className="relative rounded-lg overflow-hidden border border-[#30363d]">
                  <img
                    src={design.backgroundImage}
                    alt="خلفية مخصصة"
                    className="w-full h-24 object-cover"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 px-3 py-2 rounded-lg text-xs font-medium bg-[#0d1117] text-gray-300 border border-[#30363d] hover:border-gray-500"
                  >
                    تغيير الصورة
                  </button>
                  <button
                    onClick={() => {
                      update('backgroundImage', '');
                      update('backgroundType', 'solid');
                    }}
                    className="px-3 py-2 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/40 hover:bg-red-500/20"
                  >
                    حذف
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 rounded-lg border-2 border-dashed border-[#30363d] text-gray-400 text-sm hover:border-amber-500/50 hover:text-amber-400 transition-colors flex flex-col items-center gap-2"
              >
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>اضغط لرفع صورة</span>
                <span className="text-xs text-gray-500">JPG, PNG, WEBP — حتى 5 ميجابايت</span>
              </button>
            )}
          </>
        )}
      </CollapsibleSection>

      {/* ===== QR ===== */}
      <CollapsibleSection
        title="رمز QR"
        icon="📱"
        isOpen={openSections['qr'] ?? true}
        onToggle={() => toggleSection('qr')}
      >
        <div className="flex items-center justify-between">
          <label className={labelCls + ' mb-0'}>عرض رمز QR</label>
          <div
            onClick={() => update('showQR', !design.showQR)}
            className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${design.showQR ? 'bg-amber-500' : 'bg-[#30363d]'}`}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${design.showQR ? 'left-0.5' : 'left-[18px]'}`}
            />
          </div>
        </div>

        {design.showQR && (
          <>
            <div>
              <label className={labelCls}>موضع الرمز</label>
              <div
                className="grid grid-cols-3 gap-1.5 w-32 mx-auto"
                style={{ gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(3, 1fr)' }}
              >
                {[
                  { key: 'top-left' as QRPosition, pos: 'col-start-1 row-start-1' },
                  { key: 'top-right' as QRPosition, pos: 'col-start-3 row-start-1' },
                  { key: 'center' as QRPosition, pos: 'col-start-2 row-start-2' },
                  { key: 'bottom-left' as QRPosition, pos: 'col-start-1 row-start-3' },
                  { key: 'bottom-center' as QRPosition, pos: 'col-start-2 row-start-3' },
                  { key: 'bottom-right' as QRPosition, pos: 'col-start-3 row-start-3' },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => update('qrPosition', item.key)}
                    className={`w-9 h-9 rounded-lg border flex items-center justify-center transition-colors ${
                      design.qrPosition === item.key
                        ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                        : 'bg-[#0d1117] border-[#30363d] text-gray-500 hover:border-gray-500'
                    }`}
                    style={{}}
                    title={qrPositions.find((p) => p.key === item.key)?.label}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h4v4H4zM10 10h4v4h-4zM16 16h4v4h-4zM16 4h4v4h-4zM4 16h4v4H4z" />
                    </svg>
                  </button>
                ))}
              </div>
              <div className="text-center mt-2 text-xs text-gray-500">
                {qrPositions.find((p) => p.key === design.qrPosition)?.label}
              </div>
            </div>
            <RangeSlider
              label="حجم الرمز"
              value={design.qrSize}
              onChange={(v) => update('qrSize', v)}
              min={32}
              max={120}
              unit="px"
            />
          </>
        )}
      </CollapsibleSection>

      {/* ===== الألوان ===== */}
      <CollapsibleSection
        title="الألوان"
        icon="🎯"
        isOpen={openSections['colors'] ?? true}
        onToggle={() => toggleSection('colors')}
      >
        <ColorInput
          label="لون النص"
          value={design.textColor}
          onChange={(v) => update('textColor', v)}
        />
        <ColorInput
          label="لون التمييز"
          value={design.accentColor}
          onChange={(v) => update('accentColor', v)}
        />
        {/* Quick color presets */}
        <div>
          <label className={labelCls}>ألوان سريعة</label>
          <div className="flex flex-wrap gap-2">
            {[
              { accent: '#f59e0b', label: 'ذهبي' },
              { accent: '#ec4899', label: 'وردي' },
              { accent: '#ef4444', label: 'أحمر' },
              { accent: '#10b981', label: 'أخضر' },
              { accent: '#6366f1', label: 'بنفسجي' },
              { accent: '#06b6d4', label: 'سماوي' },
              { accent: '#f97316', label: 'برتقالي' },
              { accent: '#a855f7', label: 'بنفسجي فاتح' },
            ].map((preset) => (
              <button
                key={preset.accent}
                onClick={() => update('accentColor', preset.accent)}
                className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition-colors ${
                  design.accentColor === preset.accent
                    ? 'border-amber-500/50 bg-amber-500/10'
                    : 'border-[#30363d] hover:border-gray-500'
                }`}
              >
                <div
                  className="w-3.5 h-3.5 rounded-full border border-white/20"
                  style={{ backgroundColor: preset.accent }}
                />
                <span className="text-[10px] text-gray-400 group-hover:text-gray-300">{preset.label}</span>
              </button>
            ))}
          </div>
        </div>
      </CollapsibleSection>

      {/* ===== الخط ===== */}
      <CollapsibleSection
        title="الخط"
        icon="🔤"
        isOpen={openSections['font'] ?? true}
        onToggle={() => toggleSection('font')}
      >
        <RangeSlider
          label="حجم العنوان"
          value={design.titleFontSize}
          onChange={(v) => update('titleFontSize', v)}
          min={12}
          max={40}
          unit="px"
        />
        <RangeSlider
          label="حجم العنوان الفرعي"
          value={design.subtitleFontSize}
          onChange={(v) => update('subtitleFontSize', v)}
          min={10}
          max={32}
          unit="px"
        />
        <RangeSlider
          label="حجم النص"
          value={design.bodyFontSize}
          onChange={(v) => update('bodyFontSize', v)}
          min={8}
          max={24}
          unit="px"
        />
        <RangeSlider
          label="حجم اسم الضيف"
          value={design.guestNameFontSize}
          onChange={(v) => update('guestNameFontSize', v)}
          min={12}
          max={36}
          unit="px"
        />
      </CollapsibleSection>
    </div>
  );
}

/* ======================== Main Page ======================== */

export default function InvitationEditorPage() {
  const [design, setDesign] = useState<CardDesign>({ ...defaultDesign });
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    texts: true,
    background: true,
    qr: false,
    colors: true,
    font: false,
  });
  const cardRef = useRef<HTMLDivElement>(null);
  const { show, ToastContainer } = useToast();
  const [exporting, setExporting] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendEventId, setSendEventId] = useState('');
  const [sendChannel, setSendChannel] = useState('whatsapp');
  const [sendRecipientType, setSendRecipientType] = useState('all');
  const [sending, setSending] = useState(false);

  const { events } = useAppStore();

  useEffect(() => {
    if (events.length === 0) {
      import('@/lib/store').then(({ api }) => {
        api.getEvents().then((r: any) => {
          if (r.data || r) import('@/lib/store').then(({ useAppStore }) => useAppStore.getState().setData('events', r.data || r));
        });
      });
    }
  }, []);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleReset = () => {
    setDesign({ ...defaultDesign });
    show('تم إعادة تعيين التصميم', 'info');
  };

  const handleExportImage = async () => {
    if (!cardRef.current) { show('لم يتم العثور على البطاقة', 'error'); return; }
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false,
      });
      const link = document.createElement('a');
      link.download = 'invitation-' + Date.now() + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      show('تم تحميل البطاقة كصورة PNG', 'success');
    } catch (err) {
      console.error('Export error:', err);
      show('فشل تصدير الصورة', 'error');
    }
    setExporting(false);
  };

  const handleSendInvitation = async () => {
    if (!sendEventId) { show('اختر المناسبة', 'error'); return; }
    setSending(true);
    try {
      const res = await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: sendEventId,
          channel: sendChannel,
          recipientType: sendRecipientType,
          type: 'invite',
          design,
        }),
      });
      const r = await res.json();
      if (!res.ok || r.error) {
        show(r.error || 'فشل تجهيز الدعوات', 'error');
        return;
      }
      show('تم تجهيز الدعوة لـ ' + (r.sent || r.snapshots || 0) + ' ضيف', 'success');
      setSendModalOpen(false);
    } catch (err) {
      console.error('Send invitation error:', err);
      show('فشل تجهيز الدعوات', 'error');
    } finally {
      setSending(false);
    }
  };


  return (
    <div dir="rtl" className="h-full flex flex-col">
      {ToastContainer}

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
            <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-100">محرر البطاقات</h1>
            <p className="text-xs text-gray-500 mt-0.5">تصميم وتخصيص بطاقات الدعوة</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExportImage} disabled={exporting} className="flex items-center gap-1.5 rounded-lg bg-gradient-to-l from-amber-500 to-amber-600 px-3 py-2 text-xs font-bold text-[#0d1117] hover:from-amber-400 hover:to-amber-500 transition-colors disabled:opacity-50">
            {exporting ? 'جارٍ التصدير...' : 'تحميل PNG'}
          </button>
          <button onClick={() => setSendModalOpen(true)} className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 px-3 py-2 text-xs font-medium text-emerald-400 hover:bg-emerald-500/10 transition-colors">
            إرسال للضيوف
          </button>
          <button onClick={handleReset} className="flex items-center gap-1.5 rounded-lg border border-[#30363d] px-3 py-2 text-xs font-medium text-gray-400 hover:bg-[#1c2333] hover:text-gray-200 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            إعادة تعيين
          </button>
        </div>
      </div>

      {/* Send Modal */}
      {sendModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#161b22] rounded-2xl border border-[#30363d] p-6 w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-gray-100">إرسال الدعوة</h3>
            <div>
              <label className='text-xs font-semibold text-gray-400 mb-1.5 block'>المناسبة</label>
              <select value={sendEventId} onChange={(e) => setSendEventId(e.target.value)} className='w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-amber-500'>
                <option value="">اختر المناسبة...</option>
                {events.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className='text-xs font-semibold text-gray-400 mb-1.5 block'>القناة</label>
              <select value={sendChannel} onChange={(e) => setSendChannel(e.target.value)} className='w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-amber-500'>
                <option value="whatsapp">واتساب</option>
                <option value="email">إيميل</option>
              </select>
            </div>
            <div>
              <label className='text-xs font-semibold text-gray-400 mb-1.5 block'>المستلمون</label>
              <select value={sendRecipientType} onChange={(e) => setSendRecipientType(e.target.value)} className='w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2.5 text-sm text-gray-200 outline-none focus:border-amber-500'>
                <option value="all">الجميع</option>
                <option value="confirmed">المؤكدون</option>
                <option value="unconfirmed">غير المؤكدين</option>
              </select>
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={handleSendInvitation} disabled={sending} className="flex-1 rounded-lg bg-emerald-600 text-white py-2.5 text-sm font-bold hover:bg-emerald-700 disabled:opacity-50">{sending ? 'جارٍ الإرسال...' : 'إرسال الآن'}</button>
              <button onClick={() => setSendModalOpen(false)} className="rounded-lg border border-[#30363d] px-4 py-2 text-sm text-gray-400 hover:bg-[#1c2333]">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content: Preview + Controls */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        {/* Left: Card Preview (2/3) */}
        <div className="lg:w-2/3 flex items-start justify-center overflow-y-auto rounded-xl border border-[#30363d] bg-[#161b22] p-6">
          <div className="py-4">
            <CardPreview design={design} cardRef={cardRef} />
          </div>
        </div>

        {/* Right: Controls Panel (1/3) */}
        <div className="lg:w-1/3 overflow-y-auto pr-1 space-y-0" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          <ControlsPanel
            design={design}
            setDesign={setDesign}
            show={show}
            openSections={openSections}
            toggleSection={toggleSection}
          />
        </div>
      </div>
    </div>
  );
}
