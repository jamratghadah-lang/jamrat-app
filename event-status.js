// netlify/functions/event-status.js
//
// ترجع حالة الحضور الحية لمناسبة معينة: كم وصل من كم، وأسماء اللي وصلوا.
// GET /.netlify/functions/event-status?eventCode=XXXX

const { getStore, connectLambda } = require("@netlify/blobs");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const eventCode = event.queryStringParameters && event.queryStringParameters.eventCode;
  if (!eventCode) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, message: "لازم رمز المناسبة" }) };
  }

  try {
    connectLambda(event);
    const store = getStore({ name: "jamrat-events", consistency: "strong" });
    const data = await store.get(eventCode, { type: "json" });

    if (!data) {
      return { statusCode: 200, body: JSON.stringify({ ok: false, status: "no_event" }) };
    }

    const guests = data.guests || [];
    const arrived = guests.filter((g) => g.checkedIn);

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        total: guests.length,
        arrivedCount: arrived.length,
        arrived: arrived
          .map((g) => ({ name: g.name, checkedInAt: g.checkedInAt }))
          .sort((a, b) => (a.checkedInAt < b.checkedInAt ? 1 : -1)),
        updatedAt: data.updatedAt || null,
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, message: "تعذر الاتصال بالسيرفر" }) };
  }
};
