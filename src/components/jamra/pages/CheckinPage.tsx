'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { api, useAppStore } from '@/lib/store';

/* ------------------------------------------------------------------ */
/*  Icons                                                              */
/* ------------------------------------------------------------------ */

const IconQR = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    <rect x="14" y="14" width="3" height="3" /><rect x="18" y="18" width="3" height="3" />
    <line x1="14" y1="14" x2="14" y2="14.01" /><line x1="21" y1="14" x2="21" y2="14.01" /><line x1="14" y1="21" x2="14" y2="21.01" />
  </svg>
);

const IconCheck = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconSearch = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const IconUsers = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const IconClipboardCheck = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" /><path d="m9 14 2 2 4-4" />
  </svg>
);

const IconCamera = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
    <circle cx="12" cy="13" r="3"/>
  </svg>
);

const IconX = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CheckinResult {
  guestName: string;
  companions: number;
  time: string;
}

interface QrVerifyResult {
  valid: boolean;
  alreadyCheckedIn?: boolean;
  guestId?: string;
  guestName?: string;
  eventId?: string;
  companions?: number;
  error?: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CheckinPage() {
  const { guests, checkins, setData, user } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedGuestId, setSelectedGuestId] = useState<string>('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [checkinResult, setCheckinResult] = useState<CheckinResult | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // QR Scanner state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ---- Fetch data on mount ---- */
  const fetchData = useCallback(async () => {
    try {
      const [checkinsData, guestsData] = await Promise.all([
        api.getCheckins(),
        api.getGuests(),
      ]);
      setData('checkins', checkinsData);
      setData('guests', guestsData);
    } catch (err) {
      console.error('Failed to fetch checkin data:', err);
    }
  }, [setData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ---- Search guests ---- */
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    const q = searchQuery.trim().toLowerCase();
    const results = guests.filter(
      (g: any) =>
        g.name?.toLowerCase().includes(q) ||
        g.phone?.includes(q) ||
        g.id?.toLowerCase().includes(q)
    ).slice(0, 8);
    setSearchResults(results);
    setShowDropdown(results.length > 0);
  }, [searchQuery, guests]);

  /* ---- Close dropdown on outside click ---- */
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  /* ---- Cleanup scanner on unmount ---- */
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  /* ---- Handle manual checkin ---- */
  const handleCheckin = async (guestId: string, method: 'qr' | 'manual' = 'manual', qrToken?: string) => {
    if (!guestId && !qrToken) return;
    setLoading(true);
    try {
      const result: any = await api.checkin({
        ...(guestId ? { guestId } : {}),
        ...(qrToken ? { qrToken } : {}),
        method,
      });
      if (result.error) {
        setCheckinResult({ guestName: result.error, companions: 0, time: '' });
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCheckinResult(null), 3000);
      } else {
        setCheckinResult({
          guestName: result.guestName,
          companions: result.companions,
          time: result.time,
        });
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCheckinResult(null), 3000);
      }
      await fetchData();
      setSelectedGuestId('');
      setSearchQuery('');
      setShowDropdown(false);
    } catch (err) {
      console.error('Checkin error:', err);
    } finally {
      setLoading(false);
    }
  };

  /* ---- QR Scanner ---- */
  const startScanner = async () => {
    setScannerOpen(true);
    setScannerError('');

    try {
      // Dynamic import of barcode detector library
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const codeReader = new BrowserMultiFormatReader();

      if (!videoRef.current) return;

      codeReader.decodeFromVideoDevice(undefined, videoRef.current, async (result, error) => {
        if (result) {
          try {
            const data = JSON.parse(result.getText());
            const qrToken = typeof data.qrToken === 'string' ? data.qrToken : null;
            if (qrToken) {
              const verifyResult: QrVerifyResult = await fetch('/api/qr-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ qrToken }),
              }).then(r => r.json());

              if (verifyResult.valid && !verifyResult.alreadyCheckedIn) {
                await handleCheckin('', 'qr', qrToken);
                stopScanner();
              } else if (verifyResult.alreadyCheckedIn) {
                setCheckinResult({ guestName: (verifyResult.guestName || '') + ' — مسجل بالفعل', companions: 0, time: '' });
                if (timerRef.current) clearTimeout(timerRef.current);
                timerRef.current = setTimeout(() => setCheckinResult(null), 3000);
                stopScanner();
              } else {
                setScannerError(verifyResult.error || 'QR غير صالح');
                if (timerRef.current) clearTimeout(timerRef.current);
                timerRef.current = setTimeout(() => { setScannerError(''); }, 3000);
              }
            }
          } catch {
            // QR codes are encoded as the opaque token itself.
            const qrToken = result.getText().trim();
            if (qrToken.length >= 32) {
              const verifyResult: QrVerifyResult = await fetch('/api/qr-verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ qrToken }),
              }).then(r => r.json());
              if (verifyResult.valid && !verifyResult.alreadyCheckedIn) {
                await handleCheckin('', 'qr', qrToken);
                stopScanner();
              } else if (verifyResult.alreadyCheckedIn) {
                setCheckinResult({ guestName: (verifyResult.guestName || '') + ' — مسجل بالفعل', companions: 0, time: '' });
                stopScanner();
              } else {
                setScannerError(verifyResult.error || 'QR غير صالح');
              }
            }
          }
        }
      });
    } catch (err) {
      setScannerError('لا يمكن الوصول للكاميرا — تأكد من السماح بالوصول');
      // Fallback: try native getUserMedia
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setScannerError('الكاميرا غير متاحة في هذا المتصفح');
      }
    }
  };

  const stopScanner = () => {
    setScannerOpen(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  /* ---- Select guest from dropdown ---- */
  const selectGuest = (guest: any) => {
    setSelectedGuestId(guest.id);
    setSearchQuery(guest.name);
    setShowDropdown(false);
  };

  /* ---- Compute stats ---- */
  const expectedGuests = guests.filter((g: any) => g.confirmed === 'confirmed' || g.attended !== 'attended').length;
  const checkedInCount = checkins.length;

  /* ---- Format time ---- */
  const formatTime = (t: string) => {
    if (!t) return '—';
    try {
      const d = new Date(t);
      return d.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return t;
    }
  };

  /* ================================================================== */
  /*  Render                                                             */
  /* ================================================================== */

  return (
    <div dir="rtl" className="min-h-screen bg-[#0d1117] text-gray-100 p-6 space-y-6">

      {/* Page Title */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-xl">
            <IconClipboardCheck />
            <span className="sr-only">تسجيل الحضور</span>
          </div>
          <h1 className="text-2xl font-bold">تسجيل الحضور</h1>
        </div>
        <button
          onClick={scannerOpen ? stopScanner : startScanner}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
            scannerOpen
              ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20'
          }`}
        >
          {scannerOpen ? <><IconX /> إغلاق الكاميرا</> : <><IconCamera /> مسح QR</>}
        </button>
      </div>

      {/* QR Scanner Modal */}
      {scannerOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#161b22] rounded-2xl p-4 w-full max-w-md space-y-4">
            <div className="relative rounded-xl overflow-hidden bg-black aspect-square">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              {/* Scanner overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-56 h-56 border-2 border-amber-500 rounded-2xl" />
              </div>
            </div>
            {scannerError && (
              <p className="text-red-400 text-center text-sm">{scannerError}</p>
            )}
            <p className="text-gray-400 text-center text-sm">وجّه الكاميرا نحو رمز QR</p>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-[#161b22] border border-green-500/30 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-green-500/10 text-green-400">
            <IconClipboardCheck />
          </div>
          <div>
            <p className="text-sm text-gray-400">تم تسجيل الدخول</p>
            <p className="text-3xl font-bold text-green-400">{checkedInCount}</p>
          </div>
        </div>

        <div className="bg-[#161b22] border border-orange-500/30 rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-orange-500/10 text-orange-400">
            <IconUsers />
          </div>
          <div>
            <p className="text-sm text-gray-400">المتوقع حضورهم</p>
            <p className="text-3xl font-bold text-orange-400">{expectedGuests}</p>
          </div>
        </div>
      </div>

      {/* Display Area */}
      <div
        className={`bg-[#161b22] border-2 rounded-2xl p-10 text-center min-h-[200px] flex flex-col items-center justify-center transition-all duration-300 ${
          checkinResult?.time
            ? 'border-green-500'
            : checkinResult && !checkinResult.time
              ? 'border-red-500'
              : 'border-amber-500'
        }`}
      >
        {checkinResult ? (
          <>
            <div className={checkinResult.time ? 'text-green-400 mb-3' : 'text-red-400 mb-3'}>
              {checkinResult.time ? <IconCheck /> : <IconX />}
            </div>
            <p className={`text-2xl font-bold mb-2 ${checkinResult.time ? 'text-green-400' : 'text-red-400'}`}>{checkinResult.guestName}</p>
            {checkinResult.time && (
              <>
                <p className="text-gray-300 text-lg">
                  المرافقون: <span className="font-semibold text-white">{checkinResult.companions}</span>
                </p>
                <p className="text-gray-400 text-sm mt-1">{formatTime(checkinResult.time)}</p>
              </>
            )}
          </>
        ) : (
          <>
            <div className="text-amber-500/40 mb-3">
              <IconQR />
            </div>
            <p className="text-gray-500 text-sm">في انتظار مسح رمز QR أو تسجيل يدوي</p>
          </>
        )}
      </div>

      {/* Manual Checkin */}
      <div className="bg-[#161b22] border border-gray-700/50 rounded-2xl p-5 space-y-4">
        <h2 className="text-lg font-semibold text-gray-200">تسجيل دخول يدوي</h2>
        <div className="flex flex-col sm:flex-row gap-3 relative" ref={dropdownRef}>
          <div className="relative flex-1">
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <IconSearch />
            </div>
            <input
              type="text"
              placeholder="ابحث بالاسم أو رقم الهاتف..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedGuestId('');
              }}
              onFocus={() => {
                if (searchResults.length > 0) setShowDropdown(true);
              }}
              className="w-full bg-[#0d1117] border border-gray-700 rounded-xl py-2.5 pr-10 pl-4 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/50 transition-colors text-sm"
            />

            {showDropdown && (
              <div className="absolute z-50 top-full mt-1 right-0 left-0 bg-[#1c2333] border border-gray-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                {searchResults.map((guest: any) => (
                  <button
                    key={guest.id}
                    type="button"
                    onClick={() => selectGuest(guest)}
                    className="w-full flex items-center justify-between px-4 py-3 text-right hover:bg-amber-500/10 transition-colors text-sm border-b border-gray-700/50 last:border-0"
                  >
                    <div>
                      <p className="text-gray-100 font-medium">{guest.name}</p>
                      <p className="text-gray-500 text-xs">{guest.phone}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      guest.attended === 'attended'
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-gray-700 text-gray-400'
                    }`}>
                      {guest.attended === 'attended' ? 'حاضر' : 'لم يحضر'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => handleCheckin(selectedGuestId)}
            disabled={!selectedGuestId || loading}
            className="bg-amber-500 hover:bg-amber-600 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold px-6 py-2.5 rounded-xl transition-colors whitespace-nowrap text-sm"
          >
            {loading ? 'جارٍ التسجيل...' : 'تسجيل دخول'}
          </button>
        </div>
      </div>

      {/* Checkin Log Table */}
      <div className="bg-[#161b22] border border-gray-700/50 rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-gray-700/50">
          <h2 className="text-lg font-semibold text-gray-200">سجل الدخول</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0d1117] text-gray-400 text-right">
                <th className="px-5 py-3 font-medium">الضيف</th>
                <th className="px-5 py-3 font-medium">المرافقون</th>
                <th className="px-5 py-3 font-medium">وقت الدخول</th>
                <th className="px-5 py-3 font-medium">بواسطة</th>
                <th className="px-5 py-3 font-medium">الطريقة</th>
              </tr>
            </thead>
            <tbody>
              {checkins.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-500">
                    لا توجد سجلات دخول بعد
                  </td>
                </tr>
              ) : (
                checkins.map((c: any) => (
                  <tr
                    key={c.id}
                    className="border-t border-gray-700/30 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-3 font-medium text-gray-100">{c.guestName}</td>
                    <td className="px-5 py-3 text-gray-400">{c.companions}</td>
                    <td className="px-5 py-3 text-gray-400" dir="ltr">{formatTime(c.time)}</td>
                    <td className="px-5 py-3 text-gray-400">{c.operator || '—'}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${
                          c.method === 'qr'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
                        }`}
                      >
                        {c.method === 'qr' ? 'QR' : 'يدوي'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}