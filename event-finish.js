// netlify/functions/event-finish.js
//
// تحوّل مناسبة من "نشطة" إلى "منتهية" (بعد ما تخلصين إرسال رسائل الشكر)،
// أو ترجّعها "نشطة" مرة ثانية لو احتجتِ. البيانات نفسها (المدعوين، حالات
// تسجيل الدخول) ما تُحذف أبدًا — بس تتغيّر حالة العرض باللوحة.

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

  const { eventCode, status } = payload; // status: "finished" | "active"
  if (!eventCode || !["finished", "active"].includes(status)) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, message: "بيانات ناقصة" }) };
  }

  try {
    connectLambda(event);
    const store = getStore({ name: "jamrat-events-registry", consistency: "strong" });
    const registry = (await store.get("index", { type: "json" })) || { events: [] };

    const idx = registry.events.findIndex((e) => e.eventCode === eventCode);
    if (idx < 0) {
      return { statusCode: 404, body: JSON.stringify({ ok: false, message: "المناسبة غير مسجّلة" }) };
    }

    registry.events[idx].status = status;
    registry.events[idx].finishedAt = status === "finished" ? new Date().toISOString() : null;

    await store.setJSON("index", registry);
    return { statusCode: 200, body: JSON.stringify({ ok: true, events: registry.events }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, message: String(err) }) };
  }
};
