// Default loading state shown by Next.js Suspense boundaries while a
// page or layout is being streamed. Kept intentionally minimal so it
// never clashes with the dashboard's chrome.
export default function Loading() {
  return (
    <div className="flex h-full items-center justify-center bg-[#0d1117] text-gray-500">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        <p className="text-sm">جاري التحميل…</p>
      </div>
    </div>
  )
}
