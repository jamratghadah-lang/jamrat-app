'use client'

import { useState } from 'react'
import { api, useAppStore } from '@/lib/store'

export default function LoginScreen() {
  const { setLoggedIn, setUser, setToken } = useAppStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setError('')
    if (!email || !password) { setError('يرجى ملء جميع الحقول'); return }
    setLoading(true)
    try {
      const res = await api.login(email, password)
      if (res.error) { setError(res.error); return }
      setUser(res.user)
      setToken(res.token)
      setLoggedIn(true)
    } catch {
      setError('حدث خطأ في الاتصال')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d1117]" dir="rtl">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-24 h-[500px] w-[500px] rounded-full bg-amber-500 opacity-20 blur-[100px] animate-pulse" />
        <div className="absolute -bottom-24 -left-24 h-[400px] w-[400px] rounded-full bg-green-800 opacity-20 blur-[100px] animate-pulse" style={{ animationDelay: '7s' }} />
      </div>
      <div className="relative z-10 w-full max-w-md mx-4 rounded-2xl border border-[#30363d] bg-[#161b22] p-10 shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-[#0d1117] text-2xl mb-4 shadow-lg shadow-amber-500/25">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          </div>
          <h1 className="text-3xl font-black bg-gradient-to-l from-gray-100 to-amber-400 bg-clip-text text-transparent">جمرة غضى</h1>
          <p className="text-sm text-gray-500 mt-1">نظام إدارة المناسبات المتكامل</p>
        </div>
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </div>
        )}
        <div className="space-y-4 mb-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2">البريد الإلكتروني</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-4 py-3 text-sm text-gray-200 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15 transition"
              onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-2">كلمة المرور</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[#30363d] bg-[#0d1117] px-4 py-3 text-sm text-gray-200 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/15 transition"
              onKeyDown={e => e.key === 'Enter' && handleLogin()} />
          </div>
        </div>
        <button onClick={handleLogin} disabled={loading}
          className="w-full rounded-lg bg-gradient-to-l from-amber-500 to-amber-700 py-3.5 text-sm font-bold text-[#0d1117] hover:shadow-lg hover:shadow-amber-500/25 transition disabled:opacity-50">
          {loading ? '...' : 'تسجيل الدخول'}
        </button>
        <p className="text-center text-[11px] text-gray-600 mt-4">Phase 3 Hardened — جمرة غضى</p>
      </div>
    </div>
  )
}
