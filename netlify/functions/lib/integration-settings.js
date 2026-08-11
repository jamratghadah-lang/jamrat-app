const crypto = require('crypto');
const { getApps, initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

function adminApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON_MISSING');
  const serviceAccount = JSON.parse(raw);
  return initializeApp({ credential: cert(serviceAccount) });
}

function db() { return getFirestore(adminApp()); }

function encryptionKey() {
  const configured = process.env.INTEGRATION_SETTINGS_ENCRYPTION_KEY;
  const material = configured || process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!material) throw new Error('INTEGRATION_SETTINGS_ENCRYPTION_KEY_MISSING');
  return crypto.createHash('sha256').update(material).digest();
}

function encrypt(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function decrypt(payload) {
  const [ivB64, tagB64, dataB64] = String(payload).split('.');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivB64, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64url')), decipher.final()]).toString('utf8');
}

const ALLOWED_KEYS = new Set([
  'whatsappToken', 'whatsappPhoneId', 'sendSecret',
  'resendApiKey', 'sendFrom',
  'cloudinaryCloudName', 'cloudinaryApiKey', 'cloudinaryApiSecret', 'cloudinaryUploadPreset'
]);

async function getSettingsDoc() {
  const snap = await db().collection('appSettings').doc('integrations').get();
  return snap.exists ? (snap.data() || {}) : {};
}

async function getIntegration(key) {
  if (!ALLOWED_KEYS.has(key)) return '';
  const data = await getSettingsDoc();
  return data[key] ? decrypt(data[key]) : '';
}

async function getAllIntegrationKeys() {
  const data = await getSettingsDoc();
  return Object.fromEntries([...ALLOWED_KEYS].map((key) => [key, Boolean(data[key])]));
}

async function setIntegration(key, value) {
  if (!ALLOWED_KEYS.has(key)) throw new Error('INVALID_INTEGRATION_KEY');
  await db().collection('appSettings').doc('integrations').set({
    [key]: encrypt(value),
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

async function deleteIntegration(key) {
  if (!ALLOWED_KEYS.has(key)) throw new Error('INVALID_INTEGRATION_KEY');
  const { FieldValue } = require('firebase-admin/firestore');
  await db().collection('appSettings').doc('integrations').update({
    [key]: FieldValue.delete(),
    updatedAt: new Date().toISOString(),
  });
}

module.exports = { adminApp, db, getIntegration, getAllIntegrationKeys, setIntegration, deleteIntegration, ALLOWED_KEYS };
