# جمرة غضى — Jamrat Ghadah Dashboard

نظام إدارة المناسبات المتكامل — دعوات AI تفاعلية، تسجيل حضور QR، إرسال
رسائل واتساب/إيميل، تقارير، ومزامنة موقع عام. مبني على Next.js 16 + React 19
+ Prisma 6 + PostgreSQL.

> **الإصدار الحالي: v10.8** — مراجعة أمنية وأدائية شاملة. كل النتائج في
> CHANGELOG.md مُتحقَّق منها فعلياً. للترقية من نسخة سابقة، انظر قسم
> "الترقية" بالأسفل.

---

## جدول المحتويات

1. [المتطلبات](#المتطلبات--requirements)
2. [التثبيت السريع](#التثبيت-السريع--quick-start)
3. [متغيرات البيئة](#متغيرات-البيئة--environment-variables)
4. [إعداد قاعدة البيانات](#إعداد-قاعدة-البيانات--database-setup)
5. [التشغيل](#التشغيل--running-the-app)
6. [النشر بالإنتاج](#النشر-بالإنتاج--production-deployment)
7. [Cron Jobs](#cron-jobs)
8. [إعداد WhatsApp Business](#إعداد-whatsapp-business)
9. [إعداد Resend (الإيميل)](#إعداد-resend-الإيميل)
10. [RBAC — الأدوار والصلاحيات](#rbac--الأدوار-والصلاحيات)
11. [RSVP — تأكيد الحضور](#rsvp--تأكيد-الحضور)
12. [مرجع API](#مرجع-api)
13. [الاختبار والتحقق](#الاختبار-والتحقق)
14. [الأمان](#الأمان--security-notes)
15. [الروتين اليومي](#الروتين-اليومي--daily-operations)
16. [استكشاف الأخطاء](#استكشاف-الأخطاء--troubleshooting)
17. [الترقية من نسخة سابقة](#الترقية-من-نسخة-سابقة)
18. [بنية المشروع](#بنية-المشروع--project-structure)

---

## المتطلبات | Requirements

| Requirement | Version | Notes |
|---|---|---|
| Node.js | **≥ 20.9** (tested on 24) | تحقق: `node --version` |
| npm | **≥ 10** (or bun ≥ 1.3 for prod server) | يأتي مع Node |
| PostgreSQL | **≥ 14** (tested on 17) | مطلوب لـ JSONB + generated columns |
| Caddy | **≥ 2.7** (optional, for prod) | reverse proxy + TLS تلقائي |

No native dependencies required beyond what `npm ci` installs (Prisma's
engines ship prebuilt).

---

## التثبيت السريع | Quick Start

```bash
# 1. فك ضغط النسخة (أو git clone)
unzip jamratghadah_v10_8_fixed.zip -d jamratghadah
cd jamratghadah

# 2. تثبيت الـ dependencies
npm ci            # reproducible install من package-lock.json

# 3. إعداد متغيرات البيئة
cp .env.example .env
# عدّل .env — على الأقل: DATABASE_URL, JWT_SECRET, CRON_SECRET
# استخدم: openssl rand -hex 32  لتوليد JWT_SECRET و CRON_SECRET

# 4. إعداد قاعدة البيانات
npx prisma generate
npx prisma migrate deploy    # يطبّق 5 migrations بالترتيب

# 5. إنشاء حساب مدير
npm run admin:create -- "Admin Name" admin@example.com "StrongPassword12+"

# 6. تشغيل التطبيق
npm run dev      # http://localhost:3000
```

---

## متغيرات البيئة | Environment Variables

### مطلوبة (التطبيق يرفض الإقلاع بدونها)

| Variable | Notes |
|---|---|
| `DATABASE_URL` | `postgresql://user:password@host:5432/dbname?schema=public` |
| `JWT_SECRET` | ≥ 32 chars. التطبيق **يرفض الإقلاع** مع placeholder معروف. ولّده: `openssl rand -hex 32` |
| `CRON_SECRET` | ≥ 32 chars. يُستخدم في `/api/scheduler/run` و `/api/reports/daily` و `/api/maintenance/cleanup`. ولّده: `openssl rand -hex 32` |

### اختيارية لكن مُوصى بها

| Variable | Default | Notes |
|---|---|---|
| `INTEGRATION_ENC_KEY` | (empty) | 64 hex chars لتشفير أسرار التكاملات at-rest. ولّده: `openssl rand -hex 32`. لو فارغ، تُخزَّن كنص صريح (غير مُوصى به للإنتاج) |
| `SITE_URL` | (empty) | `https://your-domain.com` — يُستخدم لبناء روابط `/rsvp` في الإيميل |
| `DAILY_REPORT_EMAIL` | (empty) | بريد استقبال التقارير اليومية (الإرسال الفعلي غير مُفعّل في هذه النسخة، لكن العنوان يظهر في الرد) |

### WhatsApp Business API

> **ملاحظة:** الـ dashboard يسمح بحفظ هذه القيم في DB (تبويب "التكاملات")
> بدل `.env`. متغيرات الـ env تُستخدم كـ fallback فقط.

| Variable | Required | Notes |
|---|---|---|
| `WHATSAPP_APP_SECRET` | **نعم دايماً** | App Secret من Meta Business Manager. الويب هوك **يرفض كل الأحداث** بدونه (503) — fail-closed بكل بيئة، مو بس الإنتاج |
| `WHATSAPP_PHONE_ID` | للإرسال | Phone Number ID من Meta |
| `WHATSAPP_TOKEN` | للإرسال | Access Token (System User Token مُوصى به) |
| `WHATSAPP_VERIFY_TOKEN` | للويب هوك | أي قيمة تختارها — تُطابق في Meta Webhook config |
| `WHATSAPP_TEMPLATE_NAME` | `rsvp_confirmation` | اسم القالب المُعتمد في Meta |
| `WHATSAPP_TEMPLATE_LANG` | `ar` | لغة القالب |

> **Legacy aliases:** `WHATSAPP_PHONE_NUMBER_ID` و `WHATSAPP_ACCESS_TOKEN`
> ما زالت مقبولة للتوافق مع الإعدادات القديمة، لكن مُفضّل الأسماء الجديدة.

### Resend (البريد الإلكتروني)

| Variable | Required | Notes |
|---|---|---|
| `RESEND_API_KEY` | للإرسال | `re_xxx` من Resend dashboard |
| `RESEND_FROM_EMAIL` / `SEND_FROM` | للإرسال | `onboarding@resend.dev` للتجربة، أو نطاقك المُحقَّق |

### متغيرات UI فقط (placeholder — لا outbound calls)

`CLOUDINARY_*`, `FIREBASE_*`, `OPENAI_API_KEY`, `GEMINI_API_KEY` — مقاعد
في الـ UI فقط. الإرسال الفعلي يتم عبر DB-persisted integration configs.

---

## إعداد قاعدة البيانات | Database Setup

### إنشاء قاعدة البيانات والمستخدم

```bash
# كـ superuser في psql
CREATE DATABASE jamratghadah;
CREATE USER jamrat_user WITH PASSWORD 'your-strong-password';
GRANT ALL PRIVILEGES ON DATABASE jamratghadah TO jamrat_user;
ALTER DATABASE jamratghadah OWNER TO jamrat_user;
```

### تطبيق الـ migrations

```bash
npx prisma migrate deploy
```

يطبّق 5 migrations بالترتيب:

1. `20250101000000_init` — ينشئ كل الجداول الأساسية (users, events, guests,
   checkins, send_logs, templates, comments, operation_logs, trash_items,
   sessions, password_reset_tokens, scheduled_messages, login_attempts,
   event_assignments, qr_usages, guest_edit_logs)
2. `20260101000000_security_hardening` — يضيف QR tokens + audit fields +
   operatorId FK على checkins + role على event_assignments + indexes
3. `20260812000000_media_assets` — ينشئ `media_assets` table
4. `20260813000000_integration_configs` — ينشئ `integration_configs` table
5. `20260814000000_performance_indexes` — يضيف 5 compound indexes للأداء
   (v10.8)

> **آمن لإعادة التشغيل:** كل `CREATE INDEX` تستخدم `IF NOT EXISTS`. لن
> تفشل لو الـ index موجود بالفعل.

### توليد Prisma Client

```bash
npx prisma generate
```

> **مهم بعد كل تعديل على `schema.prisma`:** شغّل `prisma generate` ثم
> `npx tsc --noEmit` للتأكد من عدم وجود type errors.

### إنشاء حساب مدير

```bash
npm run admin:create -- "Admin Name" admin@example.com "StrongPassword12+"
```

- كلمة المرور يجب أن تكون ≥ 12 حرف.
- الأمر **upsert** — لو المستخدم موجود، يُحدَّث اسمه وكلمة مروره ويُزاد
  `tokenVersion` (يُبطل كل جلساته السابقة).
- لو ما فيه أي مستخدم بالـ DB، أول login من الـ UI ينشئ مدير تلقائياً
  (development only — `NODE_ENV !== 'production'`).

---

## التشغيل | Running the App

### Development

```bash
npm run dev
# http://localhost:3000
# السجلات تُكتب لـ dev.log عبر tee
```

### Production build

```bash
npm run build
# يبني .next/standalone/ + ينسخ .next/static و public/ داخله
npm run start
# يستخدم bun لتشغيل standalone server (أسرع من node)
# غيّر المنفذ بـ PORT=3100 npm run start
```

### التحقق قبل النشر

```bash
# شغّل هذه بالترتيب قبل كل release
npm ci
npx prisma generate
npx prisma migrate deploy
npx tsc --noEmit      # 0 errors متوقع
npm run lint          # 0 errors، ~277 warnings (no-explicit-any — مقبولة)
npm test              # 276 assertion متوقع (9 ملفات اختبار)
npm run build         # ✓ Compiled successfully متوقع
```

---

## النشر بالإنتاج | Production Deployment

### باستخدام Caddy (مُوصى به)

ملف `Caddyfile` مُضمّن. يصغي على المنفذ 81 ويُوجّه لـ `localhost:3000`.

**لماذا Caddy؟**
- TLS تلقائي عبر Let's Encrypt
- HTTP/2 افتراضياً
- reverse proxy بسيط بدون SSRF (تمت إزالة handler خطير في v10.1)

**الإعداد:**

1. ثبّت Caddy: `apt install caddy` (Ubuntu) أو [download](https://caddyserver.com/docs/install)
2. عدّل `Caddyfile` — غيّر `:81` لنطاقك:
   ```
   jamratghadah.com {
       reverse_proxy localhost:3000 {
           header_up Host {host}
           header_up X-Forwarded-For {remote_host}
           header_up X-Forwarded-Proto {scheme}
           header_up X-Real-IP {remote_host}
       }
       encode zstd gzip
   }
   ```
3. شغّل: `caddy run --config Caddyfile`
4. Caddy سيحصل على شهادة TLS تلقائياً ويُجددها.

**تأكد من:**
- المنفذ 80 و 443 مفتوحان في الـ firewall
- DNS يشير للخادم
- `SITE_URL=.env` يطابق النطاق (يُستخدم لروابط `/rsvp`)

### باستخدام systemd

أنشئ `/etc/systemd/system/jamratghadah.service`:

```ini
[Unit]
Description=Jamrat Ghadah Dashboard
After=network.target postgresql.service

[Service]
Type=simple
User=jamrat
WorkingDirectory=/opt/jamratghadah
EnvironmentFile=/opt/jamratghadah/.env
ExecStart=/usr/bin/bun /opt/jamratghadah/.next/standalone/server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable jamratghadah
sudo systemctl start jamratghadah
```

### تحديث الإنتاج

```bash
cd /opt/jamratghadah
# backup قبل التحديث
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# رفع الملفات الجديدة (unzip أو git pull)
npm ci --production=false
npx prisma generate
npx prisma migrate deploy
npm run build
sudo systemctl restart jamratghadah
```

---

## Cron Jobs

ثلاثة cron jobs يجب إعدادها خارجياً (الـ app لا يُشغل cron داخلياً):

### 1. Scheduler — كل دقيقة

ينفّذ الرسائل المجدولة (`scheduled_messages` table).

```bash
* * * * * curl -s -X POST https://your-domain/api/scheduler/run \
  -H "X-Cron-Secret: $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}' > /dev/null 2>&1
```

### 2. Daily Report — يومياً (اختياري)

يُنشئ تقرير يومية (placeholder — الإرسال الفعلي للبريد غير مُفعّل).

```bash
0 9 * * * curl -s -X POST https://your-domain/api/reports/daily \
  -H "Authorization: Bearer <admin-jwt-token>" \
  > /dev/null 2>&1
```

> **ملاحظة:** الـ GET endpoint يتطلب `X-Cron-Secret` (cron-only)، لكن
> الـ POST endpoint (الذي تستدعيه ReportsPage) يتطلب Bearer JWT (admin/staff).
> اختر المناسب للاستخدام.

### 3. Login Attempts Cleanup — يومياً

ينظّف جدول `login_attempts` من السجلات الأقدم من 24 ساعة.

```bash
0 3 * * * curl -s -X POST https://your-domain/api/maintenance/cleanup \
  -H "X-Cron-Secret: $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}' > /dev/null 2>&1
```

### إعداد cron jobs

**على نفس خادم التطبيق:**
```bash
crontab -e
# أضف الأسطر الثلاثة فوق
```

**على خادم منفصل (مُوصى به للإنتاج):**
استخدم خدمة cron خارجية مثل [cron-job.org](https://cron-job.org) أو
[EasyCron](https://www.easycron.com) — تضمن التنفيذ حتى لو خادم التطبيق
كان مشغولاً.

---

## إعداد WhatsApp Business

### الخطوة 1: إنشاء تطبيق في Meta

1. اذهب لـ [Meta Business Manager](https://business.facebook.com)
2. إنشاء Business Account (لو ما عندك)
3. اذهب لـ **Business Settings → Accounts → WhatsApp**
4. أنشئ WhatsApp Business Account + رقم هاتف
5. أضف **System User** وامنحه `whatsapp_business_messaging` permission
6. ولّد **Access Token** (System User Token — أطول عمراً من User Token)

### الخطوة 2: اعتماد قالب الرسالة

1. اذهب لـ **WhatsApp Manager → Message Templates**
2. أنشئ قالب باللغة `ar` باسم `rsvp_confirmation` (أو أي اسم — عدّل
   `WHATSAPP_TEMPLATE_NAME`)
3. القالب يجب أن يحتوي:
   - **Header (اختياري):** video
   - **Body:** متغيران `{{1}}` (اسم الضيف) و `{{2}}` (اسم المناسبة)
   - **Buttons:** زرّان Quick Reply بهذا الترتيب:
     - index 0 → "سأحضر" (payload سيكون `RSVP_YES:<guestId>`)
     - index 1 → "أعتذر" (payload سيكون `RSVP_NO:<guestId>`)
4. انتظر اعتماد Meta (قد يأخذ ساعات)

> **تحذير:** لو ترتيب الأزرار معكوس، الـ RSVP سيُسجّل بشكل خاطئ. تأكد
> من الترتيب في WhatsApp Manager قبل النشر.

### الخطوة 3: إعداد الويب هوك

1. اذهب لـ **WhatsApp Manager → Configuration → Webhook**
2. **Callback URL:** `https://your-domain/api/webhooks/whatsapp`
3. **Verify Token:** نفس قيمة `WHATSAPP_VERIFY_TOKEN` في `.env`
4. اشترك في `messages` field
5. **App Secret:** انسخه من **Business Settings → Accounts → WhatsApp →
   رقمك → App Secret** — ضعه في `WHATSAPP_APP_SECRET` في `.env`

> **مهم:** `WHATSAPP_APP_SECRET` مطلوب دايماً (fail-closed). لو فارغ،
> الويب هوك يرفض كل الأحداث بـ 503. لا تستثنيه بـ `NODE_ENV` — هذا قرار
> مقصود لتجنب الأخطاء على منصات لا تضبط `NODE_ENV` تلقائياً.

### الخطوة 4: حفظ الإعدادات في الـ dashboard

بدل كتابة الـ env vars في `.env`، احفظها من الـ dashboard:

1. سجّل دخول كمدير
2. اذهب لـ **الإعدادات → التكاملات**
3. في قسم **WhatsApp Business API**، املأ:
   - Phone Number ID
   - Access Token
   - Verify Token (Webhook)
   - اسم القالب المعتمد
   - لغة القالب (`ar`)
4. اضغط **حفظ**

الإعدادات تُخزَّن في `integration_configs` table. القيم الحساسة (Access
Token) تُشفَّر at-rest لو `INTEGRATION_ENC_KEY` مضبوط.

### الخطوة 5: اختبار

```bash
# اختبار الإرسال (من dashboard → مركز الإرسال)
# اختر ضيفاً له رقم واتساب صحيح واضغط "إرسال"

# تحقق من السجل
# dashboard → سجل الإرسال — يجب أن ترى status=sent
```

---

## إعداد Resend (الإيميل)

### الخطوة 1: إنشاء حساب Resend

1. اذهب لـ [resend.com](https://resend.com) وسجّل
2. احصل على API Key (`re_xxx`)
3. (للإنتاج) حقّق نطاقك في **Domains → Add Domain**

### الخطوة 2: حفظ الإعدادات

من الـ dashboard → **الإعدادات → التكاملات** → قسم **Resend**:
- API Key
- From Email (`onboarding@resend.dev` للتجربة، أو `noreply@your-domain.com` للإنتاج)

### الخطوة 3: اختبار

```bash
# من dashboard → مركز الإرسال
# اختر قناة "إيميل" أو "كلاهما" واضغط إرسال لضيف له بريد إلكتروني
```

---

## RBAC — الأدوار والصلاحيات

أربعة أدوار مع صلاحيات متدرجة:

| Role | Label | الصلاحيات |
|------|-------|-----------|
| `admin` | مدير | وصول كامل لكل الأقسام + إدارة المستخدمين + الإعدادات + التكاملات + النسخ الاحتياطي |
| `staff` | موظف إدارة | إضافة/تعديل/حذف الضيوف + رفع القوائم + الإرسال + التقارير + إدارة المناسبات |
| `checkin` | موظف حضور | تسجيل الحضور فقط — صفحة Check-in (لا يرى بيانات الضيوف الكاملة) |
| `sender` | موظف إرسال | مركز الإرسال + القوالب + سجل الإرسال + الإحصائيات (قراءة فقط للمناسبات) |

### Event Isolation

- **admin** يرى كل المناسبات.
- **غير admin** يرى فقط المناسبات التي أنشأها **أو** عُيّن لها عبر
  `event_assignments` table.
- كل عمليات الـ API تفحص `canAccessEvent(user, eventId)` قبل أي تعديل.

### تعيين مستخدم لمناسبة

```bash
# من الـ dashboard:
# المناسبات → اختر مناسبة → "إدارة التعيينات"
# اختر المستخدم + الدور (staff/checkin/sender) → "تعيين"
```

أو عبر API:
```bash
curl -X POST https://your-domain/api/events/EVENT_ID/assign \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID","role":"staff"}'
```

---

## RSVP — تأكيد الحضور

نظام تأكيد الحضور مبني على قناتين تصبّان في نفس مكان التخزين
(`Guest.confirmed` + `Guest.companions`):

### القناة 1: صفحة الويب `/rsvp`

تُفتح برابط من أحد الشكلين:
- `/rsvp?token=<qrToken الخاص بالضيف>` — رابط شخصي، لا يحتاج كلمة سر
  (يُستخدم في الإيميل أو كرابط احتياطي في واتساب)
- `/rsvp?eventId=<id>&guestId=<id>&password=<كلمة سر المناسبة>` — بديل
  عند عدم توليد QR للضيف بعد

الصفحة تعرض اسم المدعوة وتفاصيل المناسبة، وزرّين "سأحضر ✅ / أعتذر" +
عدّاد عدد المرافقين، وترسل النتيجة إلى `POST /api/public/rsvp`.

### القناة 2: أزرار واتساب (Meta Cloud API)

- الويب هوك: `GET/POST /api/webhooks/whatsapp`
- عرّفيه في Meta Business Manager → WhatsApp → Configuration → Webhook
- عند إرسال رسالة الدعوة (Template معتمد)، زرّان Quick Reply بـ payload:
  - `RSVP_YES:<guestId>` → سأحضر
  - `RSVP_NO:<guestId>` → أعتذر
- عند الضغط على "سأحضر"، يرسل البوت تلقائياً أزرار عدد مرافقين
  (`RSVP_COMP:<guestId>:0/1/2`) ويحدّث العدد عند الرد

كلتا القناتين تحدّثان نفس الحقول وتُنشئان سجل تدقيق (`GuestEditLog` +
`OperationLog` + `QrUsage`)، وتُعاد حسبة `Event.confirmed` تلقائياً.

---

## مرجع API

كل المسارات تحت `/api/`. المصادقة عبر `Authorization: Bearer <jwt>.<opaqueSessionToken>`.

### المسارات العامة (لا مصادقة)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/auth/login` | login — يرجع bearer مزدوج |
| POST | `/api/auth/request-reset` | طلب استعادة كلمة المرور (rate-limited) |
| POST | `/api/auth/reset-password` | استعادة كلمة المرور بـ token |
| GET/POST | `/api/public` | صفحة الحدث العامة (rate-limited) |
| POST | `/api/public/rsvp` | تأكيد حضور الضيف (rate-limited) |
| POST | `/api/qr-verify` | تحقق QR للـ scanner (rate-limited) |
| GET/POST | `/api/webhooks/whatsapp` | ويب هوك Meta (HMAC-verified) |
| POST | `/api/scheduler/run` | cron — X-Cron-Secret |
| GET/POST | `/api/reports/daily` | cron GET / admin POST |
| POST | `/api/maintenance/cleanup` | cron — X-Cron-Secret |

### المسارات المحمية

كل ما عدا ذلك يتطلب Bearer token. الـ method-aware RBAC في `src/lib/rbac.ts`
يفحص كل طلب. انظر `ROLE_API_ROUTES` و `DENIED_RULES` للتفاصيل.

**كل مسار POST/PATCH/DELETE له Zod validation** على الـ body (v10.7 —
انظر CHANGELOG لجدول كامل).

---

## الاختبار والتحقق

### TypeScript check

```bash
npx tsc --noEmit
# متوقع: 0 errors
```

### Lint

```bash
npm run lint
# متوقع: 0 errors، ~277 warnings (كلها no-explicit-any — مقبولة)
```

### Unit tests (pure-logic، no DB)

```bash
npm test
# متوقع: 276 assertion نجحت عبر 9 ملفات اختبار
```

ملفات الاختبار:
- `tests/validation.test.ts` — Zod schema validation (11 assertion)
- `tests/security.test.ts` — env, RBAC, QR hardening (14 assertion)
- `tests/checkin.test.ts` — QR token minting and validation (7 assertion)
- `tests/rbac.test.ts` — RBAC method-aware checks (87 assertion)
- `tests/webhook-signature.test.ts` — Meta HMAC verification (10 assertion)
- `tests/v10.4-fixes.test.ts` — v10.4 security fixes (41 assertion)
- `tests/v10.6-fixes.test.ts` — v10.6 security fixes (52 assertion)
- `tests/v10.7-fixes.test.ts` — v10.7 Zod validation (23 assertion)
- `tests/v10.8-fixes.test.ts` — v10.8 performance fixes (31 assertion)

---

## الأمان | Security Notes

- **JWT**: HS256, 7-day expiry, DB session validation, `tokenVersion`
  invalidation on password change / disable / role change.
- **Dual-token bearer**: `<jwt>.<opaqueSessionToken>` — JWT وحده غير كافٍ.
  الـ opaque token يُخزَّن sha256 في `sessions.tokenHash`.
- **Password hashing**: bcrypt cost factor 12.
- **Rate limiting**: 
  - Login: 10 failed attempts / 15 min / IP+email → 429
  - Public RSVP: 30 / 15 min / IP
  - QR verify: 120 / 15 min / IP
  - Request reset: 5 / hour / IP
- **RBAC**: 4 roles enforced at middleware AND per-route (method-aware).
- **Event isolation**: non-admin يرى فقط مناسباته.
- **Audit log**: `operation_logs` append-only (no PATCH/DELETE).
- **QR tokens**: opaque random base64 (≥32 chars), rotated, revocable.
- **Check-in dedup**: DB unique index on `checkins.guestId` + transaction.
- **Backup security**: لا يُصدَّر `password`/`qrToken`/`tokenHash`. الـ
  restore يستخدم allowlists صريحة (v10.6) لمنع mass-assignment.
- **Constant-time password comparison**: `crypto.timingSafeEqual` في
  `/api/public` و `/api/public/rsvp` (v10.6).
- **Cron secret**: `crypto.timingSafeEqual` (no timing attack).
- **WhatsApp webhook**: fail-closed دايماً — `WHATSAPP_APP_SECRET` مطلوب
  بكل بيئة.
- **Integration encryption**: AES-256-GCM لقيم التكاملات الحساسة at-rest
  (لو `INTEGRATION_ENC_KEY` مضبوط).

---

## الروتين اليومي | Daily Operations

### إعادة تعيين كلمة مرور مستخدم

```bash
npm run admin:create -- "User Name" user@example.com "NewStrongPassword12+"
# upsert — لو المستخدم موجود، يُحدَّث وتُبطل كل جلساته
```

### تشغيل الـ scheduler يدوياً

```bash
curl -X POST https://your-domain/api/scheduler/run \
  -H "X-Cron-Secret: $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### إنشاء نسخة احتياطية

```bash
# من الـ dashboard (admin فقط):
# الإعدادات → النسخ الاحتياطي → "إنشاء نسخة"

# أو عبر API:
curl -X POST https://your-domain/api/backup \
  -H "Authorization: Bearer <admin-jwt>" \
  -o backup-$(date +%Y%m%d).json
```

> **النسخة الاحتياطية لا تحتوي على:** كلمات المرور، QR tokens، session
> token hashes، password-reset token hashes. الـ restore يحافظ على كلمة
> مرور المدير الحالي؛ باقي المستخدمين يحتاجون إعادة تعيين.

### استعادة نسخة احتياطية

> **تحذير:** الاستعادة **تحذف كل البيانات الحالية** ثم تُعيد البيانات
> من الملف. استخدم فقط في بيئة اختبار أو بعد كارثة.

```bash
# رفع الملف عبر API:
curl -X POST https://your-domain/api/backup/upload/restore \
  -H "Authorization: Bearer <admin-jwt>" \
  -H "Content-Type: application/json" \
  -d '{"data": <backup-json-content>, "confirm": true}'
```

الـ restore تستخدم 12 allowlist صريحة (v10.6) لمنع mass-assignment من
ملفات مُخترقة.

---

## استكشاف الأخطاء | Troubleshooting

### `prisma migrate deploy` يفشل بـ "relation does not exist"

تطبّق migrations قديمة. تأكد إن عندك كل الـ 5 migrations في
`prisma/migrations/`. أول migration (`20250101000000_init`) ينشئ كل
الجداول الأساسية.

### التطبيق يرفض الإقلاع بـ "JWT_SECRET is set to a known placeholder"

ولّد سراً حقيقياً: `openssl rand -hex 32`. التطبيق يرفض الـ placeholders
المذكورة في `src/lib/env.ts`.

### Login يرجع 429

تجاوزت 10 محاولات فاشلة في 15 دقيقة. انتظر، أو نظّف الجدول:
```sql
TRUNCATE login_attempts;
```

### Build يفشل بعد تعديل schema

```bash
npx prisma generate    # ولّد الـ client من جديد
npx tsc --noEmit       # ابحث عن type errors
```

### الويب هوك واتساب يرفض كل الأحداث (503)

`WHATSAPP_APP_SECRET` غير مضبوط في `.env`. هذا مقصود — fail-closed.
حطّ القيمة من Meta Business Manager.

### الويب هوك يرجع 200 لكن لا يُعالج الأحداث

توقيع HMAC خاطئ. تحقق:
1. `WHATSAPP_APP_SECRET` يطابق App Secret في Meta
2. الويب هوك يستقبل الـ raw body بدون تعديل (الكود يقرأ `request.text()`)
3. راقب `console.warn` في السجلات — يطبع رسالة عند توقيع خاطئ

### QR scanner لا يتعرف على الكود

- تأكد إن الـ QR token (وليس الـ guest ID) هو ما يُمسح
- الـ token يجب أن يكون ≥ 32 chars (URL-safe base64)
- ضيف مؤرشف (`archivedAt` غير null) يُرجع `valid: false`

### الإرسال يرجع `failed` بـ "واتساب غير مفعّل"

احفظ الإعدادات من الـ dashboard → التكاملات → WhatsApp:
- Phone Number ID
- Access Token

أو ضعها في `.env` كـ fallback.

---

## الترقية من نسخة سابقة

### من v10.5 أو أقدم

1. **backup قاعدة البيانات أولاً:**
   ```bash
   pg_dump $DATABASE_URL > backup-before-v10.6.sql
   ```

2. **فك ضغط النسخة الجديدة فوق القديمة** (أو في مجلد منفصل ثم انسخ
   `src/`, `prisma/`, `tests/`, `package.json`, `package-lock.json`).

3. **ثبّت الـ dependencies الجديدة:**
   ```bash
   npm ci
   ```

4. **طبّق الـ migration الجديد:**
   ```bash
   npx prisma migrate deploy
   # سيطبّق: 20260814000000_performance_indexes (5 compound indexes)
   ```

5. **ولّد Prisma Client:**
   ```bash
   npx prisma generate
   ```

6. **تحقق:**
   ```bash
   npx tsc --noEmit
   npm test
   npm run build
   ```

7. **أعد التشغيل:**
   ```bash
   sudo systemctl restart jamratghadah
   ```

### من v10.6/v10.7/v10.8

نفس الخطوات لكن بدون migration جديد (الـ schema ما تغيّر منذ v10.8).
فقط حدّث الكود وأعد البناء.

---

## بنية المشروع | Project Structure

```
jamratghadah/
├── prisma/
│   ├── schema.prisma                  # Prisma schema (18 models)
│   └── migrations/                    # 5 ordered migrations
├── src/
│   ├── app/
│   │   ├── api/                       # Next.js API routes (50+ endpoints)
│   │   │   ├── auth/                  # login, logout, me, sessions,
│   │   │   │                          # change-password, reset-password
│   │   │   ├── users/                 # admin-only user CRUD
│   │   │   ├── events/                # CRUD + assign + archive +
│   │   │   │                          # restore + close
│   │   │   ├── guests/                # CRUD + qr + revoke-qr +
│   │   │   │                          # edit-logs + import + export +
│   │   │   │                          # bulk-delete
│   │   │   ├── checkin/               # one checkin per guest
│   │   │   │                          # (DB unique index)
│   │   │   ├── templates/             # CRUD
│   │   │   ├── comments/              # create + list (append-only)
│   │   │   ├── media/                 # CRUD
│   │   │   ├── trash/                 # list + restore + empty
│   │   │   ├── backup/                # JSON export + restore
│   │   │   │                          # (passwords redacted)
│   │   │   ├── integrations/          # DB-persisted config + test
│   │   │   ├── site-sync/             # real DB counts + audit-logged
│   │   │   ├── stats/                 # real derived stats + rates
│   │   │   ├── reports/               # reports + daily cron endpoint
│   │   │   ├── scheduler/             # cron-triggered scheduled msgs
│   │   │   ├── send/                  # message send (placeholder)
│   │   │   ├── schedules/             # scheduled message CRUD
│   │   │   └── ...                    # qr-verify, public, robot,
│   │   │                              # invitations, operations-log,
│   │   │                              # maintenance, webhooks
│   │   ├── layout.tsx
│   │   └── page.tsx                   # SPA entry — client-side
│   │                                  # routing via Zustand store
│   ├── components/
│   │   ├── jamra/                     # App-specific pages (24 pages)
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── pages/
│   │   └── ui/                        # shadcn/ui primitives
│   ├── lib/
│   │   ├── auth.ts                    # JWT + bcrypt + session validation
│   │   ├── rbac.ts                    # role-based access control
│   │   ├── access.ts                  # IDOR + event-isolation helpers
│   │   ├── event-access.ts            # event-scope where-clauses
│   │   ├── validation.ts              # Zod schemas (all API boundaries)
│   │   ├── qr-token.ts                # opaque QR token minting
│   │   ├── session.ts                 # session resolution from request
│   │   ├── audit.ts                   # append-only audit log
│   │   ├── login-rate-limit.ts        # 10 attempts / 15 min / IP+email
│   │   ├── rate-limit.ts              # in-memory rate limiter
│   │   ├── env.ts                     # env validation at boot
│   │   ├── cron.ts                    # timingSafeEqual cron-secret check
│   │   ├── crypto.ts                  # AES-256-GCM helpers
│   │   ├── db.ts                      # Prisma Client singleton
│   │   ├── api-client.ts              # typed fetch wrapper for frontend
│   │   ├── store.ts                   # Zustand store
│   │   ├── whatsapp.ts                # WhatsApp Cloud API client
│   │   ├── email.ts                   # Resend email client
│   │   ├── firebase.ts                # Firebase (placeholder)
│   │   ├── integration-config.ts      # encrypted DB config store
│   │   ├── token-hash.ts              # opaque token hashing (sha256)
│   │   └── hooks.ts                   # shared request helpers
│   ├── hooks/                         # React hooks
│   └── middleware.ts                  # Next.js middleware (RBAC + JWT)
├── scripts/
│   └── create-admin.ts                # admin creation CLI
├── tests/                             # 9 test suites (276 assertions)
├── public/                            # static assets
├── .env.example                       # env template
├── .gitignore
├── Caddyfile                          # production reverse-proxy config
├── next.config.ts                     # output: "standalone"
├── package.json
├── tsconfig.json
├── eslint.config.mjs
├── tailwind.config.ts
├── postcss.config.mjs
├── components.json                    # shadcn/ui config
└── CHANGELOG.md                       # سجل التغييرات (v10.1 → v10.8)
```

---

## الترخيص | License

Proprietary. All rights reserved.

---

## الإصدار | Version

**v10.8** — hardened + performance-audited release.

انظر `CHANGELOG.md` لتفاصيل كل إصدار من v10.1 إلى v10.8.
