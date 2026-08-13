'use client'

import { create } from 'zustand'

export type PageKey =
  | 'dashboard' | 'events' | 'guests' | 'checkin' | 'qr'
  | 'sendcenter' | 'templates' | 'schedule' | 'sendlog'
  | 'videos' | 'robot' | 'statistics' | 'reports'
  | 'users' | 'alerts' | 'trash' | 'archive' | 'log'
  | 'integrations' | 'settings' | 'guest-confirm'
  | 'invitation-editor' | 'event-closure' | 'site-sync'

export interface EventItem {
  id: string; name: string; client: string; clientPhone: string
  date: string; time: string; location: string; status: string
  password: string; guests: number; confirmed: number; attended: number
  notes: string; hasInteractivePage: boolean; createdAt: string; updatedAt: string
}
export interface GuestItem {
  id: string; eventId: string; name: string; phone: string
  email: string; companions: number; sendStatus: string
  confirmed: string; attended: string; hasQR: boolean; qrRevoked?: boolean
  notes: string; createdAt: string; updatedAt: string
}
export interface CheckinItem {
  id: string; eventId: string; guestId: string; guestName: string
  companions: number; method: string; operator: string; time: string
}
export interface SendLogItem {
  id: string; eventId: string; guestId?: string; recipient: string
  type: string; channel: string; status: string; failReason: string; time: string
}
export interface TemplateItem {
  id: string; name: string; type: string; text: string
  createdAt: string; updatedAt: string
}
export interface CommentItem {
  id: string; eventId: string; guestName: string; text: string; createdAt: string
}
export interface TrashItem {
  id: string; name: string; itemType: string; eventRef: string; deletedAt: string
}
export interface OpLogItem {
  id: string; text: string; user: string; time: string
}
export interface Stats {
  totalEvents: number; activeEvents: number; totalGuests: number
  confirmedGuests: number; attendedGuests: number; unconfirmedGuests: number
  absentGuests: number; totalCompanions: number; qrGenerated: number
}
export interface UserItem {
  id: string; name: string; email: string; role: string
  status: string; lastActive: string
}
export interface FirebaseConfig { apiKey: string; authDomain: string; projectId: string; storageBucket: string; messagingSenderId: string; appId: string; serviceAccountJson: string }
export interface WhatsAppConfig { phoneNumberId: string; accessToken: string; verifyToken: string; enabled: boolean }
export interface EmailConfig { apiKey: string; fromEmail: string; sendSecret: string; enabled: boolean }
export interface CloudinaryConfig { cloudName: string; apiKey: string; apiSecret: string; maxVideoMB: number }
export interface SiteConfig { siteUrl: string; autoSync: boolean; realtime: boolean; publicApi: boolean }
export interface RobotConfig { enabled: boolean; replyDate: boolean; helpConfirm: boolean; transferToStaff: boolean; noHallucination: boolean; transferMessage: string; openaiApiKey: string; geminiApiKey: string }
export interface CheckinConfig { password: string; preventDuplicateQR: boolean; logTime: boolean; logOperator: boolean }

export interface ApiConfig {
  firebase: FirebaseConfig
  whatsapp: WhatsAppConfig
  email: EmailConfig
  cloudinary: CloudinaryConfig
  site: SiteConfig
  robot: RobotConfig
  checkin: CheckinConfig
  sendRate: number; reportTime: string; reportEmail: string; dailyReport: boolean
  archiveDays: number; autoArchive: boolean; autoBackup: boolean; backupTime: string; defaultQrColor: string
}

function getInitialConfig(): ApiConfig {
  // SSR-safe: never touch window/localStorage during initial render.
  // We resolve the persisted config inside a useEffect on the client
  // (see useAppStore.persistConfig below) so server and client render
  // the same default first, avoiding hydration mismatches.
  return {
    firebase: { apiKey: '', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '', serviceAccountJson: '' },
    whatsapp: { phoneNumberId: '', accessToken: '', verifyToken: '', enabled: false },
    email: { apiKey: '', fromEmail: '', sendSecret: '', enabled: false },
    cloudinary: { cloudName: '', apiKey: '', apiSecret: '', maxVideoMB: 15 },
    site: { siteUrl: 'https://jamratghadah.com', autoSync: true, realtime: true, publicApi: true },
    robot: { enabled: false, replyDate: true, helpConfirm: true, transferToStaff: true, noHallucination: true, transferMessage: 'سأحولك لموظفنا لمساعدتك. انتظر قليلاً...', openaiApiKey: '', geminiApiKey: '' },
    checkin: { password: '', preventDuplicateQR: true, logTime: true, logOperator: true },
    sendRate: 60, reportTime: '03:00', reportEmail: '', dailyReport: true,
    archiveDays: 30, autoArchive: true, autoBackup: true, backupTime: '03:00',
    defaultQrColor: '#000000',
  }
}

interface AppState {
  user: UserItem | null
  token: string | null
  loggedIn: boolean
  currentPage: PageKey
  sidebarOpen: boolean
  mobileMenuOpen: boolean
  events: EventItem[]
  guests: GuestItem[]
  checkins: CheckinItem[]
  sendLogs: SendLogItem[]
  templates: TemplateItem[]
  comments: CommentItem[]
  trash: TrashItem[]
  opLogs: OpLogItem[]
  stats: Stats
  users: UserItem[]
  apiConfig: ApiConfig
  loading: boolean
  setLoggedIn: (v: boolean) => void
  setUser: (u: UserItem | null) => void
  setToken: (t: string | null) => void
  navigate: (p: PageKey) => void
  toggleSidebar: () => void
  setMobileMenu: (v: boolean) => void
  setData: <K extends keyof AppState>(key: K, data: AppState[K]) => void
  setLoading: (v: boolean) => void
  saveApiConfig: (config: ApiConfig) => void
  resetApiConfig: () => void
}

export const useAppStore = create<AppState>()((set) => ({
  user: null,
  token: null,
  loggedIn: false,
  currentPage: 'dashboard',
  sidebarOpen: true,
  mobileMenuOpen: false,
  events: [],
  guests: [],
  checkins: [],
  sendLogs: [],
  templates: [],
  comments: [],
  trash: [],
  opLogs: [],
  stats: { totalEvents: 0, activeEvents: 0, totalGuests: 0, confirmedGuests: 0, attendedGuests: 0, unconfirmedGuests: 0, absentGuests: 0, totalCompanions: 0, qrGenerated: 0 },
  users: [],
  loading: false,
  apiConfig: getInitialConfig(),
  setLoggedIn: (v) => set({ loggedIn: v }),
  setUser: (u) => set({ user: u }),
  setToken: (t) => set({ token: t }),
  navigate: (p) => set({ currentPage: p, mobileMenuOpen: false }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setMobileMenu: (v) => set({ mobileMenuOpen: v }),
  setData: <K extends keyof AppState>(key: K, data: AppState[K]) => set({ [key]: data } as Pick<AppState, K>),
  setLoading: (v) => set({ loading: v }),
  saveApiConfig: (config) => {
    if (typeof window !== 'undefined') { localStorage.setItem('jamrat_api_config', JSON.stringify(config)) }
    set({ apiConfig: config })
  },
  resetApiConfig: () => {
    if (typeof window !== 'undefined') { localStorage.removeItem('jamrat_api_config') }
    set({ apiConfig: getInitialConfig() })
  },
}))
