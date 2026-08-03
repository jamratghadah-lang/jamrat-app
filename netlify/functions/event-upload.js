// netlify/functions/event-upload.js
//
// ترفع أو تحدّث قائمة مدعوين مناسبة معينة على مخزن Netlify Blobs.
// كل مناسبة لها "رمز مناسبة" (eventCode) و"رقم سري" (pin) تختارينهم إنتي.
// إذا رمز المناسبة مستخدم من قبل، لازم يطابق نفس الرقم السري وإلا يرفض التحديث
// (عشان محد يقدر يبدّل بيانات مناسبتك بس بمعرفة رمزها).
//
// يحتاج تفعيل Netlify Blobs (يجي تلقائي مع أي موقع Netlify، بس لازم حزمة
// @netlify/blobs موجودة بـ package.json حق مشروعك).
//
// متغيرات البيئة المطلوبة:
//   SEND_SECRET = نفس كلمة السر المستخدمة بباقي الدوال (حماية إضافية حتى ما
//                 يقدر أي شخص يرفع بيانات من برّه تطبيقك)

const { getStore, connectLambda } = require("@netlify/blobs");

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

  const { eventCode, pin, guests } = payload;
  if (!eventCode || !pin || !Array.isArray(guests)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ ok: false, message: "لازم رمز المناسبة والرقم السري وقائمة المدعوين" }),
    };
  }

  try {
    connectLambda(event);
    const store = getStore({ name: "jamrat-events", consistency: "strong" });
    const existing = await store.get(eventCode, { type: "json" });

    if (existing && existing.pin !== pin) {
      return {
        statusCode: 403,
        body: JSON.stringify({ ok: false, message: "رمز المناسبة هذا مستخدم برقم سري مختلف" }),
      };
    }

    // نحافظ على حالة الحضور المسجلة سابقاً لو الأكواد نفسها موجودة من قبل
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
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true, count: merged.length }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, message: "تعذر الحفظ بالسيرفر" }) };
  }
};
