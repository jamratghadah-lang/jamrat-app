// netlify/functions/events-list.js
//
// يرجّع كل المناسبات المسجّلة (نشطة ومنتهية) — يستخدمها events.html
// لعرض لوحة "إدارة المناسبات" اللي تسمح بالشغل على أكثر من عميلة بنفس الوقت.

const { getStore, connectLambda } = require("@netlify/blobs");

exports.handler = async (event) => {
  const secret = event.headers["x-send-secret"] || event.headers["X-Send-Secret"];
  if (!process.env.SEND_SECRET || secret !== process.env.SEND_SECRET) {
    return { statusCode: 401, body: JSON.stringify({ ok: false, message: "كلمة السر غير صحيحة" }) };
  }

  try {
    connectLambda(event);
    const store = getStore({ name: "jamrat-events-registry", consistency: "strong" });
    const registry = (await store.get("index", { type: "json" })) || { events: [] };
    return { statusCode: 200, body: JSON.stringify({ ok: true, events: registry.events || [] }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, message: String(err) }) };
  }
};
