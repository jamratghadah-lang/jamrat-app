// netlify/functions/event-reset.js
//
// تصفّر (تحذف) بيانات مناسبة معينة بالكامل من على السيرفر — يحتاج الرقم
// السري الصحيح حق نفس المناسبة، عشان محد يقدر يصفّر مناسبتك إلا انتي.
// بعد التصفير، رمز المناسبة يصير حر تقدرين تستخدمينه من جديد لمناسبة ثانية.

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

  const { eventCode, pin } = payload;
  if (!eventCode || !pin) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, message: "لازم رمز المناسبة والرقم السري" }) };
  }

  try {
    connectLambda(event);
    const store = getStore({ name: "jamrat-events", consistency: "strong" });
    const existing = await store.get(eventCode, { type: "json" });

    if (!existing) {
      return { statusCode: 200, body: JSON.stringify({ ok: false, message: "ما فيه مناسبة بهذا الرمز" }) };
    }
    if (existing.pin !== pin) {
      return { statusCode: 403, body: JSON.stringify({ ok: false, message: "الرقم السري غير صحيح" }) };
    }

    await store.delete(eventCode);
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, message: "تعذر الاتصال بالسيرفر" }) };
  }
};
