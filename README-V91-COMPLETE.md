# Jamrat V9.1 Complete Test Build

هذه الحزمة تجمع واجهة V9.3 Real Hybrid/Dual Bot الأكثر اكتمالاً المتاحة في المشروع مع Functions الإدارة وFirestore وCloudinary وWhatsApp وEmail والأرشفة.

## مركز التشغيل
بعد تسجيل الدخول سيظهر زر **المركز الكامل** أسفل يسار الشاشة. منه:
- رفع فيديو من الجهاز بحد 15MB إلى Cloudinary وحفظه للمناسبة.
- حفظ رابط فيديو موجود في Cloudinary.
- إرسال WhatsApp/Email بنص/فيديو/صورة مع سجل محلي للجلسة.
- إدارة مفاتيح WhatsApp/Resend/Cloudinary عبر server-side integration settings.
- توليد QR من رابط RSVP بألوان أسود/ذهبي وخلفية شفافة وتنزيل PNG.
- ضبط تذكير مرة واحدة قبل المناسبة وشكر مرة واحدة بعد المناسبة.
- أرشفة/استعادة المناسبة.

## متغيرات Netlify الأساسية
- FIREBASE_SERVICE_ACCOUNT_JSON
- ADMIN_SESSION_SECRET (مستقل، عشوائي)
- Firebase client config كما في التطبيق

يمكن وضع مفاتيح WhatsApp/Resend/Cloudinary من داخل مركز التكاملات بدل localStorage.

## ملاحظة WhatsApp
Meta قد تتطلب قالباً معتمداً خارج نافذة الـ24 ساعة. الكود لا يدّعي نجاحاً وهمياً: إذا رفضت Meta الطلب سيظهر الفشل.
