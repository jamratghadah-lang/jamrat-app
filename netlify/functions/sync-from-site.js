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

const FIREBASE_API_KEY = "AIzaSyAAYOne0CTht9906nStecbqCHkb_CY6glw";
const PROJECT_ID = "jamrat-ghadah";

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
    // 1) اقرأ الردود المؤكدة من Firestore حق الموقع الرئيسي
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/responses?key=${FIREBASE_API_KEY}&pageSize=1000`;
    const res = await fetch(url);
    if (!res.ok) {
      return { statusCode: 200, body: JSON.stringify({ ok: false, message: "تعذرت قراءة بيانات الموقع" }) };
    }
    const data = await res.json();
    const docs = data.documents || [];

    const guests = [];
    for (const doc of docs) {
      const f = doc.fields || {};
      const style = f.style?.stringValue || "";
      const status = f.status?.stringValue || "";
      if (style !== slug || status !== "yes") continue;

      const responseId = doc.name.split("/").pop();
      const name = f.name?.stringValue || "ضيف";
      const phone = f.phone?.stringValue || "";
      const entryCode = f.entryCode?.stringValue || fallbackEntryCode(responseId);

      guests.push({ name, phone, entryCode });
    }

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
