// netlify/functions/auth-check.js
//
// يتحقق من بيانات الدخول من عند السيرفر مباشرة — كلمة السر الحقيقية
// مخزنة بمتغيرات البيئة (Environment variables) بـ Netlify فقط، وما توصل
// أبد لجهاز المستخدم ولا تظهر بالكود المصدري.
//
// متغيرات البيئة المطلوبة بإعدادات Netlify:
//   ADMIN_EMAIL       = إيميلك حقك لدخول لوحة الإدارة
//   ADMIN_PASSWORD    = كلمة سر لوحة الإدارة
//   CHECKIN_PASSWORD  = كلمة سر أبسط تعطينها لمسؤول الاستقبال (تسجيل الدخول بس)

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: JSON.stringify({ ok: false, message: "بيانات غير صالحة" }) };
  }

  const { scope, email, password } = payload;

  if (scope === "checkin") {
    if (process.env.CHECKIN_PASSWORD && password === process.env.CHECKIN_PASSWORD) {
      return { statusCode: 200, body: JSON.stringify({ ok: true }) };
    }
    return { statusCode: 200, body: JSON.stringify({ ok: false, message: "كلمة المرور غير صحيحة" }) };
  }

  // scope === "admin" (الافتراضي)
  if (
    process.env.ADMIN_EMAIL &&
    process.env.ADMIN_PASSWORD &&
    email === process.env.ADMIN_EMAIL &&
    password === process.env.ADMIN_PASSWORD
  ) {
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  return { statusCode: 200, body: JSON.stringify({ ok: false, message: "الإيميل أو كلمة المرور غير صحيحة" }) };
};
