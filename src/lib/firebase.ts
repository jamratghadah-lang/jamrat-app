// Firebase lazy init from stored config. All exports are client-only
// (they read localStorage). Server-side callers get null.
//
// NOTE: the `any` types here are intentional — Firebase's modular SDK
// is loaded via dynamic import and its types depend on the firebase
// package's own type definitions. We use a minimal typed surface so
// consumers don't need to know the internal shape.

import type { FirebaseApp } from 'firebase/app'
import type { Firestore } from 'firebase/firestore'
import type { Auth } from 'firebase/auth'
import type { FirebaseStorage } from 'firebase/storage'

interface FirebaseConfigFields {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
  serviceAccountJson: string
}

interface WhatsAppConfigFields {
  phoneNumberId: string
  accessToken: string
  verifyToken: string
  enabled: boolean
}

interface EmailConfigFields {
  apiKey: string
  fromEmail: string
  sendSecret: string
  enabled: boolean
}

interface CloudinaryConfigFields {
  cloudName: string
  apiKey: string
  apiSecret: string
  maxVideoMB: number
}

interface FullApiConfig {
  firebase: FirebaseConfigFields
  whatsapp: WhatsAppConfigFields
  email: EmailConfigFields
  cloudinary: CloudinaryConfigFields
  [key: string]: unknown
}

let _app: FirebaseApp | null = null
let _db: Firestore | null = null
let _auth: Auth | null = null
let _storage: FirebaseStorage | null = null

function readStoredConfig(): FullApiConfig | null {
  if (typeof window === 'undefined') return null
  try {
    const saved = localStorage.getItem('jamrat_api_config')
    if (saved) return JSON.parse(saved) as FullApiConfig
  } catch { /* ignore */ }
  return null
}

export function getFirebaseConfig(): FirebaseConfigFields | null {
  const config = readStoredConfig()
  if (!config) return null
  const fb = config.firebase
  if (fb && fb.apiKey && fb.projectId) {
    return {
      apiKey: fb.apiKey,
      authDomain: fb.authDomain || fb.projectId + '.firebaseapp.com',
      projectId: fb.projectId,
      storageBucket: fb.storageBucket || fb.projectId + '.appspot.com',
      messagingSenderId: fb.messagingSenderId,
      appId: fb.appId,
      serviceAccountJson: fb.serviceAccountJson || '',
    }
  }
  return null
}

export async function initFirebase() {
  if (_app) return { app: _app, db: _db, auth: _auth, storage: _storage }

  const config = getFirebaseConfig()
  if (!config) return null

  try {
    const { initializeApp } = await import('firebase/app')
    const { getFirestore } = await import('firebase/firestore')
    const { getAuth } = await import('firebase/auth')
    const { getStorage } = await import('firebase/storage')

    _app = initializeApp(config)
    _db = getFirestore(_app)
    _auth = getAuth(_app)
    _storage = getStorage(_app)

    return { app: _app, db: _db, auth: _auth, storage: _storage }
  } catch (e) {
    console.error('Firebase init failed:', e)
    return null
  }
}

export function resetFirebase() {
  _app = null; _db = null; _auth = null; _storage = null
}

// WhatsApp helper
export function getWhatsAppConfig(): WhatsAppConfigFields | null {
  const config = readStoredConfig()
  if (!config) return null
  const wa = config.whatsapp
  if (wa && wa.accessToken && wa.phoneNumberId) return wa
  return null
}

// Email/Resend helper
export function getEmailConfig(): EmailConfigFields | null {
  const config = readStoredConfig()
  if (!config) return null
  const em = config.email
  if (em && em.apiKey) return em
  return null
}

// Cloudinary helper
export function getCloudinaryConfig(): CloudinaryConfigFields | null {
  const config = readStoredConfig()
  if (!config) return null
  const cl = config.cloudinary
  if (cl && cl.cloudName) return cl
  return null
}

// Full config getter for client-side utilities
export function getAllConfig(): FullApiConfig | null {
  return readStoredConfig()
}
