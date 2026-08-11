// netlify/functions/admin-bootstrap.js
//
// يحل مشكلة: إنشاء أول حساب أدمن بالتطبيق كان يُخزَّن محليًا بالمتصفح
// (IndexedDB) فقط، بينما admin-session.js يتحقق من المستخدم بـ Firestore
// حصرًا — فكانت كل الدوال المحمية بجلسة Admin ترفض تسجيل الدخول دايمًا.
//
// هالدالة تنشئ/تزامن مستخدم Firestore الحقيقي:
//  - لو مجموعة users فاضية بالكامل: تسمح بإنشاء أول حساب بدون توكن
//    (هذي هي لحظة "الإعداد الأول" نفسها، ما فيه توكن أصلًا بعد).
//  - لو فيها مستخدمين أصلًا: لازم جلسة Admin صالحة لإضافة حساب جديد.
//
// كل حساب "عالق" محليًا وما قدر يسجل دخول من الأساس، ينحل بمجرد ما
// يستخدم صاحبه نفس اسم المستخدم/كلمة المرور هنا مرة وحدة (لأن Firestore
// عنده لسا فاضية أصلًا — هذا بالضبط سبب المشكلة).

const { requireAdmin, usersCollectionEmpty, createUser } = require('./lib/admin-auth');

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { ok: false, message: 'Method Not Allowed' });

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { ok: false, message: 'بيانات غير صالحة' });
  }

  const { username, password } = payload;
  if (!username || !password) {
    return json(400, { ok: false, message: 'اسم المستخدم وكلمة المرور مطلوبان' });
  }

  try {
    const empty = await usersCollectionEmpty();
    if (!empty) {
      // فيه حسابات أصلًا — لازم جلسة أدمن صالحة عشان تضيفين حساب جديد
      try {
        await requireAdmin(event);
      } catch {
        return json(403, { ok: false, message: 'فيه حسابات أدمن مسجّلة أصلًا — لازم تسجّلي دخول بحساب صالح أول' });
      }
    }
    await createUser(username, password, 'super_admin');
    return json(200, { ok: true });
  } catch (err) {
    const map = {
      USERNAME_INVALID: 'اسم المستخدم قصير جدًا',
      PASSWORD_TOO_SHORT: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل',
      USERNAME_TAKEN: 'اسم المستخدم مستخدم أصلًا بـ Firestore — سجّلي دخول عادي',
    };
    return json(500, { ok: false, message: map[err.message] || err.message || 'تعذر إنشاء الحساب' });
  }
};
