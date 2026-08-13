'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Application error boundary:', error)
  }, [error])

  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-[#0d1117] text-gray-200 flex items-center justify-center p-6">
        <main className="w-full max-w-md rounded-2xl border border-[#30363d] bg-[#161b22] p-8 text-center">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400 text-xl">!</div>
          <h1 className="text-xl font-bold mb-2">حدث خطأ غير متوقع</h1>
          <p className="text-sm text-gray-400 mb-6">تعذر تحميل هذه الصفحة. يمكنك المحاولة مرة أخرى.</p>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-[#0d1117] hover:bg-amber-400 transition"
          >
            إعادة المحاولة
          </button>
        </main>
      </body>
    </html>
  )
}
