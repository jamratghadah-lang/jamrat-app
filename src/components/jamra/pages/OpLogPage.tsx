'use client';

import { useEffect } from 'react';
import { api, useAppStore, escapeHtml } from '@/lib/store';

export default function OpLogPage() {
  const { opLogs, setData } = useAppStore();

  useEffect(() => { api.getOpLogs().then((r: any) => setData('opLogs', r.data || r)); }, [setData]);

  return (
    <div dir="rtl" className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">سجل العمليات</h1>

      {opLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[#30363d] bg-[#161b22] py-20">
          <span className="text-4xl mb-3">📜</span>
          <p className="text-gray-400">لا توجد عمليات مسجلة</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-6">
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute right-[11px] top-3 bottom-3 w-px bg-[#30363d]" />

            <div className="space-y-0">
              {opLogs.map((log: any, idx: number) => (
                <div key={log.id} className="relative flex gap-4 pb-6 last:pb-0">
                  {/* Dot */}
                  <div className={`relative z-10 mt-1.5 h-3 w-3 rounded-full flex-shrink-0 ${idx === 0 ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-[#30363d] border-2 border-[#161b22]'}`} />

                  {/* Content */}
                  <div className="flex-1 min-w-0 -mt-0.5">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-200">{escapeHtml(log.user)}</span>
                      <span className="text-xs text-gray-600">•</span>
                      <span className="text-xs text-gray-500">{log.time}</span>
                    </div>
                    <p className="text-sm text-gray-400 leading-relaxed">{escapeHtml(log.text)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
