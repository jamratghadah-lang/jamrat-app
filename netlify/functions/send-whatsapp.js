// netlify/functions/send-whatsapp.js
//
// يرسل رسالة واتساب حقيقية عبر Meta Cloud API.
// - لو وصله videoUrl وcardUrl سوا: يرسلهم كرسالتين متتاليتين (فيديو بالكابشن،
//   ثم صورة البطاقة) — عشان الضيف يستلم الاثنين، مو وحد بس.
// - لو وصله واحد منهم بس: يرسله لحاله (فيديو أو صورة).
// - لو ما وصله ولا وحد: يرسل نص عادي.
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

  async function sendPayload(body) {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return { ok: res.ok, data };
  }

  try {
    // نبني قائمة الرسائل المطلوب إرسالها بالترتيب: الفيديو أولاً (فيه الكابشن
    // الأساسي)، ثم صورة البطاقة (بدون كابشن مكرر)، وإلا نص عادي لو ما فيه وسائط.
    const messages = [];
    if (videoUrl) {
      messages.push({
        messaging_product: "whatsapp", to, type: "video",
        video: { link: videoUrl, caption: (message || "").slice(0, 1024) },
      });
    }
    if (cardUrl) {
      messages.push({
        messaging_product: "whatsapp", to, type: "image",
        image: { link: cardUrl, caption: videoUrl ? "" : (message || "").slice(0, 1024) },
      });
    }
    if (!messages.length) {
      messages.push({ messaging_product: "whatsapp", to, type: "text", text: { body: message || "" } });
    }

    let lastErr = "";
    let anyOk = false;
    for (const body of messages) {
      const { ok, data } = await sendPayload(body);
      if (ok) anyOk = true;
      else lastErr = data?.error?.message || "فشل إرسال جزء من الرسالة";
    }

    if (!anyOk) {
      return { statusCode: 200, body: JSON.stringify({ ok: false, message: lastErr || "فشل إرسال الواتساب" }) };
    }

    // لو فيه فيديو والرسالة أطول من حد الكابشن (1024 حرف)، نرسل رسالة نصية
    // ثالثة تحتوي النص كامل عشان ما يضيع جزء منه.
    if (videoUrl && message && message.length > 1024) {
      await sendPayload({ messaging_product: "whatsapp", to, type: "text", text: { body: message } });
    }

    return { statusCode: 200, body: JSON.stringify({ ok: true, partial: !!lastErr, warning: lastErr || undefined }) };
  } catch (err) {
    return { statusCode: 200, body: JSON.stringify({ ok: false, message: "تعذر الاتصال بواتساب" }) };
  }
};
