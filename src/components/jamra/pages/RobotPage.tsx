'use client'

import { useState } from 'react'

interface ChatMsg {
  id: string
  from: 'guest' | 'bot'
  text: string
  time: string
}

const sampleChat: ChatMsg[] = [
  { id: '1', from: 'guest', text: 'مرحبا، موعد المناسبة متى؟', time: '10:30 ص' },
  { id: '2', from: 'bot', text: 'أهلاً وسهلاً! مناسبة زفاف غضى يوم الخميس 20 نوفمبر 2026 الساعة 8 مساءً بقصر الأفراح بالرياض 🎉', time: '10:30 ص' },
  { id: '3', from: 'guest', text: 'وش المكان بالضبط؟', time: '10:31 ص' },
  { id: '4', from: 'bot', text: 'القاعة: قصر الأفراح — الرياض، شارع الملك فهد. راح يوصلك رابط خرائط جوجل مع الدعوة 📍', time: '10:31 ص' },
  { id: '5', from: 'guest', text: 'كيف أكد حضوري؟', time: '10:32 ص' },
  { id: '6', from: 'bot', text: 'تقدر تأكد حضورك من رابط الدعوة اللي وصلك، أو أرسل لي اسمك الكامل وأسجل تأكيدك فوراً ✅', time: '10:32 ص' },
]

interface ToggleSetting {
  label: string
  desc: string
  defaultOn: boolean
}

const toggles: ToggleSetting[] = [
  { label: 'تفعيل الروبوت', desc: 'تشغيل أو إيقاف الردود التلقائية', defaultOn: true },
  { label: 'الرد على الموعد', desc: 'الإجابة عن موعد المناسبة تلقائياً', defaultOn: true },
  { label: 'مساعدة التأكيد', desc: 'مساعدة الضيف في تأكيد الحضور', defaultOn: true },
  { label: 'تحويل للموظف', desc: 'تحويل الأسئلة غير المعروفة لموظف', defaultOn: true },
  { label: 'عدم الاختراع', desc: 'لا يرد بمعلومات غير موجودة ببيانات المناسبة', defaultOn: true },
]

export default function RobotPage() {
  const [settings, setSettings] = useState<Record<string, boolean>>(
    Object.fromEntries(toggles.map(t => [t.label, t.defaultOn]))
  )
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')

  const toggleSetting = (label: string) => {
    setSettings(prev => ({ ...prev, [label]: !prev[label] }))
  }

  const sendMessage = () => {
    if (!input.trim()) return
    const userMsg: ChatMsg = {
      id: Date.now().toString(),
      from: 'guest',
      text: input.trim(),
      time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')

    // Placeholder only: no real robot integration is enabled.
    setTimeout(() => {
      const botMsg: ChatMsg = {
        id: (Date.now() + 1).toString(),
        from: 'bot',
        text: 'أنا روبوت مناسباتي 🤖 ردك يتم معالجته. هذه نسخة تجريبية.',
        time: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages(prev => [...prev, botMsg])
    }, 800)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">الروبوت الذكي</h1>
        <p className="text-sm text-gray-500 mt-1">روبوت محادثة ذكي متصل ببيانات المناسبات والموقع</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chat Area - 2/3 */}
        <div className="lg:col-span-2 bg-[#161b22] border border-[#30363d] rounded-xl flex flex-col" style={{ minHeight: 500 }}>
          {/* Chat Header */}
          <div className="p-4 border-b border-[#30363d] flex items-center justify-between">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <span>💬</span> محادثات الروبوت
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-500/15 text-gray-500 border border-gray-500/30">Placeholder</span>
            </h3>
            <button onClick={() => setMessages([])} className="text-xs px-2.5 py-1 rounded-lg border border-[#30363d] text-gray-400 hover:text-red-400 hover:border-red-500/30 transition">مسح الكل</button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.from === 'guest' ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.from === 'guest'
                    ? 'bg-[#1c2333] text-gray-200 border border-[#30363d]'
                    : 'bg-amber-500/15 text-amber-100 border border-amber-500/20'
                }`}>
                  <p>{msg.text}</p>
                  <span className="block text-[9px] text-gray-500 mt-1 text-left" dir="ltr">{msg.time}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-[#30363d] flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="اكتب رسالة تجريبية..."
              className="flex-1 rounded-lg border border-[#30363d] bg-[#0d1117] px-3 py-2 text-sm text-gray-200 outline-none focus:border-amber-500 transition"
            />
            <button onClick={sendMessage}
              className="px-4 py-2 rounded-lg bg-gradient-to-l from-amber-500 to-amber-600 text-[#0d1117] font-bold text-sm hover:from-amber-400 hover:to-amber-500 transition">
              إرسال
            </button>
          </div>
        </div>

        {/* Settings - 1/3 */}
        <div className="space-y-4">
          {/* Toggles */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[#30363d]">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                إعدادات الروبوت
              </h3>
            </div>
            <div className="divide-y divide-[#30363d]">
              {toggles.map(t => (
                <div key={t.label} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-semibold text-gray-200">{t.label}</h4>
                    <p className="text-[10px] text-gray-500 mt-0.5">{t.desc}</p>
                  </div>
                  <button
                    onClick={() => toggleSetting(t.label)}
                    className={`relative w-10 h-5.5 rounded-full transition-colors duration-200 ${settings[t.label] ? 'bg-amber-500' : 'bg-[#30363d]'}`}
                  >
                    <span className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform duration-200 ${
                      settings[t.label] ? 'right-0.5' : 'right-[22px]'
                    }`} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Connection Status */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[#30363d]">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-emerald-400"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                حالة الربط
              </h3>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-300">ربط بالموقع</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">متصل</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-300">ربط بالبيانات</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">متصل</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-300">ربط بالواتساب</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">متصل</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
