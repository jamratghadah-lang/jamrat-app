import type { Metadata } from "next"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"

export const metadata: Metadata = {
  title: "جمرة غضى — نظام إدارة المناسبات",
  description: "نظام إدارة المناسبات المتكامل — دعوات AI تفاعلية",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="antialiased bg-[#0d1117] text-gray-200">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
