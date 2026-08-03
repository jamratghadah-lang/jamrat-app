// netlify/functions/event-checkin.js
//
// تستقبل رمز المناسبة + الكود اللي انمسح، وتتحقق منه على السيرفر مباشرة
// (مو محلياً بالجهاز) — عشان أي عدد من الأجهزة/الأبواب يستخدمون نفس البيانات
// الحية بنفس اللحظة.

const { getStore, connectLambda } = require("@netlify/blobs");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ ok: false, message: "بيانات غير صالحة" }) };
  }

  const { eventCode, code } = payload;
  if (!eventCode || !code) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, message: "لازم رمز المناسبة والكود" }) };
  }

  try {
    connectLambda(event);
    const store = getStore({ name: "jamrat-events", consistency: "strong" });
    const data = await store.get(eventCode, { type: "json" });

    if (!data) {
      return { statusCode: 200, body: JSON.stringify({ ok: false, status: "no_event" }) };
    }

    const idx = (data.guests || []).findIndex(
      (g) => (g.entryCode || "").toLowerCase() === String(code).trim().toLowerCase()
    );

    if (idx === -1) {
      return { statusCode: 200, body: JSON.stringify({ ok: true, status: "fail" }) };
    }

    const guest = data.guests[idx];

    if (guest.checkedIn) {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true, status: "repeat", guest: { name: guest.name, checkedInAt: guest.checkedInAt } }),
      };
    }

    guest.checkedIn = true;
    guest.checkedInAt = new Date().toISOString();
    data.guests[idx] = guest;
    await store.setJSON(eventCode, data);

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true, status: "ok", guest: { name: guest.name } }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, message: "تعذر الاتصال بالسيرفر" }) };
  }
};
