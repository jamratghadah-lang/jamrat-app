// netlify/functions/send-email.js
//
// يرسل إيميل حقيقي عبر Resend، ويرفق الفيديو وصورة البطاقة كمرفقات حقيقية
// (Resend يدعم تمرير رابط عام بـ attachments[].path ويجيب الملف ويرفقه فعلياً،
// مو مجرد رابط بالنص).
//
// متغيرات البيئة المطلوبة بإعدادات Netlify (Site settings → Environment variables):
//   RESEND_API_KEY = مفتاح API من حساب Resend
//   SEND_FROM       = عنوان المرسل، مثال: "جمرة غادة <invites@yourdomain.com>"
//   SEND_SECRET أو SEND_EMAIL_SECRET = نفس كلمة السر اللي تكتبينها بخانة
//     "كلمة سر الإرسال" بإعدادات التطبيق (يقبل الاسمين، أيهما موجود)
//
// ملاحظة: حجم المرفقات الإجمالي عند Resend له حد أقصى (عادة حوالي 40 ميجا)،
// فيديو 15 ميجا + صورة بطاقة صغيرة يدخل ضمن الحد بارتياح.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, x-send-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

exports.handler = async (event) => {
  // طلب preflight من المتصفح (يحصل أحياناً حتى مع نفس النطاق حسب الإعدادات) —
  // بدون هذا الرد، المتصفح يعتبر الطلب "تعذر الاتصال بالخادم" فعليًا.
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS_HEADERS, body: "Method Not Allowed" };
  }

  const secret = event.headers["x-send-secret"] || event.headers["X-Send-Secret"];
  const expectedSecret = process.env.SEND_SECRET || process.env.SEND_EMAIL_SECRET;
  if (!expectedSecret || secret !== expectedSecret) {
    return {
      statusCode: 401,
      headers: CORS_HEADERS,
      body: JSON.stringify({ ok: false, message: "كلمة السر غير صحيحة" }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ ok: false, message: "بيانات غير صالحة" }),
    };
  }

  const { to, subject, text, videoUrl, cardUrl } = payload;
  if (!to) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ ok: false, message: "الإيميل مطلوب" }),
    };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SEND_FROM;
  if (!apiKey || !from) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ ok: false, message: "إعدادات الإيميل ناقصة بالسيرفر (RESEND_API_KEY / SEND_FROM)" }),
    };
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
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ ok: false, message: data?.message || "فشل إرسال الإيميل" }),
      };
    }

    return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ ok: false, message: "تعذر الاتصال بخادم الإيميل (Resend)" }),
    };
  }
};
