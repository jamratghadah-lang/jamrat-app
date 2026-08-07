// netlify/functions/run-daily-messages-now.js
//
// نفس فحص وإرسال التذكير/الشكر اللي يصير تلقائي يومياً، بس يشتغل فوراً
// لما تضغطين زر "افحصي الآن" بصفحة events.html — للاختبار والمراقبة.
// ⚠️ يرسل رسائل حقيقية فعلاً لو فيه مناسبة حان وقت تذكيرها أو شكرها اليوم
// (مو محاكاة/تجربة وهمية).

const { connectLambda } = require("@netlify/blobs");
const { runDailyMessages } = require("./lib/messages-core");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const secret = event.headers["x-send-secret"] || event.headers["X-Send-Secret"];
  if (!process.env.SEND_SECRET || secret !== process.env.SEND_SECRET) {
    return { statusCode: 401, body: JSON.stringify({ ok: false, message: "كلمة السر غير صحيحة" }) };
  }

  try {
    connectLambda(event);
    const result = await runDailyMessages();
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, message: String(err) }) };
  }
};
