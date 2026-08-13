'use client'

import { useAppStore, type PageKey } from '@/lib/store'
import LoginScreen from '@/components/jamra/LoginScreen'
import Sidebar from '@/components/jamra/Sidebar'
import DashboardPage from '@/components/jamra/pages/DashboardPage'
import EventsPage from '@/components/jamra/pages/EventsPage'
import GuestsPage from '@/components/jamra/pages/GuestsPage'
import CheckinPage from '@/components/jamra/pages/CheckinPage'
import QRPage from '@/components/jamra/pages/QRPage'
import SendCenterPage from '@/components/jamra/pages/SendCenterPage'
import TemplatesPage from '@/components/jamra/pages/TemplatesPage'
import SendLogPage from '@/components/jamra/pages/SendLogPage'
import StatisticsPage from '@/components/jamra/pages/StatisticsPage'
import ReportsPage from '@/components/jamra/pages/ReportsPage'
import VideosPage from '@/components/jamra/pages/VideosPage'
import RobotPage from '@/components/jamra/pages/RobotPage'
import UsersPage from '@/components/jamra/pages/UsersPage'
import AlertsPage from '@/components/jamra/pages/AlertsPage'
import IntegrationsPage from '@/components/jamra/pages/IntegrationsPage'
import SchedulePage from '@/components/jamra/pages/SchedulePage'
import TrashPage from '@/components/jamra/pages/TrashPage'
import ArchivePage from '@/components/jamra/pages/ArchivePage'
import OpLogPage from '@/components/jamra/pages/OpLogPage'
import SettingsPage from '@/components/jamra/pages/SettingsPage'
import EventClosurePage from '@/components/jamra/pages/EventClosurePage'
import InvitationEditorPage from '@/components/jamra/pages/InvitationEditorPage'
import SiteSyncPage from '@/components/jamra/pages/SiteSyncPage'

const pages: Record<PageKey, React.ComponentType> = {
  dashboard: DashboardPage,
  events: EventsPage,
  guests: GuestsPage,
  checkin: CheckinPage,
  qr: QRPage,
  sendcenter: SendCenterPage,
  templates: TemplatesPage,
  sendlog: SendLogPage,
  videos: VideosPage,
  robot: RobotPage,
  statistics: StatisticsPage,
  reports: ReportsPage,
  users: UsersPage,
  alerts: AlertsPage,
  integrations: IntegrationsPage,
  schedule: SchedulePage,
  trash: TrashPage,
  archive: ArchivePage,
  log: OpLogPage,
  settings: SettingsPage,
  'guest-confirm': DashboardPage,
  'event-closure': EventClosurePage,
  'invitation-editor': InvitationEditorPage,
  'site-sync': SiteSyncPage,
}

export default function Home() {
  const { loggedIn, currentPage, sidebarOpen, toggleSidebar, user } = useAppStore()

  if (!loggedIn) return <LoginScreen />

  const PageComponent = pages[currentPage] || DashboardPage

  return (
    <div className="flex h-screen overflow-hidden bg-[#0d1117]">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 min-h-16 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between px-4 gap-4">
          <div className="flex items-center gap-3">
            <button onClick={toggleSidebar} className="lg:hidden w-9 h-9 rounded-lg border border-[#30363d] flex items-center justify-center text-gray-400 hover:text-gray-200 transition">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
            </button>
            <div className="relative hidden sm:block">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input type="text" placeholder="بحث سريع..." className="w-56 lg:w-72 rounded-full border border-[#30363d] bg-[#0d1117] pl-10 pr-4 py-2 text-sm text-gray-200 outline-none focus:border-amber-500 transition" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="w-9 h-9 rounded-lg border border-[#30363d] flex items-center justify-center text-gray-400 hover:text-gray-200 transition relative">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#30363d] hover:border-amber-500 transition cursor-pointer">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-xs font-bold text-[#0d1117]">{user?.name?.charAt(0) || 'م'}</div>
              <div className="hidden sm:block">
                <div className="text-xs font-semibold leading-tight">{user?.name || 'مدير النظام'}</div>
                <div className="text-[10px] text-gray-500">{user?.role === 'admin' ? 'مدير' : 'موظف'}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <PageComponent />
        </main>
      </div>
    </div>
  )
}