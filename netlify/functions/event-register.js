// netlify/functions/event-register.js
//
// تسجّل مناسبة جديدة (أو تحدّث بيانات مناسبة موجودة) بسجل المناسبات المركزي،
// عشان تظهر بلوحة "إدارة المناسبات" (events.html). كل مناسبة تضل بقسمها
// "نشطة" لين تُنهى يدويًا (event-finish) — تقدرين تشتغلين على عدة عميلات
// بنفس الوقت، كل وحدة بقسمها المستقل.

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

  const { eventCode, clientName, eventType, eventDate, slug } = payload;
  if (!eventCode || !clientName) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, message: "لازم رمز المناسبة واسم العميلة" }) };
  }

  try {
    connectLambda(event);
    const store = getStore({ name: "jamrat-events-registry", consistency: "strong" });
    const registry = (await store.get("index", { type: "json" })) || { events: [] };

    const idx = registry.events.findIndex((e) => e.eventCode === eventCode);
    const entry = {
      eventCode,
      clientName,
      eventType: eventType || "",
      eventDate: eventDate || "",
      slug: slug || "",
      status: "active",
      createdAt: idx >= 0 ? registry.events[idx].createdAt : new Date().toISOString(),
      finishedAt: null,
    };

    if (idx >= 0) {
      registry.events[idx] = { ...registry.events[idx], ...entry, status: registry.events[idx].status };
    } else {
      registry.events.push(entry);
    }

    await store.setJSON("index", registry);
    return { statusCode: 200, body: JSON.stringify({ ok: true, events: registry.events }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, message: String(err) }) };
  }
};
