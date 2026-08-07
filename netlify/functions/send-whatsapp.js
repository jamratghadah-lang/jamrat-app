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

  // نبني الرسالة حسب اللي متوفر: فيديو حقيقي أولاً، وإلا صورة البطاقة، وإلا نص
  let body;
  if (videoUrl) {
    body = {
      messaging_product: "whatsapp",
      to,
      type: "video",
      video: {
        link: videoUrl,
        caption: (message || "").slice(0, 1024),
      },
    };
  } else if (cardUrl) {
    body = {
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: {
        link: cardUrl,
        caption: (message || "").slice(0, 1024),
      },
    };
  } else {
    body = {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: message || "" },
    };
  }

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: false, message: data?.error?.message || "فشل إرسال الواتساب" }),
      };
    }

    // إذا فيه فيديو، نرسل رسالة نصية ثانية تحتوي بقية الرسالة (لأن الكابشن محدود بـ1024 حرف)
    if (videoUrl && message && message.length > 1024) {
      await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: message },
        }),
      });
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: false, message: "تعذر الاتصال بواتساب" }),
    };
  }
};
