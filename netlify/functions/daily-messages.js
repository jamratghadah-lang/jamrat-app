// netlify/functions/daily-messages.js
//
// تشتغل تلقائياً كل يوم (بدون ما تحتاجين تفتحين أي شي) — تستخدم نفس المنطق
// اللي بملف lib/messages-core.js. لتشغيلها يدوياً فوراً، استخدمي بدالها
// run-daily-messages-now.js (نفس المنطق، بس عن طريق زر بالصفحة).

const { schedule } = require("@netlify/functions");
const { runDailyMessages } = require("./lib/messages-core");

exports.handler = schedule("@daily", async (event) => {
  try {
    const result = await runDailyMessages();
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, message: String(err) }) };
  }
});
