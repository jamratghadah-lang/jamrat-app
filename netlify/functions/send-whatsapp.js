// netlify/functions/send-whatsapp.js
//
// يرسل رسالة واتساب حقيقية عبر Meta Cloud API.
// إذا وصله videoUrl يرسله كفيديو حقيقي (يشغّل جوا الشات) مو كرابط نصي.
// إذا وصله cardUrl (بدون فيديو) يرسله كصورة حقيقية.
// إذا ما وصله ولا وحده، يرسل نص عادي.
//
// متغيرات البيئة المطلوبة بإعدادات Netlify (Site settings → Environment variables):
//   WHATSAPP_TOKEN      = التوكن الدائم من Meta for Developers
//   WHATSAPP_PHONE_ID   = Phone Number ID حق حسابك بواتساب بزنس
//   SEND_SECRET          = كلمة سر تختارينها إنتي (نفسها اللي بتحطينها بخانة "كلمة سر الإرسال" بإعدادات التطبيق)
//
// ملاحظة مهم: فيديو الواتساب عبر Cloud API لازم يكون حجمه أقل من 16 ميجا،
// ورابطه لازم يكون رابط عام (public) يقدر يوصله سيرفر Meta -- رابط Cloudinary يشتغل تمام.

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

  const { to, message, videoUrl, cardUrl } = payload;
  if (!to) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, message: "رقم الجوال مطلوب" }) };
  }

  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, message: "إعدادات واتساب ناقصة بالسيرفر" }) };
  }

  const apiUrl = `https://graph.facebook.com/v19.0/${phoneId}/messages`;

  async function sendMsg(msgBody) {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(msgBody),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  }

  // نرسل كل شي موجود فعلياً كرسالة مستقلة: فيديو (لو موجود) + صورة البطاقة
  // (لو موجودة) + نص الرسالة — بدل ما نختار وحدة بس ونتجاهل الباقي.
  try {
    let sentAny = false;
    let lastError = null;

    if (videoUrl) {
      const r = await sendMsg({
        messaging_product: "whatsapp",
        to,
        type: "video",
        video: { link: videoUrl },
      });
      if (r.ok) sentAny = true;
      else lastError = r.data?.error?.message;
    }

    if (cardUrl) {
      const r = await sendMsg({
        messaging_product: "whatsapp",
        to,
        type: "image",
        image: { link: cardUrl },
      });
      if (r.ok) sentAny = true;
      else lastError = r.data?.error?.message;
    }

    if (message) {
      const r = await sendMsg({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: message },
      });
      if (r.ok) sentAny = true;
      else lastError = r.data?.error?.message;
    }

    if (!sentAny) {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: false, message: lastError || "فشل إرسال الواتساب" }),
      };
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: false, message: "تعذر الاتصال بواتساب" }),
    };
  }
};
