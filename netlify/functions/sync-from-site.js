// netlify/functions/sync-from-site.js
//
// يربط تطبيق الاستقبال (jamrat-app) بموقع جمرة غضى الرئيسي (my_projet):
// يقرأ كل الردود المؤكدة (status = "yes") من Firestore الخاص بالموقع
// لدعوة معيّنة (slug)، ويحوّلها لقائمة مدعوين، ويرفعها لنفس مخزن
// Netlify Blobs اللي يستخدمه event-checkin و event-status — بنفس منطق
// الدمج اللي يحافظ على حالة "وصل" لأي ضيف اتسجل دخوله من قبل.
//
// الاستخدام: POST /.netlify/functions/sync-from-site
// body: { slug, eventCode, pin }
// header: x-send-secret = نفس SEND_SECRET المستخدم بباقي دوال التطبيق
//
// متغيرات البيئة المطلوبة:
//   SEND_SECRET = كلمة سر الحماية (نفسها المستخدمة بدوال الإرسال بهذا التطبيق)

const { getStore, connectLambda } = require("@netlify/blobs");

const PROJECT_ID = "jamrat-ghadah";

// اتصال Firestore بصلاحية إدارية (Admin) — لازم لأن قواعد أمان الموقع
// تشترط تسجيل دخول لقراءة مجموعة "responses". يتطلب متغيّر بيئة
// FIREBASE_SERVICE_ACCOUNT_JSON (نفس القيمة المستخدمة بمشروع الموقع my_projet).
let _adminDb = null;
function getAdminDb() {
  if (_adminDb) return _adminDb;
  const admin = require("firebase-admin");
  if (!admin.apps.length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON غير مضبوطة بإعدادات Netlify");
    const serviceAccount = JSON.parse(raw);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: PROJECT_ID });
  }
  _adminDb = admin.firestore();
  return _adminDb;
}

// كود دخول احتياطي لو رد قديم اترسل قبل إضافة هذي الميزة وما فيه entryCode
// محفوظ أصلاً — عشان القائمة ما تنكسر، نولّد كود ثابت مبني على معرّف الرد نفسه.
function fallbackEntryCode(responseId) {
  return "JG-" + responseId.slice(-8).toUpperCase();
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const secret = event.headers["x-send-secret"] || event.headers["X-Send-Secret"];
  if (!process.env.SEND_SECRET || secret !== process.env.SEND_SECRET) {
    return { statusCode: 401, body: JSON.stringify({ ok: false, message: "كلمة السر غير صحيحة" }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ ok: false, message: "بيانات غير صالحة" }) };
  }

  const { slug, eventCode, pin } = payload;
  if (!slug || !eventCode || !pin) {
    return {
      statusCode: 400,
      body: JSON.stringify({ ok: false, message: "لازم slug (اسم قالب الدعوة بالموقع) ورمز المناسبة والرقم السري" }),
    };
  }

  try {
    // 1) اقرأ الردود المؤكدة من Firestore حق الموقع الرئيسي (بصلاحية إدارية)
    const snap = await getAdminDb().collection("responses").get();

    const guests = [];
    snap.forEach((doc) => {
      const f = doc.data() || {};
      const style = f.style || "";
      const status = f.status || "";
      if (style !== slug || status !== "yes") return;

      const name = f.name || "ضيف";
      const phone = f.phone || "";
      const entryCode = f.entryCode || fallbackEntryCode(doc.id);

      guests.push({ name, phone, entryCode });
    });

    if (!guests.length) {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: false, message: "ما لقينا أي ردود مؤكدة بهذي الدعوة (" + slug + ") بالموقع" }),
      };
    }

    // 2) ارفعها لمخزن Blobs بنفس منطق event-upload (يحافظ على حالة الوصول القديمة)
    connectLambda(event);
    const store = getStore({ name: "jamrat-events", consistency: "strong" });
    const existing = await store.get(eventCode, { type: "json" });

    if (existing && existing.pin !== pin) {
      return {
        statusCode: 403,
        body: JSON.stringify({ ok: false, message: "رمز المناسبة هذا مستخدم برقم سري مختلف" }),
      };
    }

    const prevByCode = {};
    if (existing && Array.isArray(existing.guests)) {
      for (const g of existing.guests) prevByCode[g.entryCode] = g;
    }
    const merged = guests.map((g) => {
      const prev = prevByCode[g.entryCode];
      return prev && prev.checkedIn
        ? { ...g, checkedIn: true, checkedInAt: prev.checkedInAt }
        : g;
    });

    await store.setJSON(eventCode, {
      pin,
      guests: merged,
      updatedAt: new Date().toISOString(),
      syncedFromSite: true,
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true, count: merged.length }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, message: "تعذر الاتصال بالسيرفر: " + String(err) }) };
  }
};
