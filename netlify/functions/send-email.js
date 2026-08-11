const { requireAdmin } = require('./lib/admin-auth');
// netlify/functions/send-email.js
//
// يرسل إيميل حقيقي عبر Resend، ويرفق الفيديو وصورة البطاقة كمرفقات حقيقية
// (Resend يدعم تمرير رابط عام بـ attachments[].path ويجيب الملف ويرفقه فعلياً،
// مو مجرد رابط بالنص).
//
// متغيرات البيئة المطلوبة بإعدادات Netlify (Site settings → Environment variables):
//   RESEND_API_KEY = مفتاح API من حساب Resend
//   SEND_FROM       = عنوان المرسل، مثال: "جمرة غادة <invites@yourdomain.com>"
//   SEND_SECRET      = نفس كلمة السر المستخدمة بدالة الواتساب
//
// ملاحظة: حجم المرفقات الإجمالي عند Resend له حد أقصى (عادة حوالي 40 ميجا)،
// فيديو 15 ميجا + صورة بطاقة صغيرة يدخل ضمن الحد بارتياح.

const { getIntegration } = require('./lib/integration-settings');

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try { await requireAdmin(event); } catch (err) { return { statusCode: 401, body: JSON.stringify({ ok:false, message:"المصادقة مطلوبة" }) }; }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ ok: false, message: "بيانات غير صالحة" }) };
  }

  const { to, subject, text, videoUrl, cardUrl } = payload;
  if (!to) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, message: "الإيميل مطلوب" }) };
  }

  const apiKey = await getIntegration('resendApiKey').catch(() => '') || process.env.RESEND_API_KEY;
  const from = await getIntegration('sendFrom').catch(() => '') || process.env.SEND_FROM;
  if (!apiKey || !from) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, message: "إعدادات الإيميل ناقصة بالسيرفر" }) };
  }

  const attachments = [];
  if (videoUrl) attachments.push({ filename: "invitation-video.mp4", path: videoUrl });
  if (cardUrl) attachments.push({ filename: "invitation-card.png", path: cardUrl });

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: subject || "دعوتك الخاصة",
        text: text || "",
        attachments: attachments.length ? attachments : undefined,
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: false, message: data?.message || "فشل إرسال الإيميل" }),
      };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, message: "تم إرسال البريد", messageId: data?.id || "" }) };
  } catch (err) {
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: false, message: "تعذر الاتصال بخادم الإيميل" }),
    };
  }
};
