'use client'

import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

interface EventInfo {
  id: string
  name: string
  client: string
  date: string
  time: string
  location: string
}

interface GuestInfo {
  name: string
  confirmed: 'pending' | 'confirmed' | 'unconfirmed'
  attended: string
}

type ViewState = 'loading' | 'ready' | 'submitting' | 'done' | 'error'

function RsvpPageInner() {
  const params = useSearchParams()
  const token = params.get('token') || ''
  const eventId = params.get('eventId') || ''
  const guestId = params.get('guestId') || ''
  const password = params.get('password') || ''

  const [state, setState] = useState<ViewState>('loading')
  const [error, setError] = useState('')
  const [event, setEvent] = useState<EventInfo | null>(null)
  const [guest, setGuest] = useState<GuestInfo | null>(null)
  const [companions, setCompanions] = useState(0)
  const [finalResponse, setFinalResponse] = useState<'confirmed' | 'unconfirmed' | null>(null)

  const load = useCallback(async () => {
    if (!token && !(eventId && guestId)) {
      setState('error')
      setError('الرابط غير صالح أو غير مكتمل')
      return
    }
    // SECURITY: send credentials via POST body, NOT in the query string.
    // The previous version appended `password` to the URL which leaked
    // it into Caddy/nginx logs, browser history, and any intermediate
    // proxy.
    try {
      const res = await fetch('/api/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token || undefined,
          eventId: eventId || undefined,
          guestId: guestId || undefined,
          password: password || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setState('error')
        setError(data.error || 'تعذر فتح الدعوة')
        return
      }
      setEvent(data.event)
      setGuest(data.guest || null)
      if (data.guest?.confirmed && data.guest.confirmed !== 'pending') {
        setFinalResponse(data.guest.confirmed)
        setState('done')
      } else {
        setState('ready')
      }
    } catch {
      setState('error')
      setError('تعذر الاتصال بالخادم، حاولي مرة أخرى')
    }
  }, [token, eventId, guestId, password])

  useEffect(() => {
    load()
  }, [load])

  async function submit(response: 'confirmed' | 'unconfirmed') {
    setState('submitting')
    try {
      const res = await fetch('/api/public/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token || undefined,
          eventId: eventId || undefined,
          guestId: guestId || undefined,
          password: password || undefined,
          response,
          companions: response === 'confirmed' ? companions : 0,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setState('ready')
        setError(data.error || 'تعذر حفظ الرد، حاولي مرة أخرى')
        return
      }
      setFinalResponse(response)
      setState('done')
    } catch {
      setState('ready')
      setError('تعذر الاتصال بالخادم، حاولي مرة أخرى')
    }
  }

  return (
    <main dir="rtl" className="min-h-screen bg-[#0d1117] text-gray-100 flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        {state === 'loading' && (
          <div className="text-center text-gray-400 py-16">جاري التحميل…</div>
        )}

        {state === 'error' && (
          <div className="text-center py-16 border border-red-900/40 rounded-2xl bg-red-950/20 px-5">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {(state === 'ready' || state === 'submitting') && event && (
          <div className="rounded-2xl border border-[#c9a25c]/30 bg-white/5 backdrop-blur-sm px-6 py-8 text-center">
            <h1 className="text-[#c9a25c] text-lg font-semibold tracking-wide mb-1">
              {event.name || 'دعوة'}
            </h1>
            {guest?.name && (
              <p className="text-gray-300 mb-4">أهلًا وسهلًا {guest.name} 🌸</p>
            )}
            <div className="text-sm text-gray-400 space-y-1 mb-6">
              {event.date && <p>{event.date}{event.time ? ` — ${event.time}` : ''}</p>}
              {event.location && <p>{event.location}</p>}
            </div>

            {error && <p className="text-red-300 text-sm mb-3">{error}</p>}

            <div className="flex flex-col gap-3">
              <button
                disabled={state === 'submitting'}
                onClick={() => submit('confirmed')}
                className="w-full py-3.5 rounded-xl bg-[#c9a25c] text-[#0d1117] font-semibold text-base disabled:opacity-60"
              >
                سأحضر ✅
              </button>
              <button
                disabled={state === 'submitting'}
                onClick={() => submit('unconfirmed')}
                className="w-full py-3.5 rounded-xl border border-gray-600 text-gray-300 font-medium text-base disabled:opacity-60"
              >
                أعتذر عن الحضور
              </button>
            </div>

            <div className="mt-5">
              <label className="text-sm text-gray-400 block mb-2">عدد المرافقين (إن وُجد)</label>
              <div className="flex items-center justify-center gap-4">
                <button
                  type="button"
                  onClick={() => setCompanions((c) => Math.max(0, c - 1))}
                  className="w-9 h-9 rounded-full border border-gray-600 text-gray-300"
                >
                  −
                </button>
                <span className="text-lg w-6 text-center">{companions}</span>
                <button
                  type="button"
                  onClick={() => setCompanions((c) => Math.min(20, c + 1))}
                  className="w-9 h-9 rounded-full border border-gray-600 text-gray-300"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        )}

        {state === 'done' && (
          <div className="rounded-2xl border border-[#c9a25c]/30 bg-white/5 backdrop-blur-sm px-6 py-10 text-center">
            {finalResponse === 'confirmed' ? (
              <>
                <p className="text-[#c9a25c] text-xl font-semibold mb-2">تم تأكيد حضوركم 🎉</p>
                <p className="text-gray-400 text-sm">يسعدنا استقبالكم، بانتظاركم</p>
              </>
            ) : (
              <>
                <p className="text-gray-200 text-xl font-semibold mb-2">تم استلام اعتذاركم</p>
                <p className="text-gray-400 text-sm">شكرًا لإخبارنا، نتمنى رؤيتكم في مناسبة قادمة 🌸</p>
              </>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

export default function RsvpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0d1117]" />}>
      <RsvpPageInner />
    </Suspense>
  )
}
