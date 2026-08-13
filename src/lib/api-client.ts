// ============ API Helpers ============
// NO X-Api-Config header — all API keys are server-side env vars now

import { useAppStore } from './store-core'

const API = (path: string, opts?: RequestInit) => {
  const base = '/api'
  let headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (typeof window !== 'undefined') {
    try {
      const state = useAppStore.getState()
      if (state.token) {
        headers['Authorization'] = 'Bearer ' + state.token
      }
    } catch {}
  }
  return fetch(base + path, {
    ...opts,
    headers: { ...headers, ...(opts?.headers as Record<string, string> || {}) },
  })
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    API('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }).then(r => r.json()),
  getMe: () => API('/auth/me').then(r => r.json()),
  changePassword: (currentPassword: string, newPassword: string) =>
    API('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }).then(async r => {
      const out = await r.json()
      if (!r.ok) throw new Error(out?.error || 'فشل تغيير كلمة المرور')
      // The server invalidates the old session and returns a new bearer
      // token — persist it so subsequent requests are authenticated.
      if (out?.token) {
        try { useAppStore.getState().setToken(out.token) } catch { /* ignore */ }
      }
      return out
    }),
  logoutAll: () => API('/auth/logout-all', { method: 'POST' }).then(r => r.json()),

  // Events
  getEvents: (params?: string) => API(`/events${params ? '?' + params : ''}`).then(r => r.json()),
  createEvent: (data: Record<string, unknown>) => API('/events', { method: 'POST', body: JSON.stringify(data) }).then(r => r.json()),
  updateEvent: (id: string, data: Record<string, unknown>) => API(`/events/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then(r => r.json()),
  deleteEvent: (id: string) => API(`/events/${id}`, { method: 'DELETE' }).then(r => r.json()),
  archiveEvent: (id: string) => API(`/events/${id}/archive`, { method: 'POST' }).then(r => r.json()),
  restoreEvent: (id: string) => API(`/events/${id}/restore`, { method: 'POST' }).then(r => r.json()),

  // Guests
  getGuests: (params?: string) => API(`/guests${params ? '?' + params : ''}`).then(r => r.json()),
  createGuest: (data: Record<string, unknown>) => API('/guests', { method: 'POST', body: JSON.stringify(data) }).then(r => r.json()),
  updateGuest: (id: string, data: Record<string, unknown>) => API(`/guests/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(r => r.json()),
  deleteGuest: (id: string) => API(`/guests/${id}`, { method: 'DELETE' }).then(r => r.json()),
  bulkDeleteGuests: (ids: string[]) => API('/guests/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }).then(r => r.json()),
  getGuestQR: (id: string, color?: string) => API(`/guests/${id}/qr${color ? '?color=' + encodeURIComponent(color) : ''}`).then(r => r.text()),
  revokeGuestQR: (id: string) => API(`/guests/${id}/revoke-qr`, { method: 'POST' }).then(r => r.json()),
  getGuestEditLogs: (id: string) => API(`/guests/${id}/edit-logs`).then(r => r.json()),

  // Checkin
  checkin: (data: { guestId?: string; qrToken?: string; eventId?: string; method: 'qr' | 'manual'; companions?: number }) =>
    API('/checkin', { method: 'POST', body: JSON.stringify(data) }).then(r => r.json()),
  getCheckins: (params?: string) => API(`/checkin${params ? '?' + params : ''}`).then(r => r.json()),

  // Send Log
  getSendLogs: (params?: string) => API(`/send-log${params ? '?' + params : ''}`).then(r => r.json()),

  // Templates
  getTemplates: () => API('/templates').then(r => r.json()),
  createTemplate: (data: Record<string, unknown>) => API('/templates', { method: 'POST', body: JSON.stringify(data) }).then(r => r.json()),
  updateTemplate: (id: string, data: Record<string, unknown>) => API(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }).then(r => r.json()),
  deleteTemplate: (id: string) => API(`/templates/${id}`, { method: 'DELETE' }).then(r => r.json()),

  // Comments
  getComments: (eventId: string) => API(`/comments?eventId=${eventId}`).then(r => r.json()),
  createComment: (data: { eventId: string; guestName: string; text: string }) =>
    API('/comments', { method: 'POST', body: JSON.stringify(data) }).then(r => r.json()),

  // Trash
  getTrash: () => API('/trash').then(r => r.json()),
  restoreTrash: (id: string) => API(`/trash/${id}/restore`, { method: 'POST' }).then(r => r.json()),
  deleteTrashItem: (id: string) => API(`/trash/${id}`, { method: 'DELETE' }).then(r => r.json()),
  emptyTrash: () => API('/trash/empty', { method: 'POST', body: JSON.stringify({ confirm: true }) }).then(r => r.json()),

  // Operations Log
  getOpLogs: () => API('/operations-log').then(r => r.json()),

  // Stats
  getStats: () => API('/stats').then(r => r.json()),

  // Users
  getUsers: () => API('/users').then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data?.error || 'فشل جلب المستخدمين'); return data }),
  createUser: (data: Record<string, unknown>) => API('/users', { method: 'POST', body: JSON.stringify(data) }).then(async r => { const out = await r.json(); if (!r.ok) throw new Error(out?.error || 'فشل إنشاء المستخدم'); return out }),
  updateUser: (data: Record<string, unknown>) => API('/users', { method: 'PATCH', body: JSON.stringify(data) }).then(async r => { const out = await r.json(); if (!r.ok) throw new Error(out?.error || 'فشل تعديل المستخدم'); return out }),

  // Integrations
  saveIntegration: (data: { key: string; config: Record<string, string>; enabled?: boolean }) =>
    API('/integrations', { method: 'POST', body: JSON.stringify(data) }).then(async r => { const out = await r.json(); if (!r.ok) throw new Error(out?.error || 'فشل حفظ الإعدادات'); return out }),
  getIntegrations: () => API('/integrations').then(async r => { const out = await r.json(); if (!r.ok) throw new Error(out?.error || 'فشل جلب التكاملات'); return out }),
  testConnection: (service: string) =>
    API('/integrations/test', { method: 'POST', body: JSON.stringify({ key: service }) }).then(r => r.json()),

  // Schedules
  getSchedules: (params?: string) => API(`/schedules${params ? '?' + params : ''}`).then(r => r.json()),
  createSchedule: (data: Record<string, unknown>) =>
    API('/schedules', { method: 'POST', body: JSON.stringify(data) }).then(r => r.json()),
  cancelSchedule: (id: string) =>
    API(`/schedules/${id}`, { method: 'DELETE' }).then(r => r.json()),

  // Media
  getMedia: (eventId?: string) => API(`/media${eventId ? '?eventId=' + encodeURIComponent(eventId) : ''}`).then(async r => { const out = await r.json(); if (!r.ok) throw new Error(out?.error || 'فشل جلب الوسائط'); return out }),
  createMedia: (data: Record<string, unknown>) => API('/media', { method: 'POST', body: JSON.stringify(data) }).then(async r => { const out = await r.json(); if (!r.ok) throw new Error(out?.error || 'فشل إضافة الوسائط'); return out }),
  deleteMedia: (id: string) => API(`/media?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).then(async r => { const out = await r.json(); if (!r.ok) throw new Error(out?.error || 'فشل حذف الوسائط'); return out }),

  // Send Center
  sendMessages: (data: Record<string, unknown>) =>
    API('/send', { method: 'POST', body: JSON.stringify(data) }).then(r => r.json()),

  // Backup
  createBackup: () => API('/backup', { method: 'POST' }).then(r => r.json()),
  restoreBackup: (id: string) =>
    API(`/backup/${id}/restore`, { method: 'POST' }).then(r => r.json()),
  getBackups: () => API('/backup').then(r => r.json()),

  // Event Assignments
  getEventAssignments: (eventId: string) => API(`/events/${eventId}/assign`).then(async r => { const out = await r.json(); if (!r.ok) throw new Error(out?.error || 'فشل جلب التعيينات'); return out }),
  assignEventUser: (eventId: string, userId: string, role: string) => API(`/events/${eventId}/assign`, { method: 'POST', body: JSON.stringify({ userId, role }) }).then(async r => { const out = await r.json(); if (!r.ok) throw new Error(out?.error || 'فشل التعيين'); return out }),
  revokeEventUser: (eventId: string, userId: string) => API(`/events/${eventId}/assign?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' }).then(async r => { const out = await r.json(); if (!r.ok) throw new Error(out?.error || 'فشل إلغاء التعيين'); return out }),

  // Event Closure
  closeEvent: (id: string, data: Record<string, unknown>) =>
    API(`/events/${id}/close`, { method: 'POST', body: JSON.stringify(data) }).then(r => r.json()),

  // Site Sync
  getSiteSyncStatus: () => API('/site-sync').then(async r => { const out = await r.json(); if (!r.ok) throw new Error(out?.error || 'فشل جلب حالة المزامنة'); return out }),
  triggerSiteSync: (data: { entity?: string; eventId?: string }) =>
    API('/site-sync', { method: 'POST', body: JSON.stringify(data) }).then(async r => { const out = await r.json(); if (!r.ok) throw new Error(out?.error || 'فشل المزامنة'); return out }),
}

export function escapeHtml(str: string | undefined | null): string {
  if (!str) return ''
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
