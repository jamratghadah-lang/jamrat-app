const { requireAdmin } = require('./lib/admin-auth');
const { getFirestore } = require('./lib/firestore-admin');
exports.handler = async (event) => {
  if (event.httpMethod !== 'GET') return { statusCode:405, body:'Method Not Allowed' };
  try {
    await requireAdmin(event);
    const checks = {};
    const db = getFirestore();
    const t0 = Date.now();
    await db.collection('users').limit(1).get();
    checks.firestore = { ok:true, ms:Date.now()-t0 };
    checks.env = {
      firebaseServiceAccount: !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
      adminSessionSecret: !!process.env.ADMIN_SESSION_SECRET,
      cloudinary: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
      whatsapp: !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID),
      resend: !!process.env.RESEND_API_KEY
    };
    checks.security = { ok: !!process.env.ADMIN_SESSION_SECRET, message: process.env.ADMIN_SESSION_SECRET ? 'مفتاح جلسات مستقل مضبوط' : 'اضبطي ADMIN_SESSION_SECRET ولا تستخدمي Service Account كسر جلسة' };
    return {statusCode:200,body:JSON.stringify({ok:true,checks,checkedAt:new Date().toISOString()})};
  } catch(err) { return {statusCode:err.message?.startsWith('AUTH_')?401:500,body:JSON.stringify({ok:false,message:err.message||'تعذر فحص النظام'})}; }
};
