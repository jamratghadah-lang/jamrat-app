const admin = require('firebase-admin');

let db = null;

function getFirestore() {
  if (db) return db;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON غير مضبوطة بإعدادات Netlify');
  const serviceAccount = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID,
    });
  }
  db = admin.firestore();
  return db;
}

const FieldValue = admin.firestore.FieldValue;

async function deleteSubcollection(parentRef, collectionName) {
  const snap = await parentRef.collection(collectionName).get();
  if (snap.empty) return;
  const batchSize = 400;
  for (let i = 0; i < snap.docs.length; i += batchSize) {
    const batch = getFirestore().batch();
    snap.docs.slice(i, i + batchSize).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

module.exports = { getFirestore, FieldValue, deleteSubcollection };
