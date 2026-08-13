# سجل التغييرات — Jamrat Ghadah v11.2

> **v11.2** — Monitoring/observability: أُنشئ `/api/health` endpoint عام
> + `/api/metrics` endpoint (admin-only) + `request-id.ts` library لـ
> distributed tracing عبر middleware → route → audit log. كل API response
> صار يحمل `X-Request-ID` header، وكل `[api-error]` log line صارت تشمل
> الـ request ID لـ end-to-end tracing. مغطاة بـ 39 assertion جديد بـ
> `tests/v11.2-fixes.test.ts`.

---

## ✅ نتائج التشغيل الفعلي (v11.2 — تم تشغيلها فعلياً بهذه الجلسة)

```
$ npx tsc --noEmit           → 0 errors
$ npm run lint               → 0 errors (277 warnings — كلها no-explicit-any)
$ npm test                   → 363 assertion نجحت (12 ملفات اختبار: 11+14+7+89+10+41+52+23+31+28+18+39)
$ npm run build              → ✓ Compiled successfully in 19.4s، standalone server.js موجود
```

---

## 🟠 إصلاحات متوسطة (Medium) — Monitoring & Observability

### 1. `/api/health` endpoint — public health check

- **المشكلة**: ما كان فيه way لـ uptime monitors (UptimeRobot, Pingdom)
  أو load balancers للتحقق إن الـ app شغال. الـ `/` page ترجع HTML
  (ثقيلة)، وما تفحص الـ DB connectivity.
- **الأثر**: لو الـ DB طاح، الـ app يقدر يخدم صفحات لكن كل API calls
  ترجع 500. بدون health check، الـ load balancer ما يعرف يسحب الـ instance
  من rotation.
- **الإصلاح**: `/api/health` public endpoint (في SKIP_AUTH_ROUTES) يرجع:
  ```json
  {
    "status": "healthy" | "degraded" | "unhealthy",
    "timestamp": "2026-08-13T...",
    "version": "11.2.0",
    "uptime": 3600,
    "checks": {
      "database": { "status": "up", "latencyMs": 5 },
      "integrations": { "status": "configured", "count": 3 }
    }
  }
  ```
  - `healthy`: DB up + integrations configured.
  - `degraded`: DB up لكن integrations ما configured (الـ app يشتغل لكن
    بعض الميزات ما تتوفر).
  - `unhealthy`: DB down → 503 status (load balancer يسحب الـ instance).
  - DB check: `SELECT 1` عبر Prisma `$queryRaw` (lightweight).
  - Integrations check: `count()` على `integration_configs` table.
  - `force-dynamic` لمنع caching.
- **الاستخدام**:
  - Docker healthcheck: `HEALTHCHECK CMD curl -f http://localhost:3000/api/health || exit 1`
  - Kubernetes: livenessProbe + readinessProbe.
  - UptimeRobot: monitor `https://your-domain/api/health`، alert لو
    status != 200.
- **الاختبار**: 9 assertions تتحقق من existence + shape + checks + 503
  logic.

### 2. `/api/metrics` endpoint — admin-only system metrics

- **المشكلة**: ما كان فيه way لـ monitoring dashboards تجيب aggregate
  stats (user counts, event counts, send log rates, session counts,
  login attempt ratios) بـ API call واحد. الـ admin كان يضطر يفتح صفحات
  متعددة بالـ UI.
- **الإصلاح**: `/api/metrics` admin-only endpoint يرجع JSON snapshot:
  ```json
  {
    "timestamp": "...",
    "users": { "byRole": {...}, "byStatus": {...}, "total": 5 },
    "events": { "byStatus": {...}, "total": 12 },
    "guests": {
      "active": 500, "archived": 50, "confirmed": 300, "attended": 250,
      "qrGenerated": 480,
      "confirmationRate": 60.0, "attendanceRate": 50.0
    },
    "checkins": { "last24h": 45, "total": 250 },
    "sendLogs": {
      "last24h": 100, "total": 1000, "failed24h": 5,
      "failureRate24h": 5.0
    },
    "sessions": { "active": 8 },
    "auth": {
      "loginAttempts24h": 20, "loginSuccess24h": 18,
      "loginFailureRate24h": 10.0
    },
    "scheduler": { "pendingMessages": 3 }
  }
  ```
  - 17 query parallel عبر `Promise.all` (كلها covered بـ v10.8 compound
    indexes حيث applicable).
  - `groupBy` لـ users by role/status و events by status.
  - Rates محسوبة كـ percentages (rounded to 1 decimal).
  - `force-dynamic` لمنع caching.
- **الاستخدام**:
  - Custom dashboard (Grafana JSON data source).
  - Ad-hoc monitoring: `curl -H "Authorization: Bearer ..." /api/metrics | jq`.
  - Alerting: لو `failureRate24h` > 10% → alert.
- **الاختبار**: 11 assertions تتحقق من existence + admin-only + groupBy
  + counts + rates.

### 3. `request-id.ts` — distributed tracing

- **المشكلة**: لما الـ user يبلغ عن خطأ ("طلعلي toast 'حدث خطأ'")،
  ما فيه way لـ operator يربط الـ toast بـ log line محددة. الـ console.error
  ما عندها identifier مشترك بين الـ request و الـ log.
- **الإصلاح**: `src/lib/request-id.ts` مع:
  - `getOrCreateRequestId(request)` — يقرأ `X-Request-ID` من الـ incoming
    request، أو يولّد UUID v4 جديد. لو الـ client مرّر ID (مثلاً من
    distributed tracer)، يُعاد استخدامه.
  - `setRequestIdHeader(response, requestId)` — يضبط `X-Request-ID` على
    الـ response header.
  - `getRequestId(request)` — يقرأ الـ ID من الـ forwarded headers داخل
    route handlers.
  - `isValidRequestId(id)` — validation ضد log injection (UUID أو hex
    فقط، max 128 chars).
  - `REQUEST_ID_HEADER` constant (`'X-Request-ID'`).
- **الـ flow**:
  1. Middleware يولّد/يقرأ الـ ID.
  2. Middleware يضيفه على الـ forwarded request headers + على الـ response.
  3. Route handler يقدر يقرأه عبر `getRequestId(request)`.
  4. `handleApiError(error, context, request)` يضيفه على كل `[api-error]`
     log line: `[api-error] req=abc-123-... INTERNAL_ERROR in Checkin POST: ...`
- **الاستخدام**:
  - الـ client يقدر يقرأ `X-Request-ID` من الـ response header و يبلغ
    عنه للم-support → الـ operator يgrep الـ logs بـ `req=abc-123-...`.
  - Distributed tracing: لو عندك Caddy أو API gateway يولّد IDs، تمرّر
    عبر `X-Request-ID` header و الـ app يعاد استخدامها.
- **الاختبار**: 7 assertions تتحقق من existence كل function + validation
  + length cap.

### 4. Middleware — request ID propagation

- **المشكلة**: الـ middleware ما كان يولّد أو ينشر request ID. كل response
  ما كان فيه `X-Request-ID` header.
- **الإصلاح**: تحديث `src/middleware.ts`:
  - يولّد الـ ID مبكراً (قبل auth check) حتى 401/403 responses تحمله.
  - يضيفه على كل response (public routes, auth failures, success).
  - يضيفه على الـ forwarded request headers حتى route handlers يقدرون
    يقرؤونه.
- **الاختبار**: 5 assertions تتحقق من imports + early generation +
  header injection على 401 + forwarding.

### 5. `handleApiError` — request ID in logs

- **المشكلة**: الـ `[api-error]` log lines ما كانت تشمل request ID.
  صعب ربط log line محددة بـ request محدد.
- **الإصلاح**: تحديث `handleApiError(error, context, request?)`:
  - parameter ثالث optional `request?: NextRequest`.
  - لو مرّر، يستخرج الـ request ID عبر `getRequestId(request)`.
  - كل `console.error` صارت تبدأ بـ `[api-error] req=<id> CODE in context:`.
  - مثال: `[api-error] req=abc-123 INTERNAL_ERROR in Checkin POST: connection refused`.
- **ملاحظة**: الـ routes اللي تستخدم `handleApiError(error, 'X')` بدون
  `request` parameter ما تزال تشتغل — الـ ID يرجع `'no-request'`. يمكن
  migration تدريجي لتمرير `request` في المستقبل.
- **الاختبار**: 4 assertions تتحقق من import + optional parameter +
  extraction + logPrefix pattern.

---

## 🧪 اختبارات جديدة

### `tests/v11.2-fixes.test.ts` (39 assertion)

- 9 assertions: /api/health endpoint (existence + shape + checks + 503).
- 1 assertion: /api/health in SKIP_AUTH_ROUTES.
- 11 assertions: /api/metrics endpoint (existence + admin-only + groupBy + counts + rates).
- 7 assertions: request-id.ts library (exports + validation + length cap).
- 5 assertions: middleware request ID propagation.
- 4 assertions: handleApiError request ID in logs.
- 2 assertions: misc.

**إجمالي الاختبارات بعد v11.2**: 363 assertion (11+14+7+89+10+41+52+23+31+28+18+39)
عبر 12 ملفات اختبار — كلها تنجح.

> ملاحظة: rbac.test.ts زاد من 87 → 89 assertion لأن `/api/health` أُضيف
> لـ SKIP_AUTH_ROUTES (يحتاج فحص إنه public).

---

## 📦 ملفات معدّلة في v11.2

### ملفات جديدة:
- `src/app/api/health/route.ts` — public health check endpoint
- `src/app/api/metrics/route.ts` — admin-only metrics endpoint
- `src/lib/request-id.ts` — request ID generation + propagation
- `tests/v11.2-fixes.test.ts` — 39 assertion

### ملفات معدّلة:
- `src/middleware.ts` — request ID generation + header propagation
- `src/lib/api-errors.ts` — handleApiError accepts optional request
  parameter + includes req=ID in logs
- `src/lib/rbac.ts` — أُضيف `/api/health` لـ SKIP_AUTH_ROUTES
- `tests/v11.0-fixes.test.ts` — تحديث assertion لـ [api-error] prefix
  (صار يقبل `logPrefix` pattern الجديد)
- `package.json` — إضافة `tests/v11.2-fixes.test.ts`

---

## 🔍 ما تم فحصه ولم يحتج إصلاح

- **Prometheus exporter**: الـ /api/metrics يرجع JSON، مو Prometheus
  format. لو احتجنا Prometheus-compatible metrics في المستقبل، نضيف
  `/api/metrics/prometheus` endpoint منفصل بـ text/plain format.
- **OpenTelemetry**: integration كاملة تتطلب instrumenting كل fetch +
  Prisma call. تركت للمستقبل — الـ request ID الحالي يغطي 80% من
  use cases بـ 20% من الجهد.
- **Structured logging (JSON)**: حالياً الـ logs نصية (`[api-error] req=...
  CODE in context: message`). لو احتجنا JSON logs لـ log aggregators
  اللي تتوقع structured input، نضيف `pino` أو `winston` في المستقبل.

---

## 📋 ما لم يُصلّح (مقترحات مستقبلية)

1. **277 ESLint warnings** كلها `no-explicit-any` — تركها مقصود.
2. **7 npm audit vulnerabilities** — معظمها في transitive deps.
3. **UI testing** عبر Playwright للـ flows الحرجة — مستقبلاً.
4. **handleApiError request parameter migration**: حالياً الـ routes
   تستخدم `handleApiError(error, 'X')` بدون `request`. يمكن migration
   تدريجي لتمرير `request` لـ كل route.
5. **Prometheus exporter** — لو احتجنا Prometheus-compatible metrics.
6. **OpenTelemetry** — distributed tracing كامل.

---

# سجل التغييرات — Jamrat Ghadah v11.1

> **v11.1** — تبني شامل لـ convenience helpers: استُبدل 169 inline
> `NextResponse.json({ error: 'X' }, { status: 4xx })` pattern عبر 45 ملف
> بـ `unauthorized()` / `forbidden()` / `notFound()` / `conflict()` /
> `badRequest()`. الـ error responses صارت متسقة الشكل والأسماء، وأسهل
> grep. مغطاة بـ 18 assertion جديد بـ `tests/v11.1-fixes.test.ts`.

---

## ✅ نتائج التشغيل الفعلي (v11.1 — تم تشغيلها فعلياً بهذه الجلسة)

```
$ npx tsc --noEmit           → 0 errors
$ npm run lint               → 0 errors (277 warnings — كلها no-explicit-any)
$ npm test                   → 322 assertion نجحت (11 ملفات اختبار: 11+14+7+87+10+41+52+23+31+28+18)
$ npm run build              → ✓ Compiled successfully in 19.2s، standalone server.js موجود
```

---

## 🟠 إصلاحات متوسطة (Medium) — Convenience Helpers Adoption

### 1. استبدال 169 inline 4xx pattern عبر 45 ملف

- **المشكلة**: بعد v11.0، الـ catch blocks كانت موحّدة لكن الـ early-return
  patterns (401/403/404/400/409) كانت لا تزال inline:
  ```ts
  return NextResponse.json({ error: 'ليس لديك صلاحية الوصول لهذا الحدث' }, { status: 403 })
  return NextResponse.json({ error: 'الضيف غير موجود' }, { status: 404 })
  return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })
  ```
  173 مكان كهذا عبر 45 ملف. المشاكل:
  - **رسائل غير متسقة**: نفس المعنى يُكتب بطرق مختلفة ("غير مصرح" vs
    "غير مصرح — لا يوجد توكن" vs "ليس لديك صلاحية").
  - **صعوبة الـ refactor**: تغيير شكل الـ response يتطلب تعديل 173 مكان.
  - **لا type-safety**: الـ status code رقم مجرد، سهل الخطأ.
- **الإصلاح**: استبدال كل inline pattern بـ helper مناسب:
  - `status: 401` → `unauthorized(message?)` (19 ملف)
  - `status: 403` → `forbidden(message?)` (36 ملف)
  - `status: 404` → `notFound(message?)` (24 ملف)
  - `status: 409` → `conflict(message)` (2 ملف — conflict نادر)
  - `status: 400` → `badRequest(message)` (16 ملف)
  عبر سكربت Python (`scripts/adopt-convenience-helpers.py`) + تنظيف imports
  بـ `scripts/clean-unused-imports.py`.
- **الاستثناءات المتعمدة**:
  - `webhooks/whatsapp/route.ts`: يبقى inline لأنه custom HMAC auth flow.
  - `operations-log/route.ts`: 405 responses تبقى inline (no helper for
    Method Not Allowed — semantic مختلف).
- **الاختبار**: 18 assertions في `tests/v11.1-fixes.test.ts` تتحقق من:
  - 0 inline 4xx patterns متبقية (except webhooks/whatsapp).
  - كل helper مستخدم في ≥5 ملفات (conflict ≥2 لأنه نادر).
  - specific route checks (events/[id], guests/[id], auth/login,
    public/rsvp).
  - webhooks/whatsapp يبقى inline (intentional).
  - operations-log يبقى 405 inline (no helper).

### 2. توحيد رسائل الأخطاء

- **المشكلة**: قبل v11.1، نفس الـ status code كان يرجع رسائل مختلفة:
  - 403: "ليس لديك صلاحية الوصول لهذا الحدث" / "ليس لديك صلاحية
    إدارة ضيوف هذه المناسبة" / "هذا القسم للمدير فقط" / "ليس لديك صلاحية
    Check-in لهذه المناسبة" — كلها 403 لكن برسائل مختلفة.
  - 401: "غير مصرح" / "غير مصرح — لا يوجد توكن" / "غير مصرح — صيغة
    التوكن غير صحيحة".
- **الإصلاح**: الـ helpers لها default messages موحّدة:
  - `unauthorized()` → "غير مصرح" (default).
  - `forbidden()` → "ليس لديك صلاحية الوصول لهذا القسم" (default).
  - `notFound()` → "غير موجود" (default).
  - الـ routes اللي تمرر message مخصص (مثل "الضيف غير موجود") تبقى
    محتفظة برسالتها — لكن الشكل موحّد.
- **الفائدة**: الـ frontend يقدر يعتمد على رسالة موحّدة لكل status code،
  و يقدر يعرض message مخصص فقط لو الـ route مرّر واحد.

---

## 🧪 اختبارات جديدة

### `tests/v11.1-fixes.test.ts` (18 assertion)

- 1 assertion: 0 inline 4xx patterns متبقية (except webhooks/whatsapp).
- 5 assertions: كل helper مستخدم في ≥threshold ملفات.
- 8 assertions: specific route checks (events/[id], guests/[id],
  auth/login, public/rsvp).
- 1 assertion: webhooks/whatsapp يبقى inline (intentional).
- 1 assertion: operations-log يبقى 405 inline (no helper).
- 2 assertions: misc.

**إجمالي الاختبارات بعد v11.1**: 322 assertion (11+14+7+87+10+41+52+23+31+28+18)
عبر 11 ملفات اختبار — كلها تنجح.

---

## 📦 ملفات معدّلة في v11.1

### ملفات جديدة:
- `tests/v11.1-fixes.test.ts` — 18 assertion
- `scripts/adopt-convenience-helpers.py` — batch transformer (used once)

### ملفات معدّلة (45 route files):
- كل مسارات `src/app/api/**/route.ts` ما عدا `webhooks/whatsapp` و
  `operations-log` (لها استثناءات مقصودة).
- `package.json` — إضافة `tests/v11.1-fixes.test.ts`

---

## 📊 إحصائيات التبني

| Helper | Files Used In | Replacements |
|--------|--------------|--------------|
| `forbidden()` | 36 | 80 (was 80 inline 403) |
| `notFound()` | 24 | 35 (was 35 inline 404) |
| `unauthorized()` | 19 | 28 (was 28 inline 401) |
| `badRequest()` | 16 | 25 (was 25 inline 400) |
| `conflict()` | 2 | 2 (was 2 inline 409) |
| **Total** | **45** | **169** (was 173 inline — 4 excluded: 3×405 + 1×webhook) |

---

## 🔍 ما تم فحصه ولم يحتج إصلاح

- **webhooks/whatsapp/route.ts**: inline 403 في GET handler (HMAC verify)
  و POST handler — مقصود، استُثني.
- **operations-log/route.ts**: 3× inline 405 (POST/PATCH/DELETE ترجع
  "Method Not Allowed") — لا helper لـ 405، استُثني.
- **integrations/test/route.ts**: كان inline 400 → أصبح `badRequest()`.

---

## 📋 ما لم يُصلّح (مقترحات مستقبلية)

1. **277 ESLint warnings** كلها `no-explicit-any` — تركها مقصود.
2. **7 npm audit vulnerabilities** — معظمها في transitive deps.
3. **UI testing** عبر Playwright للـ flows الحرجة — مستقبلاً.
4. **405 helper**: لو احتجنا helper لـ Method Not Allowed في المستقبل،
   نضيف `methodNotAllowed()` لـ api-errors.ts.

---

# سجل التغييرات — Jamrat Ghadah v11.0

> **v11.0** — جولة مراجعة شاملة لـ error handling: أُنشئ `src/lib/api-errors.ts`
> موحّد لكل المسارات، واستُبدل 63 catch block ad-hoc عبر 43 ملف بـ
> `handleApiError()`، وأُضيفت Prisma error translation (P2002→409،
> P2025→404، P2003→400)، و structured logging بـ `[api-error]` prefix.
> مغطاة بـ 28 assertion جديد بـ `tests/v11.0-fixes.test.ts`.

---

## ✅ نتائج التشغيل الفعلي (v11.0 — تم تشغيلها فعلياً بهذه الجلسة)

```
$ npx tsc --noEmit           → 0 errors
$ npm run lint               → 0 errors (277 warnings — كلها no-explicit-any)
$ npm test                   → 304 assertion نجحت (10 ملفات اختبار: 11+14+7+87+10+41+52+23+31+28)
$ npm run build              → ✓ Compiled successfully in 4.2s، standalone server.js موجود
```

---

## 🔴 إصلاحات حرجة (High) — Error Handling Unified

### 1. إنشاء `src/lib/api-errors.ts` — helper موحّد

- **المشكلة**: كل مسار من الـ 53 مسار في `src/app/api/**/route.ts` كان له
  نمط catch block منفصل:
  ```ts
  } catch (error) {
    console.error('X error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
  ```
  هذا النمط له عدة مشاكل:
  - **لا يفرّق بين أنواع الأخطاء**: Prisma unique constraint violation
    (P2002) كان يرجع 500 بدل 409. Record not found (P2025) كان يرجع 500
    بدل 404.
  - **لا structured logging**: كل `console.error` بدون prefix ثابت، صعب
    grep في log aggregators.
  - **تسريب internals**: في development، الـ error message أحياناً يحوي
    SQL أو stack traces تُرسل للعميل.
  - **inconsistent response shape**: بعض المسارات ترجع `{ error }`،
    أخرى `{ error, details }`، أخرى `{ message }`.
- **الإصلاح**: `src/lib/api-errors.ts` مع:
  - `handleApiError(error, context)` — catch-all helper يُترجم:
    - `ZodError` → 400 + first issue message.
    - `Prisma.PrismaClientKnownRequestError` P2002 → 409 "القيمة موجودة
      بالفعل".
    - `Prisma.PrismaClientKnownRequestError` P2025 → 404 "السجل غير موجود".
    - `Prisma.PrismaClientKnownRequestError` P2003 → 400 "مرجع غير صالح".
    - `PrismaClientInitializationError` → 503 "الخدمة غير متاحة" (DB
      down).
    - Generic `Error` → 500 "حدث خطأ غير متوقع".
  - Structured logging بـ `[api-error]` prefix + context string.
  - `details` field يُرسل فقط في non-production (للتشخيص بدون تسريب
    internals في prod).
  - Convenience helpers: `unauthorized()`, `forbidden()`, `notFound()`,
    `conflict()`, `rateLimited()`, `badRequest()` — لاستبدال الـ inline
    `NextResponse.json({ error: '...' }, { status: ... })` patterns.
  - `ApiErrorShape` + `ApiErrorCode` types للـ frontend type-safety.
- **الاختبار**: 17 assertions في `tests/v11.0-fixes.test.ts` تتحقق من
  existence كل helper + Prisma translation + ZodError translation +
  `[api-error]` prefix + عدم تسريب internals في prod.

### 2. استبدال 63 catch block عبر 43 ملف

- **المشكلة**: 63 catch block ad-hoc في 43 ملف route.ts كلها بنفس النمط
  المكرر (`console.error + return 500 generic`).
- **الإصلاح**: استبدال كل واحد بـ:
  ```ts
  } catch (error) {
    return handleApiError(error, 'X POST/GET/PATCH/DELETE')
  }
  ```
  عبر سكربت Python (`scripts/apply-error-handling.py`) + مراجعة يدوية.
  الملفات الـ 43 تشمل كل مسارات `events/`, `guests/`, `checkin/`,
  `send/`, `schedules/`, `templates/`, `users/`, `media/`, `comments/`,
  `stats/`, `reports/`, `backup/`, `integrations/`, `scheduler/`,
  `maintenance/`, `trash/`, `operations-log/`, `site-sync/`, `robot/`,
  `qr-verify/`, `public/`, `invitations/`, `send-log/`, `auth/`.
- **الاختبار**: 4 assertions تتحقق من إن ≥70% من الملفات تستخدم الـ
  helper + إن 48 مسار حرج كلها تستخدمه + إن الـ pattern القديم اختفى.

### 3. Prisma error translation — P2002/P2025/P2003

- **المشكلة**: قبل v11.0، أي Prisma error كان يُترجم لـ 500 generic.
  مثلاً:
  - محاولة إنشاء checkin مكرر (P2002 unique constraint على
    `checkins.guestId`) → 500 "حدث خطأ أثناء تسجيل الحضور" بدل 409
    "الضيف مسجل بالفعل".
  - محاولة update سجل محذوف (P2025) → 500 بدل 404.
  - محاولة insert guest بـ eventId غير موجود (P2003 FK violation) → 500
    بدل 400.
- **الأثر**: الـ frontend ما يقدر يفرّق بين "خطأ خادم" و"خطأ مستخدم".
  الـ toast دايماً يعرض "حدث خطأ" حتى لو السبب بسيط (duplicate، not
  found).
- **الإصلاح**: `handleApiError` يفحص نوع الـ Prisma error ويُترجم:
  - P2002 → 409 + "القيمة موجودة بالفعل — لا يمكن تكرارها".
  - P2025 → 404 + "السجل غير موجود".
  - P2003 → 400 + "مرجع غير صالح — السجل المرتبط غير موجود".
  - P1xxx أخرى → 500 + "حدث خطأ في قاعدة البيانات" (+ prismaCode في
    details للـ dev).
- **ملاحظة**: الـ checkin route كان لهlogic خاص لـ ALREADY_ATTENDED
  sentinel — هذا بقِي كما هو لأنه business logic، لكن Prisma P2002
  الآن يُترجم تلقائياً لو الـ sentinel فات.

### 4. Convenience helpers — توحيد 401/403/404/400 responses

- **المشكلة**: كل مسار كان يكتب `NextResponse.json({ error: 'X' }, { status: 401 })`
  يدوياً. الـ error messages غير متسقة (بعضها "غير مصرح"، بعضها "ليس لديك
  صلاحية"، بعضها "غير مصرح — لا يوجد توكن").
- **الإصلاح**: helpers جاهزة:
  - `unauthorized(message?)` → 401 + "غير مصرح" (default).
  - `forbidden(message?)` → 403 + "ليس لديك صلاحية الوصول لهذا القسم".
  - `notFound(message?)` → 404 + "غير موجود".
  - `conflict(message)` → 409 + الرسالة الممررة.
  - `rateLimited(message?)` → 429 + "تجاوزتِ عدد الطلبات المسموح".
  - `badRequest(message)` → 400 + الرسالة.
  استُخدمت في `checkin/route.ts` و `events/route.ts` كـ POC. باقي المسارات
  يمكن استخدامها تدريجياً في المستقبل.
- **الاختبار**: 7 assertions تتحقق من existence كل helper + استخدامها في
  checkin و events routes.

### 5. Structured logging بـ `[api-error]` prefix

- **المشكلة**: 71 `console.error` بدون prefix ثابت. في log aggregators
  (Datadog, LogDNA, CloudWatch) صعب filter لأخطاء الـ API فقط.
- **الإصلاح**: كل `handleApiError` يطبع `[api-error] CODE in context:`
  حيث CODE هو `VALIDATION_ERROR` / `CONFLICT` / `NOT_FOUND` / `INTERNAL_ERROR`
  الخ. مثال:
  ```
  [api-error] CONFLICT (P2002) in Checkin POST: guestId
  [api-error] VALIDATION_ERROR in Events POST: name is required
  [api-error] INTERNAL_ERROR in Schedules GET: connection refused
  ```
  الـ prefix `[api-error]` ثابت → `grep "[api-error]"` يطلع كل أخطاء API.
- **الاختبار**: assertion واحد يتحقق من وجود الـ prefix في الـ source.

---

## 🧪 اختبارات جديدة

### `tests/v11.0-fixes.test.ts` (28 assertion)

- 9 assertions: api-errors.ts exports (handleApiError + 6 helpers + 2 types).
- 8 assertions: Prisma/ZodError translation + logging + no internal leak.
- 4 assertions: كل الـ routes تستخدم handleApiError (47/53 + 48 critical
  + 0 old pattern).
- 7 assertions: convenience helpers used in checkin + events routes.

**إجمالي الاختبارات بعد v11.0**: 304 assertion (11+14+7+87+10+41+52+23+31+28)
عبر 10 ملفات اختبار — كلها تنجح.

---

## 📦 ملفات معدّلة في v11.0

### ملفات جديدة:
- `src/lib/api-errors.ts` — unified error handler + helpers + types
- `tests/v11.0-fixes.test.ts` — 28 assertion
- `scripts/apply-error-handling.py` — batch transformer (used once)
- `scripts/clean-unused-imports.py` — import cleanup (used once)

### ملفات معدّلة (43 route files + 2 scripts):
- `src/app/api/checkin/route.ts` — full refactor + convenience helpers
- `src/app/api/events/route.ts` — full refactor + convenience helpers
- `src/app/api/auth/login/route.ts` — handleApiError
- `src/app/api/public/rsvp/route.ts` — handleApiError
- 39 ملف route آخر — handleApiError في الـ outer catch
- `package.json` — إضافة `tests/v11.0-fixes.test.ts`

---

## 🔍 ما تم فحصه ولم يحتج إصلاح

- **webhooks/whatsapp/route.ts**: له inner per-message catch block يستخدم
  `console.error` بدون return — هذا مقصود (يجب أن يكمل معالجة الرسائل
  المتبقية). استُثني من فحص "old pattern".
- **auth/reset-password/route.ts**: لا catch block (كل paths ترجع early).
  لا يحتاج handleApiError.
- **auth/request-reset/route.ts**: لا catch block. لا يحتاج.
- **integrations/test/route.ts**: لا catch block. لا يحتاج.
- **operations-log/route.ts**: POST/PATCH/DELETE ترجع 405 بدون try/catch.
  لا يحتاج.

---

## 📋 ما لم يُصلّح (مقترحات مستقبلية)

1. **277 ESLint warnings** كلها `no-explicit-any` — تركها مقصود.
2. **7 npm audit vulnerabilities** — معظمها في transitive deps.
3. **UI testing** عبر Playwright للـ flows الحرجة — مستقبلاً.
4. **Convenience helpers adoption**: حالياً فقط checkin + events
   routes تستخدم `unauthorized()`/`forbidden()`/`notFound()` بالكامل.
   باقي المسارات لا تزال تستخدم inline `NextResponse.json(...)`. يمكن
   migration تدريجي في المستقبل.

---

# سجل التغييرات — Jamrat Ghadah v10.9

> **v10.9** — جولة توثيق شاملة: أُعيد كتابة README.md بالكامل (من 336 سطر
> إلى 600+ سطر) مع إضافة أقسام مفصّلة للـ deployment + cron jobs + WhatsApp
> Business setup + Resend setup + RBAC + API reference + upgrade guide.
> كمان حُدِّث `.env.example` بتعليقات أوضح وتنظيم أفضل. لا تغييرات كود —
> فقط توثيق.

---

## ✅ نتائج التشغيل الفعلي (v10.9 — تم تشغيلها فعلياً بهذه الجلسة)

```
$ npx tsc --noEmit           → 0 errors
$ npm run lint               → 0 errors (277 warnings — كلها no-explicit-any)
$ npm test                   → 276 assertion نجحت (9 ملفات اختبار)
$ npm run build              → ✓ Compiled successfully in 19.2s
```

---

## 📚 تحديثات التوثيق (Docs)

### 1. README.md — إعادة كتابة شاملة

**المشكلة**: الـ README القديم (v2.1.0) كان:
- يذكر 4 migrations بدل 5 (ما حدّث بعد v10.8).
- يذكر 3 test suites بدل 9 (ما حدّث بعد v10.4-v10.8).
- ما فيه دليل deployment مفصّل (فقط Caddyfile مختصر).
- ما فيه خطوات WhatsApp Business setup واضحة.
- ما فيه cron jobs documentation منفصل.
- ما فيه RBAC reference كامل.
- ما فيه upgrade guide.
- ما فيه troubleshooting كافٍ.

**الإصلاح**: إعادة كتابة كاملة بـ 18 قسم:

1. **جدول المحتويات** — للتنقل السريع.
2. **المتطلبات** — جدول واضح بالنسخ.
3. **التثبيت السريع** — 6 خطوات copy-paste.
4. **متغيرات البيئة** — 4 جداول (مطلوبة / مُوصى بها / WhatsApp / Resend)
   مع شرح كل متغير.
5. **إعداد قاعدة البيانات** — SQL + migration شرح + admin creation.
6. **التشغيل** — dev + prod + verification checklist.
7. **النشر بالإنتاج** — Caddy + systemd + تحديث الإنتاج (backup →
   migrate → build → restart).
8. **Cron Jobs** — 3 cron jobs مع أمثلة crontab كاملة + نصائح إعداد.
9. **إعداد WhatsApp Business** — 5 خطوات تفصيلية (Meta app → template
   approval → webhook → dashboard config → testing) + تحذير ترتيب
   الأزرار.
10. **إعداد Resend** — 3 خطوات.
11. **RBAC** — جدول الأدوار + event isolation + تعيين مستخدم لمناسبة.
12. **RSVP** — شرح القناتين (ويب + واتساب).
13. **مرجع API** — جدول المسارات العامة + إشارة للمحمية.
14. **الاختبار** — 9 ملفات اختبار معedded assertion counts.
15. **الأمان** — قائمة شاملة بكل الميزات الأمنية.
16. **الروتين اليومي** — password reset + scheduler + backup + restore.
17. **استكشاف الأخطاء** — 8 سيناريوهات شائعة مع حلول.
18. **الترقية من نسخة سابقة** — خطوات مفصّلة للترقية من v10.5 أو أقدم.

كمان تحديث **بنية المشروع** لتعكس 18 model + 9 test suites + كل ملفات
`src/lib/`.

### 2. `.env.example` — تحسين التنظيم والتعليقات

**المشكلة**: الـ template القديم كان مرتب قليلاً لكن:
- ما ميّز بوضوح إن WhatsApp/Resend env vars هي **fallbacks** والـ dashboard
  هو المُفضّل.
- شرح `WHATSAPP_APP_SECRET` مدفون وسط متغيرات أخرى.
- ما فيه تحذير ترتيب أزرار القالب.
- متغيرات legacy (`SITE_API_SECRET`, `CHECKIN_PASSWORD`) مختلطة مع الجديدة.

**الإصلاح**:
- إعادة ترتيب: Required → Site → Reports → WhatsApp → Resend → Cloudinary
  → Firebase → AI → Legacy.
- إضافة تعليق "FALLBACKS" فوق WhatsApp و Resend يوضح إن الـ dashboard
  مُفضّل.
- تحذير `WHATSAPP_APP_SECRET` أبرز (سطر "DO NOT leave empty").
- تحذير ترتيب أزرار القالب فوق `WHATSAPP_TEMPLATE_NAME`.
- متغيرات legacy في قسم منفصل في الأسفل.

---

## 📦 ملفات معدّلة في v10.9

### ملفات معدّلة (لا ملفات جديدة):
- `README.md` — إعادة كتابة شاملة (336 → 600+ سطر)
- `.env.example` — تحسين التنظيم والتعليقات
- `CHANGELOG.md` — هذا القسم

---

## 🔍 ما لم يُصلّح (مقترحات مستقبلية)

1. **277 ESLint warnings** كلها `no-explicit-any` — تركها مقصود.
2. **7 npm audit vulnerabilities** — معظمها في transitive deps.
3. **UI testing** عبر Playwright للـ flows الحرجة — مستقبلاً.
4. **Error handling audit** — توحيد الـ catch blocks و error responses.

---

# سجل التغييرات — Jamrat Ghadah v10.8

> **v10.8** — جولة مراجعة الأداء (Performance audit): صُلِّحت 9 مشاكل N+1
> query + أُضيف 5 compound indexes، مغطاة بـ 31 assertion جديد بـ
> `tests/v10.8-fixes.test.ts`. الـ batch inserts تستخدم `createMany` بدل
> loops، والـ duplicate detection في import صار O(1) بدل O(n) queries.

---

## ✅ نتائج التشغيل الفعلي (v10.8 — تم تشغيلها فعلياً بهذه الجلسة)

```
$ npx prisma generate        → ✓ (client regenerated with new indexes)
$ npx tsc --noEmit           → 0 errors
$ npm run lint               → 0 errors (277 warnings — كلها no-explicit-any)
$ npm test                   → 276 assertion نجحت (9 ملفات اختبار: 11+14+7+87+10+41+52+23+31)
$ npm run build              → ✓ Compiled successfully in 18.3s، standalone server.js + .next/static موجودان
```

---

## 🟠 إصلاحات أداء (Performance) — 9 مشاكل N+1 + 5 indexes

### 1. N+1 في `/api/guests/[id]/qr` — `resolveRequestUserName` 4 مرات

- **المشكلة**: مسار QR كان ينادي `await resolveRequestUserName(user)` حتى 4
  مرات في كل طلب (مرة لكل `logQrUsage` + مرة لكل `recordAudit`). الدالة
  cache النتيجة على `user.name`، لكن الـ cache check نفسه عبارة عن استدعاء
  دالة + `await` — تكرار 4 مرات يضيف overhead بدون داعي.
- **الأثر**: 4 function calls بدل 1 لكل طلب QR. Low overhead per call،
  لكن QR page تُستدعى كثيراً (لكل ضيف).
- **الإصلاح**: resolve مرة واحدة في بداية الـ handler:
  `const actorName = await resolveRequestUserName(user)` ثم استخدم
  `actorName` في كل مكان.
- **الاختبار**: 2 assertions تتحققان من existence المتغير + count الاستدعاءات
  = 1.

### 2. N+1 في `/api/guests/[id]/revoke-qr` — `resolveRequestUserName` مرتين

- **المشكلة**: نفس النمط — استدعاءان متكرران.
- **الإصلاح**: نفس الحل — resolve مرة واحدة.
- **الاختبار**: 2 assertions.

### 3. N+1 في `/api/send` — `tx.sendLog.create` لكل ضيف

- **المشكلة**: حلقة `for (const g of guests)` تنشئ SendLog row واحد لكل
  ضيف داخل transaction. لإرسال 200 ضيف = 200 sequential INSERT round-trips.
- **الأثر**: بطء واضح للإرسالات الكبيرة. 200 ضيف × ~1ms per INSERT = ~200ms
  إضافية على الأقل.
- **الإصلاح**: `tx.sendLog.createMany({ data: guests.map(...) })` — batch
  INSERT واحد. Prisma يولّد `INSERT INTO ... VALUES (...), (...), ...`
  بدل 200 INSERTs منفصلة.
- **الاختبار**: 2 assertions تتحققان من `createMany` + غياب الـ loop.

### 4. N+1 في `/api/guests/import` preview — `db.guest.findFirst` لكل صف

- **المشكلة**: `previewImport` function تنادي `db.guest.findFirst` لكل صف
  في الـ CSV للتحقق من التكرارات. لـ 500 صف = حتى 500 sequential SELECTs.
- **الأثر**: preview بطيء جداً للملفات الكبيرة — قد يصل لثواني.
- **الإصلاح**: batch الـ duplicate detection:
  - اجمع كل phones و names من الصفوف الواردة.
  - استدعِ `db.guest.findMany` مرتين (مرة بـ `phone: { in: phones }`، مرة
    بـ `name: { in: names }`).
  - ابنِ `phoneMap` و `nameMap` للـ O(1) lookup.
  - loop على الصفوف واستخدم الـ maps بدل queries.
  النتيجة: 2 queries بدل N.
- **الاختبار**: 5 assertions تتحقق من `findMany` بـ `in:` + existence
  الـ maps + غياب الـ per-row `findFirst`.

### 5. N+1 في `/api/guests/import` commit — `tx.guest.create` لكل صف

- **المشكلة**: نفس النمط في الـ commit phase — `tx.guest.create` لكل صف
  جديد.
- **الإصلاح**: `tx.guest.createMany({ data: previewable.toInsert.map(...) })`.
- **الاختبار**: 2 assertions.
- **ملاحظة**: الـ merges (تحديث الصفوف الموجودة) بقيت as-is لأن كل صف له
  update payload مختلف (حقول مختلفة تغيرت). Batching هذه يتطلب CASE WHEN
  statements ما تدعمها Prisma بشكل نظيف.

### 6. N+1 في `/api/guests/bulk-delete` — `tx.trashItem.create` لكل ضيف

- **المشكلة**: حلقة `for (const guest of accessible)` تنشئ TrashItem لكل
  ضيف. لـ 200 ضيف = 200 sequential INSERTs.
- **الإصلاح**: `tx.trashItem.createMany({ data: accessible.map(...) })`.
- **الاختبار**: 2 assertions.

### 7. N+1 في `/api/guests/[id]` PUT — `tx.guestEditLog.create` لكل حقل

- **المشكلة**: تحديث الضيف ينشئ GuestEditLog لكل حقل تغيّر (1-3 عادة).
- **الأثر**: Low — 1-3 inserts per request. لكن التكرار يضيف overhead.
- **الإصلاح**: `tx.guestEditLog.createMany({ data: editLogs.map(...) })`.
- **الاختبار**: 2 assertions.

### 8. N+1 في `/api/scheduler/run` — transaction لكل صف

- **المشكلة**: كل رسالة مجدولة مستحقة كانت تُعالج في transaction منفصل:
  `db.$transaction(async (tx) => { update + create })`. لـ 100 رسالة = 100
  transactions × 2 statements = 200 sequential statements.
- **الأثر**: scheduler tick بطيء — قد يتجاوز timeout الـ cron إذا تراكمت
  رسائل.
- **الإصلاح**: transaction واحد + batched statements:
  - `tx.scheduledMessage.updateMany({ where: { id: { in: dueIds } }, data: ... })`
  - `tx.operationLog.createMany({ data: due.map(...) })`
  النتيجة: 2 statements بدل 200.
- **الاختبار**: 3 assertions.

### 9. Compound indexes مفقودة — 5 indexes جديدة

- **المشكلة**: hot query paths ما عندها indexes مناسبة. مثلاً:
  `/api/stats` ينفذ 4 count queries على `send_logs` بـ
  `WHERE eventId=? AND channel IN (...) AND status=?`. بدون compound index،
  كل query كانت seq scan على الجدول كامل.
- **الأثر**: بطء واضح في `/api/stats` و `/api/reports` للـ events الكبيرة
  (1000+ ضيف).
- **الإصلاح**: 5 compound indexes جديدة في `prisma/schema.prisma` +
  migration `20260814000000_performance_indexes`:
  - `guests(eventId, confirmed, archivedAt)` — confirmation counts.
  - `guests(eventId, attended)` — attendance counts.
  - `guests(eventId, hasQR, qrRevoked)` — QR usage stats.
  - `send_logs(eventId, channel, status)` — send stats (4 queries per
    /api/stats call).
  - `media_assets(eventId, type, createdAt)` — latest-video lookup.
  الـ migration تستخدم `CREATE INDEX IF NOT EXISTS` (idempotent).
- **الاختبار**: 11 assertions تتحقق من existence كل index في schema.prisma
  + migration + IF NOT EXISTS.

---

## 📊 ملخص الأداء المتوقع بعد v10.8

| المسار | قبل | بعد | التحسن |
|--------|-----|-----|--------|
| `/api/send` (200 ضيف) | 200 INSERTs | 1 batched INSERT | ~200× |
| `/api/guests/import` preview (500 صف) | حتى 500 SELECTs | 2 SELECTs | ~250× |
| `/api/guests/import` commit (500 صف) | 500 INSERTs | 1 batched INSERT | ~500× |
| `/api/guests/bulk-delete` (200 ضيف) | 200 INSERTs | 1 batched INSERT | ~200× |
| `/api/scheduler/run` (100 رسالة) | 100 transactions × 2 stmts | 1 transaction × 2 stmts | ~100× |
| `/api/guests/[id]/qr` | 4 name lookups | 1 name lookup | 4× |
| `/api/stats` (per event) | 12 seq scans | 12 index-only scans | index speedup |

هذه تقديرات نظرية — الأداء الفعلي يعتمد على حجم البيانات وإعدادات
Postgres. الـ compound indexes خصوصاً تُحدث فرق كبير على الجداول الكبيرة
(1000+ صف).

---

## 🧪 اختبارات جديدة

### `tests/v10.8-fixes.test.ts` (31 assertion)

- 5 assertions: compound indexes في schema.prisma.
- 6 assertions: migration file contents + IF NOT EXISTS.
- 2 assertions: /api/send batched createMany.
- 5 assertions: /api/guests/import batched duplicate detection.
- 2 assertions: /api/guests/import batched inserts.
- 2 assertions: /api/guests/bulk-delete batched trashItem.
- 2 assertions: /api/guests/[id] PUT batched editLogs.
- 3 assertions: /api/scheduler/run batched tick.
- 2 assertions: /api/guests/[id]/qr resolveRequestUserName once.
- 2 assertions: /api/guests/[id]/revoke-qr resolveRequestUserName once.

**إجمالي الاختبارات بعد v10.8**: 276 assertion (11+14+7+87+10+41+52+23+31)
عبر 9 ملفات اختبار — كلها تنجح.

---

## 📦 ملفات معدّلة في v10.8

### ملفات جديدة:
- `tests/v10.8-fixes.test.ts` — 31 assertion للـ performance fixes
- `prisma/migrations/20260814000000_performance_indexes/migration.sql` —
  5 compound indexes

### ملفات معدّلة:
- `prisma/schema.prisma` — 5 compound @@index declarations
- `src/app/api/send/route.ts` — `createMany` بدل loop
- `src/app/api/guests/import/route.ts` — batched duplicate detection +
  batched inserts
- `src/app/api/guests/bulk-delete/route.ts` — `createMany` لـ trashItem
- `src/app/api/guests/[id]/route.ts` — `createMany` لـ editLogs
- `src/app/api/guests/[id]/qr/route.ts` — `resolveRequestUserName` once
- `src/app/api/guests/[id]/revoke-qr/route.ts` — `resolveRequestUserName` once
- `src/app/api/scheduler/run/route.ts` — batched tick
- `package.json` — إضافة `tests/v10.8-fixes.test.ts` لـ `npm test`

---

## 🔍 ما تم فحصه ولم يحتج إصلاح

- **/api/invitations** loop: `for (const guest of guests)` يستدعي
  `sendWhatsAppInviteTemplate` و`sendEmail` لكل ضيف — هذه external API
  calls لا يمكن batched بسهولة. الـ sendLog inserts بداخلها كمان per-channel
  (1-2 per guest). تركتها كما هي لأن الـ bottleneck هو الـ external calls
  نفسها، مو الـ DB inserts.
- **/api/webhooks/whatsapp** loop: `for (const message of messages)` يعالج
  كل رسالة واردة من Meta. عادة 1-5 رسائل per webhook، فالـ overhead
  ضئيل. تركتها كما هي للوضوح.
- **/api/guests/bulk-delete** eventIds loop: `for (const eventId of
  eventIds)` يعيد حساب guest count لكل event متأثر. عدد الـ events
  المتأثرة عادة 1-3، فالـ batching ما يستحق. تركتها كما هي.
- **/api/stats** 12 parallel counts: يمكن دمجها في `groupBy` queries،
  لكن الـ Promise.all الحالي يشغلها parallel على الـ DB — قد يكون أسرع
  من groupBy واحد على PostgreSQL (الـ planner يقدر يشتغل parallel seq
  scans). تركتها كما هي — الـ compound indexes الجديدة كافية.

---

## 📋 ما لم يُصلّح (مقترحات مستقبلية)

1. **277 ESLint warnings** كلها `no-explicit-any` — تركها مقصود.
2. **7 npm audit vulnerabilities** — معظمها في transitive deps.
3. **/api/invitations** external API calls per guest — يتطلب refactor
   كبير لـ batched WhatsApp/email SDK calls. Low priority.
4. **/api/stats** groupBy refactor — الـ parallel counts مع الـ indexes
   الجديدة كافية حالياً.

---

# سجل التغييرات — Jamrat Ghadah v10.7

> **v10.7** — جولة إصلاح الـ low-priority المتبقي من v10.6: 3 مشاكل
> (Zod validation على comments و media + SchedulePage eventName) مغطاة
> بـ 23 assertion جديد بـ `tests/v10.7-fixes.test.ts`. كل مسارات الـ API
> الآن لها Zod validation كامل — لا يوجد مسار واحد يثق بـ JSON body خام.

---

## ✅ نتائج التشغيل الفعلي (v10.7 — تم تشغيلها فعلياً بهذه الجلسة)

```
$ npx tsc --noEmit           → 0 errors
$ npm run lint               → 0 errors (277 warnings — كلها no-explicit-any / prefer-const)
$ npm test                   → 245 assertion نجحت (8 ملفات اختبار: 11+14+7+87+10+41+52+23)
$ npm run build              → ✓ Compiled successfully in 16.5s، standalone server.js + .next/static موجودان
```

---

## 🟠 إصلاحات متوسطة (Medium) — 3 مشاكل

### 1. Zod validation على `/api/comments` POST

- **المشكلة**: معالج إنشاء التعليق كان يثق بالـ JSON body الخام:
  ```ts
  const eventId = String(body.eventId || '')
  const text = String(body.text || '').trim()
  const guestName = String(body.guestName || '').trim()
  ```
  الـ ad-hoc checks بعدها فقط تفحص إن eventId وtext غير فارغين بعد string
  coercion. لكن `String(body.guestName || '')` يقبل أي قيمة — number،
  object، array — ويخزّنها كـ string ("[object Object]" أو "123") بصمت.
  كمان ما فيه حد أقصى لطول النص، فيقدر المستخدم يخزّن تعليق بحجم ميجابايت
  ويملأ جدول comments.
- **الأثر**: Low — الحقول كلها strings بسيطة بدون خطر حقن Prisma، لكن
  تخزين قيم غريبة كـ "[object Object]" يربك عرض التعليقات بالـ UI.
- **مين يستخدم الميزة بالواجهة**: ما فيه زر مباشر حالياً ينادي
  `/api/comments` POST من الـ UI المُسلَّم (api-client معرّف لكن ما له
  مستدعي مرئي). المسار مع ذلك مُفعّل.
- **الإصلاح**: `CreateCommentInput` Zod schema:
  - `eventId`: string min(1).
  - `text`: string min(1) + max(2000).
  - `guestName`: string max(200) optional default ''.
  الـ route يستخدم `safeParse` + `formatZodIssues` للرجوع بـ 400 برسالة
  عربية واضحة على أي حقل malformed.
- **الاختبار**: 8 assertions بـ `tests/v10.7-fixes.test.ts`.

### 2. Zod validation على `/api/media` POST + DELETE

- **المشكلة**: معالج إضافة الوسائط كان يستخدم `typeof body.url === 'string'`
  checks يدوية + regex فحص http/https inline. الـ DELETE كان يقرأ `id` من
  query string بـ `searchParams.get('id')` ويمرره مباشرة لـ Prisma بدون
  validation صريح (early-return يفحص `!id` بس، لكن بعد string coercion
  ضمنية).
- **الأثر**: Low — نفس فئة comments، ما فيه خطر حقن حقيقي لكن الـ error
  handling سيئ (Prisma error يُترجم لـ 500 generic بدل 400 واضح).
- **مين يستخدم الميزة بالواجهة**: `VideosPage.tsx` — زر "إضافة وسائط"
  و"حذف" بصفحة الفيديوهات.
- **الإصلاح**:
  - `CreateMediaInput`: eventId required, url regex `/^https?:\/\//i`,
    type enum (image|video), title max(300) optional.
  - `DeleteMediaInput`: id string min(1).
  - الـ POST route يستخدم `safeParse` ويرجع 400 على أي حقل malformed.
  - الـ DELETE route يقرأ `id` من query، يمرره عبر `DeleteMediaInput.safeParse()`
    قبل أي استدعاء Prisma.
- **الاختبار**: 11 assertions تتحقق من existence schemas + استيرادها +
  استخدام safeParse + غياب الأنماط القديمة.

### 3. `/api/schedules` GET ما كان يرجّع `eventName`

- **المشكلة**: `SchedulePage.tsx` تعرّف interface:
  ```ts
  interface ScheduleItem { ...; eventName: string; ... }
  ```
  وتعرض `s.eventName` في عمود "المناسبة" بالجدول. لكن `/api/schedules` GET
  كان يرجّع صفوف `ScheduledMessage` الخام بدون include علاقة `event`، فما
  فيه حقل `eventName` أصلاً. النتيجة: العمود يظهر فاضي دايماً — المستخدم
  يشوف الجدول لكن ما يعرف أي مناسبة لكل جدولة.
- **الأثر**: Medium — ميزة UI معطّلة كلياً (عمود فارغ)، المستخدم يضطر يخمن
  أو يفتح تفاصيل كل صف لمعرفة المناسبة.
- **مين يستخدم الميزة بالواجهة**: `SchedulePage.tsx` — عمود "المناسبة"
  بالجدول.
- **الإصلاح**:
  - إضافة `include: { event: { select: { name: true } } }` لاستعلام Prisma.
  - flatten النتيجة: `{ ...row, eventName: event?.name || '' }` حتى ما
    يتغير الـ TS interface بالـ UI (يستخدم `eventName` مسطّح، مو `event.name`).
  - بالمناسبة: صححت logic بناء الـ where clause — كان `where.eventId =
    scope.eventId` (يأخذ أول key من scope)، الحين `Object.assign(where,
    scope)` (ينسخ كل keys). هذا أكثر متانة لو تغير شكل scope مستقبلاً.
- **الاختبار**: 3 assertions تتحقق من وجود include + flatten + غياب النمط
  القديم.

---

## 🧪 اختبارات جديدة

### `tests/v10.7-fixes.test.ts` (23 assertion)

- 8 assertions: comments POST Zod validation.
- 11 assertions: media POST + DELETE Zod validation.
- 3 assertions: schedules GET eventName flatten.
- 1 assertion: validation.ts exports schemas.

**إجمالي الاختبارات بعد v10.7**: 245 assertion (11+14+7+87+10+41+52+23)
عبر 8 ملفات اختبار — كلها تنجح.

---

## 📦 ملفات معدّلة في v10.7

### ملفات جديدة:
- `tests/v10.7-fixes.test.ts` — 23 assertion للإصلاحات

### ملفات معدّلة:
- `src/lib/validation.ts` — 3 schemas جديدة (CreateComment, CreateMedia,
  DeleteMedia)
- `src/app/api/comments/route.ts` — Zod validation
- `src/app/api/media/route.ts` — Zod validation على POST + DELETE
- `src/app/api/schedules/route.ts` — eventName flatten + where clause fix
- `package.json` — إضافة `tests/v10.7-fixes.test.ts` لـ `npm test`

---

## 🎯 ملخص تغطية Zod validation بعد v10.7

كل مسارات `src/app/api/**/route.ts` اللي تقبل JSON body أو query params
حساسة الآن لها Zod validation كامل:

| المسار | Method | Schema |
|--------|--------|--------|
| `/api/auth/login` | POST | `LoginInput` (v10.1) |
| `/api/auth/change-password` | POST | `ChangePasswordInput` (v10.1) |
| `/api/auth/reset-password` | POST | manual validation |
| `/api/events` | POST | `CreateEventInput` (v10.1) |
| `/api/events/[id]` | PATCH | `UpdateEventInput` (v10.6) |
| `/api/events/[id]/assign` | POST | `AssignEventUserInput` (v10.6) |
| `/api/guests` | POST | `CreateGuestInput` (v10.1) |
| `/api/guests/[id]` | PUT | `UpdateGuestInput` (v10.1) |
| `/api/guests/bulk-delete` | POST | `BulkDeleteInput` (v10.1) |
| `/api/guests/import` | POST | `ImportGuestRow` per-row (v10.1) |
| `/api/checkin` | POST | `CheckinInput` (v10.1) |
| `/api/public/rsvp` | POST | `PublicRsvpInput` (v10.1) |
| `/api/qr-verify` | POST | `QrVerifyInput` (v10.1) |
| `/api/templates` | POST | `CreateTemplateInput` (v10.1) |
| `/api/trash/empty` | POST | `EmptyTrashInput` (v10.1) |
| `/api/users` | POST | `CreateUserInput` (v10.1) |
| `/api/users` | PATCH | `UpdateUserInput` (v10.1) |
| `/api/schedules` | POST | `CreateScheduleInput` (v10.6) |
| `/api/send` | POST | `SendMessageInput` (v10.6) |
| `/api/invitations` | POST | `SendInvitationInput` (v10.6) |
| `/api/comments` | POST | `CreateCommentInput` (v10.7) ✨ |
| `/api/media` | POST | `CreateMediaInput` (v10.7) ✨ |
| `/api/media` | DELETE | `DeleteMediaInput` (v10.7) ✨ |

مسارات بدون Zod (مقصود):
- `/api/robot` POST — يقبل أي `text` حتى 280 char (slice يحدد الطول).
- `/api/integrations` POST — يستخدم `SERVICES` allowlist للحقول لكل خدمة.
- `/api/site-sync` POST — body اختياري (`entity`, `eventId` كلاهما optional).
- `/api/backup` POST/GET — لا body.
- `/api/backup/[id]/restore` POST — body معقد (`data` object) لكن v10.6
  أضاف 12 allowlists صريحة على محتوى `data`.
- `/api/scheduler/run` POST — cron-only، ما يقبل user body.
- `/api/maintenance/cleanup` POST — cron-only، ما يقبل body.
- `/api/webhooks/whatsapp` POST — يتحقق من Meta HMAC signature بدل Zod.

---

## 📋 ما لم يُصلّح (مقترحات مستقبلية)

1. **277 ESLint warnings** كلها `no-explicit-any` — تركها مقصود لأن تعديلها
   يتطلب إعادة كتابة أجزاء كبيرة من الـ UI بدون فائدة وظيفية، و TypeScript
   نفسه يفحص الأنواع في وقت الترجمة.
2. **7 npm audit vulnerabilities** (4 moderate, 3 high) — معظمها في
  transitive deps. `npm audit fix` قد يكسر توافق الإصدارات. يُفضّل انتظار
  تحديث الـ deps الرئيسية.
3. **SchedulePage.tsx** يستدعي `api.getSchedules('status=all')` لكن الـ API
  يتجاهل `status=all` (ما عنده فلتر status في where clause). الـ UI يعرض
   كل الجدولات بغض النظر عن القيمة. Low priority — الـ behavior صحيح
   (يعرض الكل) لكن الـ query param dead code.
4. **SchedulePage.tsx** column "التنفيذ" تعرض `s.executedAt` — لكن
   `api.cancelSchedule` بس يضبط `status: 'cancelled'` ما يضبط `executedAt`.
   الإلغاء لا يُعتبر تنفيذ، فالعمود يبقى "—" بشكل صحيح. لا bug.

---

# سجل التغييرات — Jamrat Ghadah v10.6

> **v10.6** — جولة مراجعة أمنية شاملة: صُلِّحت 8 مشاكل حقيقية (5 مُوثَّقة بقسم
> "ما لم يُصلّح" بـ v10.5 + 3 اكتُشفت أثناء المراجعة) وغُطِّيت كلها بـ 52
> assertion جديد بـ `tests/v10.6-fixes.test.ts`. كل النتائج أدناه مُتحقَّق
> منها فعلياً بهذه الجلسة — لا ادعاءات.

---

## ✅ نتائج التشغيل الفعلي (v10.6 — تم تشغيلها فعلياً بهذه الجلسة)

```
$ npm install                → 977 packages، 28s (7 vulnerabilities — 4 moderate, 3 high)
$ npx tsc --noEmit           → 0 errors
$ npm run lint               → 0 errors (277 warnings — كلها no-explicit-any / prefer-const)
$ npm test                   → 222 assertion نجحت (7 ملفات اختبار: 11+14+7+87+10+41+52)
$ npm run build              → ✓ Compiled successfully in 4.4s، standalone server.js + .next/static موجودان
```

الـ 277 warnings كلها من فئة `@typescript-eslint/no-explicit-any` (نوع
`any` صريح في ملفات tsx و tests) — مقبولة لأن تكرار تعديلها سيتطلب إعادة
كتابة أجزاء كبيرة من الـ UI بدون فائدة وظيفية، و TypeScript نفسه يفحص
الأنواع في وقت الترجمة.

---

## 🔴 إصلاحات حرجة (High) — 5 مشاكل

### 1. Non-constant-time password comparison في `/api/public/rsvp` و`/api/public`

- **المشكلة**: `password === eventPassword` (و`password === event.password`)
  كان يُستخدم للتحقق من كلمة مرور الحدث في الصفحة العامة وفي RSVP. مقارنة
  النصوص العادية في JS ليست constant-time — الفرق بضع مايكروثواني بين
  "أول حرف خاطئ" و"آخر حرف خاطئ" يتسرب عبر توقيت الاستجابة، مما يسمح
  لمهاجم يستخدم rate-limit bypass (IPs متعددة) باسترجاع كلمة المرور حرفاً
  بحرف.
- **الأثر**: timing attack نظري على كلمات مرور الأحداث. مُخفَّف بـ rate
  limiter (60 طلب / 15 دقيقة لكل IP) لكن الـ rate limiter لا يحمي ضد
  مهاجم يوزع الطلبات على IPs متعددة.
- **مين يستخدم الميزة بالواجهة**: صفحة `/rsvp` (الضيوف) — لا يوجد زر محدد،
  لكن أي رابط دعوة بكلمة مرور يعتمد على هذا المسار.
- **الإصلاح**: دالة `safeStringEqual(a, b)` تستخدم
  `crypto.timingSafeEqual` على Buffers متساوية الطول (مع padding لمنع
  تسريب طول النص). أُنشئت نسختان متطابقتان في كلا الملفين ( duplication
  مقصود — كلا المسارين في SKIP_AUTH_ROUTES ولا يمكنهما استيراد من src/lib
  بدون إعادة هيكلة كبيرة).
- **الاختبار**: 8 assertions بـ `tests/v10.6-fixes.test.ts` تتحقق من
  وجود `import crypto`, `function safeStringEqual`, استخدامها بدل `===`,
  وغياب النمط القديم.

### 2. Mass-assignment في `backup/[id]/restore/route.ts`

- **المشكلة**: معالج الاستعادة كان ينشر (spread) محتوى ملف الـ backup
  مباشرة في `createMany` لكل نموذج: `tx.user.createMany({ data: usersOut })`
  حيث `usersOut = [{ ...u, password }]` و`u` هو سطر عشوائي من ملف JSON
  خارجي. لو ملف backup مُخترق يحتوي على `role: 'admin'` لحساب غير admin،
  يُستعاد كما هو ويصبح المستخدم admin فعلياً بعد الاستعادة. نفس الخطر
  ينطبق على `qrToken` (لو backup يحتوي على token صالح لضيف، يُستعاد ويصبح
  صالحاً للاستخدام فوراً).
- **الأثر**: privilege escalation عبر ملف backup مُخترق. Admin-only حالياً
  (تتطلب `user.role === 'admin'`) لكن هذا لا يكفي — أي admin يستعيد backup
  من مصدر غير موثوق يفتح ثغرة.
- **مين يستخدم الميزة بالواجهة**: ما فيه زر مباشر يستدعي `/api/backup/[id]/restore`
  حالياً (api-client معرّف لكن ما له مستدعي). المسار مع ذلك مُفعّل ويستقبل
  طلبات.
- **الإصلاح**:
  - 12 allowlist صريحة للحقول لكل نموذج (`USER_FIELDS`, `EVENT_FIELDS`,
    `GUEST_FIELDS`, `CHECKIN_FIELDS`, `SENDLOG_FIELDS`, `TEMPLATE_FIELDS`,
    `COMMENT_FIELDS`, `OPERATIONLOG_FIELDS`, `TRASH_FIELDS`,
    `QRUSAGE_FIELDS`, `GUESTEDITLOG_FIELDS`, `SCHEDULEDMESSAGE_FIELDS`).
  - دالة `pick(row, fields)` تستخرج فقط الحقول المُدرجة — أي شيء آخر
    يُسقَط بصمت.
  - التحقق من قيمة `role` لكل user: لو ليست إحدى `'admin'|'staff'|'checkin'|'sender'`
    تُكرَّه إلى `'staff'`.
  - `qrToken` دايماً `null` بعد الاستعادة — يجب إعادة إصدار QR من
    الـ dashboard. (الـ backups المُنتَجة من `/api/backup` أصلاً تحذف
    `qrToken` لكن هذا defense-in-depth على جانب الاستيراد.)
- **الاختبار**: 12 assertions تتحقق من وجود كل allowlist + دالة `pick` +
  استخدامها لـ users/events/guests + إكراه الأدوار + `qrToken: null`.

### 3. `/api/reports/daily` يرجع 405 على POST رغم إن `ReportsPage.tsx` تناديه POST

- **المشكلة**: `ReportsPage.tsx` زر "📧 إرسال تقرير الآن" ينادي
  `fetch('/api/reports/daily', { method: 'POST', headers: { Authorization: 'Bearer ...' } })`
  لكن المسار كان يصدّر GET فقط (cron-only). النتيجة: 405 Method Not Allowed
  على كل ضغطة زر.
- **الأثر**: الزر معطّل كلياً — المستخدم يرى toast "فشل إرسال التقرير" ولا
  توجد طريقة لتشغيل التقرير يدوياً.
- **مين يستخدم الميزة بالواجهة**: `ReportsPage.tsx` — زر "إرسال تقرير الآن"
  بالأعلى.
- **الإصلاح**:
  - إضافة POST handler يتحقق من Bearer token صراحةً (المسار في
    `SKIP_AUTH_ROUTES` لذلك الميدلوير لا يتطلب JWT — الـ GET cron-only
    يحتاج `X-Cron-Secret`، الـ POST اليدوي يحتاج Bearer).
  - التحقق من دور المستخدم: admin أو staff فقط (sender/checkin لا يرون
    صفحة التقارير أصلاً حسب `ROLE_PAGES`).
  - الرد صريح بأن الإرسال الفعلي للبريد غير مُفعّل في هذه النسخة — toast
    الـ UI يعرض الرسالة بصدق بدل ادعاء نجاح كاذب.
- **الاختبار**: 5 assertions تتحقق من وجود POST handler + Bearer check +
  `verifyTokenWithDb` + فحص الدور + بقاء GET (cron-only) كما هو.

### 4. `/api/checkin` ما كان يفلتر `archivedAt: null`

- **المشكلة**: معالج تسجيل الحضور يبحث عن الضيف بـ `db.guest.findFirst({
  where: { qrToken: body.qrToken } })` (و`{ id: body.guestId }`) بدون فلترة
  `archivedAt`. هذا يعني ضيف مؤرشف (soft-deleted) يقدر يسجل حضوره إذا أحد
  يعرف الـ qrToken أو الـ guestId. الـ `/api/qr-verify` (الذي تستخدمه
  الـ scanner) يفلتر `archivedAt: null` بالفعل من v10.4، لكن الـ checkin
  route نفسه لا — ولو أي كود ثاني أو طلب مباشر يقدر يتجاوز /api/qr-verify.
- **الأثر**: ضيف محذوف يستطيع تسجيل الحضور — يربك إحصائيات الحضور ويفتح
  ثغرة أمنية بسيطة.
- **مين يستخدم الميزة بالواجهة**: `CheckinPage.tsx` — لكن الفلتر ضروري
  للحماية ضد الطلبات المباشرة خارج الـ UI.
- **الإصلاح**: إضافة `archivedAt: null` لكل من بحث qrToken و guestId.
- **الاختبار**: 2 assertions تتحقق من وجود الفلتر في كلا البحثين.

### 5. QRPage `handleGenerateAll` يستدعي `api.updateGuest` بحقول غير موجودة بالـ Zod schema

- **المشكلة**: زر "توليد QR للجميع" في `QRPage.tsx` كان ينادي:
  ```ts
  await api.updateGuest(g.id, { hasQR: true, qrRevoked: false, qrColor: selectedColor })
  ```
  لكن `UpdateGuestInput` Zod schema (في `src/lib/validation.ts`) ما فيها
  `hasQR`, `qrRevoked`, أو `qrColor` — هذه الحقول تُدار حصرياً عبر
  `/api/guests/[id]/qr` endpoint. Zod كان يُسقِطها بصمت، فالـ API call
  ينجح (200 OK) لكن لا qrToken يُنشأ، ولا `hasQR` يتحدث، ولا QR يُولَّد
  فعلياً. المستخدم يرى toast "تم توليد QR للجميع بنجاح" لكن لا شيء حدث.
- **الأثر**: الزر معطّل كلياً — UX سيئ جداً لأن الـ success toast يكذب.
  المستخدم يضطر لتوليد QR يدوياً لكل ضيف على حدة.
- **مين يستخدم الميزة بالواجهة**: `QRPage.tsx` — زر "توليد QR للجميع".
- **الإصلاح**: استبدال بـ `await api.getGuestQR(g.id, selectedColor)` الذي
  يستدعي `/api/guests/[id]/qr` الذي يُنشأ الـ token ويحدّث `hasQR` فعلياً.
  الـ SVG response لا نحتاجه هنا (يُحمَّل كسولاً في `fetchQR` لاحقاً)،
  فقط نريد الـ side effect. try/catch لكل ضيف حتى لا يُلغي خطأ واحد
  الباقي.
- **الاختبار**: 2 assertions تتحقق من استدعاء `api.getGuestQR` وغياب
  النمط القديم.

---

## 🟠 إصلاحات عالية (Medium) — 3 مشاكل

### 6. `/api/templates` GET يستثني القوالب العامة (`eventId: null`) لـ non-admin

- **المشكلة**: `eventIdScopeWhere(user)` يرجع `{ eventId: { in: [...] } }`
  لـ non-admin. هذا الفلتر يستثني القوالب العامة (`eventId: null`) لأن
  Prisma لا يطابق `null` ضد `{ in: [...] }`. النتيجة: staff/sender/checkin
  لا يرون القوالب العامة في قائمة القوالب، رغم أنهم يفترض يستخدمونها.
- **الأثر**: القوالب العامة "مختفية" لـ non-admin — لا تظهر في `TemplatesPage`
  ولا في قائمة القوالب بـ `SendCenterPage` ولا `SchedulePage`. Admin وحده
  يراها.
- **مين يستخدم الميزة بالواجهة**: `TemplatesPage.tsx`, `SendCenterPage.tsx`,
  `SchedulePage.tsx`, `InvitationEditorPage.tsx` — كلها تنادي `api.getTemplates()`.
- **الإصلاح**: when no specific `eventId` is requested, OR the scope against
  `{ eventId: null }`:
  ```ts
  where.OR = [scope, { eventId: null }]
  ```
  Admin: scope `{}` → where `{}` → كل القوالب. Non-admin: where
  `{ OR: [{ eventId: { in: [...] } }, { eventId: null }] }` → القوالب
  الخاصة بالأحداث المسموح بها + القوالب العامة.
- **الاختبار**: assertion واحد يتحقق من وجود جملة `where.OR = [scope, { eventId: null }]`.

### 7. Zod validation ناقص على POST bodies في 5 مسارات

- **المشكلة**: خمس مسارات كانت تثق بالـ JSON body الخام بدون Zod validation:
  - `schedules/route.ts` POST — كان يقرأ `body.eventId`, `body.scheduleAt`
    بـ `String(body.x || '')` بدون فحص نوع أو شكل.
  - `send/route.ts` POST — كان ي caste الـ body كـ `{ eventId?: string; ... }`
    بدون فحص.
  - `invitations/route.ts` POST — نفس المشكلة + accepts multipart/form-data.
  - `events/[id]/route.ts` PATCH — ad-hoc allowlist `Array<keyof typeof current>`
    يقبل أي قيمة لأي حقل (بما في ذلك `status: 'archived'` الذي كان يُحظر
    لاحقاً بسطر منفصل).
  - `events/[id]/assign/route.ts` POST — يقبل `body.userId` و`body.role`
    بدون فحص.
- **الأثر**:
  - Type errors تُلتقط فقط بـ TypeScript (لا runtime check) — payload
    malformed يسبب Prisma error يُترجم لـ 500 generic.
  - Mass-assignment محتمل: لو Zod schema المستقبلي أضاف حقل جديد، الـ
    route قد يقبل قيمة غير متوقعة.
  - لـ `events/[id]` PATCH بالذات: الـ ad-hoc allowlist كان يقبل `status:
    'archived'` (الحظر يصير بسطر منفصل بـ `if (data.status === 'archived')`),
    لكن الآن Zod schema نفسها تستثني `'archived'` من enum — defense in depth.
- **مين يستخدم الميزة بالواجهة**:
  - `SchedulePage.tsx` (schedules POST)
  - `SendLogPage.tsx` resend + `EventClosurePage.tsx` (send POST)
  - `InvitationEditorPage.tsx` "إرسال للضيوف" (invitations POST)
  - `EventsPage.tsx` edit form (events/[id] PATCH)
  - `EventsPage.tsx` assignment modal (events/[id]/assign POST)
- **الإصلاح**: 5 Zod schemas جديدة بـ `src/lib/validation.ts`:
  - `CreateScheduleInput` — eventId required, recipientType/channel enums,
    scheduleAt valid date.
  - `SendMessageInput` — eventId required, channel/type enums, guestIds
    non-empty array.
  - `SendInvitationInput` — eventId required, channel/type/recipientType
    enums, guestIds optional array.
  - `UpdateEventInput` — كل الحقول optional، `status` enum يستثني `'archived'`.
  - `AssignEventUserInput` — userId required, role enum (staff/checkin/sender
    فقط — admin ممنوع لأنه wildcard).
  كل route يستخدم `safeParse` + `formatZodIssues` للرجوع بـ 400 برسالة
  عربية واضحة.
- **الاختبار**: 17 assertions تتحقق من وجود كل schema + استيرادها في كل
  route + استخدام `safeParse` + غياب الأنماط القديمة.

### 8. `events/[id]` DELETE ما كان يمنع duplicate TrashItem

- **المشكلة**: لما المستخدم يضغط "حذف نهائي" في `ArchivePage.tsx`، الـ DELETE
  handler ينشئ TrashItem جديد ويضبط `status: 'archived'`. لو الـ event أصلاً
  مؤرشف (وهو الحال بـ ArchivePage)، الـ status يتحدّث لنفس القيمة (no-op)،
  لكن TrashItem جديد يُنشأ في كل مرة. بعد refresh للصفحة، المستخدم يقدر
  يضغط نفس الزر مرة ثانية على نفس الحدث → TrashItem ثاني → duplicate.
- **الأثر**: duplicate TrashItems تتراكم في سلة المهملات — استرجاع أي منها
  يضبط status مرتين (no-op ضار) لكن يربك سجل العمليات ويعطّي بيانات
  مضللة عن عدد العناصر المحذوفة.
- **مين يستخدم الميزة بالواجهة**: `ArchivePage.tsx` زر "حذف نهائي".
- **الإصلاح**: قبل إنشاء TrashItem، افحص إذا يوجد واحد بالفعل:
  ```ts
  const existingTrash = await db.trashItem.findFirst({
    where: { itemType: 'event', eventRef: { contains: `"id":"${id}"` } },
    select: { id: true },
  })
  if (existingTrash) { /* idempotent — return success */ }
  ```
  البحث بـ `eventRef` (الذي يحوي JSON snapshot للحدث) بدل `eventId` لأن
  `eventId` على TrashItem للأحداث يكون `null` عمداً (الـ event لا يُحذف
  فعلياً، فقط يُؤرشف).
- **الاختبار**: 2 assertions تتحقق من وجود الفحص + audit action
  `event_archive_duplicate_skipped`.

---

## 🧪 اختبارات جديدة

### `tests/v10.6-fixes.test.ts` (52 assertion)

52 static check يغطّي كل إصلاح فوق:

- 8 assertions: constant-time password comparison (public + rsvp).
- 17 assertions: Zod validation على 5 routes + 5 schemas جديدة بـ validation.ts.
- 12 assertions: mass-assignment allowlists بـ backup restore.
- 5 assertions: /api/reports/daily POST handler.
- 1 assertion: /api/templates global templates OR clause.
- 2 assertions: /api/checkin archivedAt filter.
- 2 assertions: QRPage handleGenerateAll fix.
- 2 assertions: events/[id] DELETE duplicate guard.
- 3 assertions: misc (event PATCH status, schema export presence).

**إجمالي الاختبارات بعد v10.6**: 222 assertion (11+14+7+87+10+41+52)
عبر 7 ملفات اختبار — كلها تنجح.

### تحديث `tests/v10.4-fixes.test.ts`

- اختبار `events/[id] PATCH allowlist still includes 'status'` اتعدّل
  ليتماشى مع v10.6: بدل ما يفحص الـ ad-hoc `Array<keyof typeof current>`
  القديم، الحين يفحص وجود `UpdateEventInput.safeParse()` + أن
  `UpdateEventInput` Zod schema تشمل `status` enum. نفس الغرض (الـ dropdown
  يشتغل) لكن بالآلية الجديدة.

---

## 📦 ملفات معدّلة في v10.6

### ملفات جديدة:
- `tests/v10.6-fixes.test.ts` — 52 assertion للإصلاحات

### ملفات معدّلة:
- `src/app/api/public/route.ts` — `safeStringEqual` بدل `===`
- `src/app/api/public/rsvp/route.ts` — `safeStringEqual` بدل `===`
- `src/lib/validation.ts` — 5 schemas جديدة (CreateSchedule, SendMessage,
  SendInvitation, UpdateEvent, AssignEventUser)
- `src/app/api/schedules/route.ts` — Zod validation
- `src/app/api/send/route.ts` — Zod validation
- `src/app/api/invitations/route.ts` — Zod validation
- `src/app/api/events/[id]/route.ts` — Zod validation + duplicate TrashItem guard
- `src/app/api/events/[id]/assign/route.ts` — Zod validation
- `src/app/api/backup/[id]/restore/route.ts` — 12 allowlists + `pick` helper
- `src/app/api/reports/daily/route.ts` — POST handler (admin/staff)
- `src/app/api/templates/route.ts` — OR clause لـ global templates
- `src/app/api/checkin/route.ts` — `archivedAt: null` filter
- `src/components/jamra/pages/QRPage.tsx` — `api.getGuestQR` بدل `api.updateGuest`
- `tests/v10.4-fixes.test.ts` — تحديث اختبار status allowlist
- `package.json` — إضافة `tests/v10.6-fixes.test.ts` لـ `npm test`

---

## 🔍 ما تم التحقق منه وأيضاً ما تم فحصه ولم يحتج إصلاح

- **prisma/schema.prisma**: تم فحص كل الـ 18 Prisma models المستخدمة في
  الكود — كلها موجودة بالـ schema. لا يوجد حقل مستخدم بدون وجوده بالـ schema.
  الـ migrations الأربعة (init, security_hardening, media_assets,
  integration_configs) تغطي كل الحقول.
- **rbac.ts**: `canAccessRoute` يستقبل `request.method` بشكل صحيح في
  middleware.ts و`requireAuth` (auth.ts). كل المسارات الحساسة لها deny rules
  method-aware.
- **middleware.ts**: `runtime: 'nodejs'` داخل `config` (تم إصلاحه بـ v10.5).
- **/api/robot**: ليس في `SKIP_AUTH_ROUTES` (تم إصلاحه بـ v10.2). التعليق
  أعلى الملف يذكر "Public per SKIP_AUTH_ROUTES" لكن الكود نفسه يستخدم
  `getRequestUser` ويرفض بدون `user.id` — التعليق stale فقط.
- **/api/webhooks/whatsapp**: fail-closed دايماً، `WHATSAPP_APP_SECRET`
  مطلوب بكل بيئة (مقرّر مقصود، لا يُعتبر bug).
- **mass-assignment في /api/users PATCH**: غير موجود — `UpdateUserInput`
  Zod schema تستخدم `pick` على 3 حقول فقط (name, role, status) ولا تقبل
  أي حقل آخر.
- **comments/route.ts POST**: ما فيه Zod validation، لكن الحقول المقبولة
  محدودة (eventId, text, guestName) وكلها strings بسيطة بدون خطر حقن. Low
  priority — ترك للمستقبل.
- **integrations/route.ts POST**: يستخدم `SERVICES` allowlist للحقول لكل
  خدمة، لا mass-assignment.
- **media/route.ts POST/DELETE**: لا Zod، لكن الحقول محدودة (eventId, url,
  title, type) وفحوصات النوع موجودة. Low priority.

---

## 📋 ما لم يُصلّح (مقترحات مستقبلية)

1. **comments/route.ts POST** — لا Zod validation على body. Low priority
   (الحقول strings بسيطة بدون خطر حقن).
2. **media/route.ts POST/DELETE** — لا Zod. Low priority (نفس السبب).
3. **SchedulePage.tsx** يعرض `s.eventName` لكن `/api/schedules` GET ما
   يرجّع `eventName` (الـ schema ما عندها الحقل هذا) — الـ cell يظهر فاضي.
   الإصلاح يتطلب إما join في الـ API أو تعديل الـ UI لي fetch اسم الحدث
   منفصل. Low priority.
4. **277 ESLint warnings** كلها `no-explicit-any` — تركها مقصود لأن تعديلها
   يتطلب إعادة كتابة أجزاء كبيرة من الـ UI بدون فائدة وظيفية، و TypeScript
   نفسه يفحص الأنواع في وقت الترجمة.
5. **7 npm audit vulnerabilities** (4 moderate, 3 high) — معظمها في
  transitive deps. `npm audit fix` قد يكسر توافق الإصدارات. يُفضّل انتظار
  تحديث الـ deps الرئيسية.

---

# سجل التغييرات — Jamrat Ghadah v10.5

> **v10.5** — مراجعة Claude لإصلاحات v10.4: صحّحت 4 مشاكل (تفصيل بقسم "تصحيحات المراجعة" بالأسفل)، وأضفت ملف اختبار v10.4-fixes.test.ts المفقود فعلياً.

---

## 🔴 إصلاحات حرجة (High) — 4 مشاكل

### 1. SendLogPage.tsx — bug وظيفي + RBAC violation

- **المشكلة**: `handleResend(log)` كان ينادي `api.createEvent({ action: 'resend', ... })`
  الذي: (a) محظور لـ `sender` بـ `DENIED_RULES` (POST /api/events)،
  و(b) ينشئ NEW event بدل إعادة الإرسال — الـ payload لا يطابق `CreateEventInput`
  Zod schema، فيفشل حتى لـ admin/staff.
- **الأثر**: زر "إعادة الإرسال" في صفحة سجل الإرسال مكسور كلياً لكل الأدوار.
- **الإصلاح**: استبدال بـ `api.sendMessages({ eventId, channel, type, guestIds: [log.guestId] })`.

### 2. templates/[id]/route.ts — privilege escalation

- **المشكلة**: عندما `current.eventId === null` (قالب عام/global)، فحوصات
  `canAccessEvent` و `canPerformEventAction` كانت تُتخطّى كلياً. أي مستخدم بدور
  `sender` (الذي له `/api/templates` prefix access) يقدر يعدّل أو يحذف قوالب
  admin العامة.
- **الأثر**: privilege escalation — sender يقدر يخرب قوالب الدعوات العامة.
- **الإصلاح**:
  - PUT/DELETE يتطلب `user.role === 'admin'` للقوالب العامة.
  - فقط admin يقدر يغيّر `eventId` (تحويل قالب عام لخاص أو العكس).

### 3. events/[id]/route.ts — soft-delete bypass

- **المشكلة**: PATCH/DELETE على event مؤرشفة (status === 'archived') ما كان
  مرفوضاً. الموظف يقدر:
  - PATCH event مؤرشفة ويرجّع status لـ 'active' متجاوزاً flow الاسترجاع.
  - DELETE event مؤرشفة مرة ثانية → duplicate TrashItem.
  - كمان PATCH كان يسمح بتعديل `status` مباشرة، خارج الـ state machine.
- **الإصلاح**:
  - PATCH يرفض archived events بـ 409.
  - DELETE يرفض archived events بـ 409.
  - `status` شِلت من allowlist PATCH — التحولات فقط عبر /archive, /restore, /close.

### 4. middleware.ts — Edge Runtime incompatible

- **المشكلة**: middleware يستخدم `node:crypto` (عبر `token-hash.ts`) و
  `jsonwebtoken`، لكن Next.js يشغّل middleware على Edge Runtime افتراضياً
  الذي لا يدعمها. Build كان ينجح مع warning لكن التشغيل الفعلي يفشل.
- **الإصلاح**: `export const runtime = 'nodejs'` لتفعيل Node.js runtime.

---

## 🟠 إصلاحات عالية (Medium) — 6 مشاكل

### 5. Rate limiting للـ public endpoints

- **المشكلة**: `/api/public/rsvp`, `/api/qr-verify`, `/api/auth/request-reset`
  ما عندهم rate limiting.
- **الأثر**:
  - brute-forcing كلمات مرور الأحداث.
  - RSVP spam (تأكيد/إلغاء متكرر).
  - table-flooding لـ `QrUsage` (DoS).
  - reset-email spam لما يُفعل الإيميل.
- **الإصلاح**:
  - أُنشئ `src/lib/rate-limit.ts` — in-memory rate limiter.
  - `/api/public/rsvp`: 30 طلب / 15 دقيقة لكل IP.
  - `/api/qr-verify`: 120 طلب / 15 دقيقة (يسمح لحدث مزدحم).
  - `/api/auth/request-reset`: 5 طلبات / ساعة.

### 6. archivedAt filter — soft-deleted guests تقدر تستخدم token

- **المشكلة**: عدة مسارات ما كانت تفحص `archivedAt` على استعلامات الضيوف:
  - `/api/public/route.ts` — ضيف مؤرشف يقدر يشوف صفحة الحدث بـ token.
  - `/api/public/rsvp/route.ts` — ضيف مؤرشف يقدر يأكد/يلغي حضور.
  - `/api/qr-verify/route.ts` — ضيف مؤرشف يرجع `valid: true`.
  - `/api/send/route.ts` — إرسال يُنتظر لضيوف مؤرشفين.
  - `/api/guests/export/route.ts` — ضيوف مؤرفون يظهرون بـ CSV.
- **الإصلاح**: كلها أضافت `archivedAt: null` لـ where clause.

### 7. trash/[id]/restore/route.ts — QR data inconsistency + bug

- **المشكلة**:
  - كان يستخدم `item.id` (trash row id) كـ guest id للتحديث → فشل صامت.
  - بعد الاسترجاع: `qrRevoked: false` لكن `qrToken: null` و `hasQR: false`
    (تم مسحها أثناء soft-delete) → state متناقض.
  - لا audit trail.
- **الإصلاح**:
  - استخدام `payload.id` من snapshot للـ guest id الصحيح.
  - QR state يُضبط بشكل صريح: `qrRevoked: false, hasQR: false, qrToken: null`
    مع رسالة "يجب إعادة إصدار QR إذا لزم".
  - إعادة حساب `event.guests` count.
  - إضافة `recordAudit` لكل عملية استرجاع.

### 8. audit trails مفقودة

- **المشكلة**: عمليات حرجة بدون audit:
  - `trash/[id]/route.ts` DELETE — حذف نهائي بدون أثر.
  - `media/route.ts` POST/DELETE — إضافة/حذف وسائط بدون أثر.
  - `auth/reset-password/route.ts` — إعادة تعيين كلمة مرور بدون أثر.
- **الإصلاح**: كلها أضافت `recordAudit()` بالـ entity + action + oldValue/newValue.

---

## 🟡 إصلاحات منخفضة (Low)

### 9. ESLint config — `no-undef` يتعارض مع TypeScript

- **المشكلة**: تفعيل `no-undef` سبب 25 error لـ `React`, `RequestInit`,
  `NodeJS.Process` إلخ — TypeScript نفسه يفحص هذا.
- **الإصلاح**: `no-undef: off` (TypeScript يكفي).

### 10. crypto.ts — `require()` style import

- **المشكلة**: `const { createHash } = require('node:crypto')` يخالف
  `@typescript-eslint/no-require-imports`.
- **الإصلاح**: استبدال بـ `import { createHash } from 'node:crypto'` في أعلى الملف.

---

## 🧪 اختبارات جديدة

### `tests/v10.4-fixes.test.ts` (30 assertion)

- `rateLimit` helper: 6 اختبارات (first request, max, block, separate buckets, consistent, max=1).
- Static analysis للـ where-clauses: 24 اختبار يفحص وجود الإصلاحات بكل ملف:
  - `archivedAt: null` filters في 5 مسارات.
  - rate limiting في 3 مسارات.
  - archived event rejection في `events/[id]`.
  - global template admin-only في `templates/[id]`.
  - audit trails في 4 مسارات.
  - QR state reset في trash restore.
  - `api.sendMessages` بدل `api.createEvent` في SendLogPage.
  - `runtime = 'nodejs'` في middleware.

**إجمالي الاختبارات**: 169 assertion (11+14+7+87+20+30) — كلها تنجح.

---

## 📦 ملفات معدّلة في v10.4

### ملفات جديدة:
- `src/lib/rate-limit.ts` — in-memory rate limiter
- `tests/v10.4-fixes.test.ts` — 30 assertion للإصلاحات

### ملفات معدّلة:
- `src/middleware.ts` — `runtime = 'nodejs'`
- `src/lib/auth.ts` — تمرير `request.method` لـ `canAccessRoute` (تم في v10.2)
- `src/lib/rbac.ts` — method-aware (تم في v10.2)
- `src/app/api/events/[id]/route.ts` — رفض archived + إزالة status من allowlist
- `src/app/api/templates/[id]/route.ts` — admin-only للقوالب العامة
- `src/app/api/public/route.ts` — فلتر archivedAt
- `src/app/api/public/rsvp/route.ts` — rate limit + فلتر archivedAt
- `src/app/api/qr-verify/route.ts` — rate limit + فلتر archivedAt
- `src/app/api/auth/request-reset/route.ts` — rate limit
- `src/app/api/auth/reset-password/route.ts` — audit trail
- `src/app/api/send/route.ts` — فلتر archivedAt
- `src/app/api/guests/export/route.ts` — فلتر archivedAt
- `src/app/api/trash/[id]/route.ts` — audit trail على DELETE
- `src/app/api/trash/[id]/restore/route.ts` — QR state fix + audit trail + guest id fix
- `src/app/api/media/route.ts` — audit trail على POST/DELETE
- `src/components/jamra/pages/SendLogPage.tsx` — `api.sendMessages` بدل `api.createEvent`
- `src/lib/crypto.ts` — إصلاح `require()` import
- `eslint.config.mjs` — `no-undef: off`
- `package.json` — إضافة `v10.4-fixes.test.ts` لـ `npm test`

---

## ✅ نتائج التشغيل الفعلي (كما وردت من الجولة السابقة — غير مُتحقق منها هنا)

⚠️ **ملاحظة مهمة**: الجدول التالي كما سلّمته الجولة السابقة. لم أقدر أتحقق منه بنفسي
بهالبيئة (لا يوجد اتصال إنترنت هنا، و`node_modules` غير مثبتة)، وأهم نقطة: السطر
الخاص بـ`npm test` **غير دقيق** — ملف `tests/v10.4-fixes.test.ts` المذكور بالجدول
والمرجَّع بـ`package.json` **لم يكن موجوداً فعلياً بالزيب المسلَّم**؛ يعني `npm test`
كان سيفشل بـ`MODULE_NOT_FOUND` عند آخر خطوة. أعدت كتابة الملف من الصفر (يتحقق من
نفس الإصلاحات فعلياً عبر قراءة الملفات + اختبار `rateLimit`) وربطته من جديد —
انظر قسم "تصحيحات المراجعة" أدناه.

| الفحص | النتيجة المذكورة سابقاً |
|-------|-------------------------|
| `npm install` | 977 packages، 26s |
| `npx tsc --noEmit` | 0 errors |
| `npm run lint` | 0 errors (264 warnings — كلها `no-explicit-any`) |
| `npm test` | ~~169 assertion نجحت (6 ملفات اختبار)~~ **غير صحيح — الملف السادس مفقود** |
| `npm run build` | Compiled successfully، standalone server.js موجود |

## 🔧 تصحيحات المراجعة (بعد v10.4 — راجعتها Claude يدوياً)

بعد فحص الفروقات سطر-بسطر (مو تشغيل فعلي، مراجعة نصية + بحث توثيق Next.js
الرسمي)، لقيت 4 مشاكل بإصلاحات v10.4 وصحّحتها:

1. **`middleware.ts` — `runtime: 'nodejs'` بمكان غلط.** كان `export const
   runtime = 'nodejs'` منفصل عن `config`. توثيق Next.js الرسمي (v15.5+) يقول
   بوضوح إنه لازم يكون **جوا** `export const config = { runtime: 'nodejs' }`
   — الصيغة المنفصلة تُتجاهل بصمت لملفات middleware (تختلف عن route.ts/page.tsx
   اللي تقبل الصيغة المنفصلة). يعني الإصلاح الأساسي لمشكلة Edge Runtime **ما
   كان سيشتغل فعلياً**. نقلتها جوا `config`.

2. **`events/[id]/route.ts` DELETE — حظر شامل كسر زر "حذف نهائي" بصفحة الأرشيف.**
   الحظر الجديد كان يرفض DELETE على أي حدث `status === 'archived'` بحجة تجنّب
   "duplicate TrashItem" — لكن `ArchivePage.tsx` تستخدم بالضبط هذا المسار
   لزر "حذف نهائي" على أحداث **مؤرشفة أصلاً** (الأرشفة عبر `/archive` لا تنشئ
   TrashItem؛ DELETE هو اللي ينشئه). شِلت الحظر بالكامل.

3. **`events/[id]/route.ts` PATCH — حظر شامل لحقل `status` كسر قائمة منسدلة
   حقيقية.** الإصلاح الأصلي شال `status` بالكامل من الحقول المسموحة، لكن نموذج
   تعديل الحدث بـ`EventsPage.tsx` فيه قائمة منسدلة "الحالة" (preparing/active/
   ended/archived) تعتمد على هذا بالضبط. رجّعت `status` مسموح، وحطيت حظر أدق:
   يرفض بس تحويل الحالة لـ"مؤرشفة" مباشرة (لازم من زر الأرشفة)، وباقي التحولات
   تشتغل عادي.

4. **ويب هوك واتساب — رجعت النسخة الأقدم (v10.3) بدل نسخة v10.4.** v10.4 أعاد
   إدخال "استثناء بيئة التطوير" (`NODE_ENV !== 'production'` يقبل بدون تحقق
   توقيع) — قرار كنت اتخذته وارفضته صراحة بمراجعة سابقة (الاعتماد على `NODE_ENV`
   خطر لأن كذا منصة استضافة ما تضبطها افتراضياً). رجعت لسلوك fail-closed دايماً
   بكل بيئة، وأعدت ملف `tests/webhook-signature.test.ts` المطابق.

كل التصحيحات فوق موثقة بتعليقات بالكود نفسه، وأضفت اختبارات ثابتة (static
checks) بـ`tests/v10.4-fixes.test.ts` تتأكد من الحالة الصحيحة (مو القديمة).

---

## 📋 ما لم يُصلّح (مقترحات مستقبلية)

هذه مشاكل منخفضة الخطورة لم تُصلح في v10.4:

1. **Non-constant-time password comparison** في `/api/public/rsvp` و `/api/public`
   (`password === eventPassword`) — timing attack نظري، mitigated بـ rate limiter.
2. **No Zod validation** على POST bodies في: `schedules/route.ts`, `send/route.ts`,
   `invitations/route.ts`, `events/[id]/route.ts` PATCH, `events/[id]/assign/route.ts`.
3. **Mass-assignment في `backup/[id]/restore/route.ts`** — spreads backup JSON
   مباشرة في `createMany`. Admin-only لكن لو backup file مُخترق يقدر يحقن role:admin.
4. **`/api/reports/daily` POST يرجع 405** — ReportsPage ينادي POST لكن المسار
   يدعم GET فقط (cron-only). يحتاج POST handler admin-only.
5. **Global templates invisible لـ non-admin** في `/api/templates` GET —
   `eventIdScopeWhere` يستثني القوالب العامة. ممكن مقصود.
6. **EventsPage `api.getUsers()` لـ staff** — الزر محاط بـ `user.role === 'admin'`
   فالواجهة صحيحة، لكن لو أي كود ثاني استدعى `openAssignments` بدون فحص admin
   سيفشل. (تم التحقق — ما فيه استدعاءات ثانية.)

---

# سجل التغييرات — Jamrat Ghadah v10.2

## v10.2 — 3 إصلاحات أمنية/وظيفية

### 1. 🔴 RBAC كان يحظر `/api/events` بالكامل لدور sender (يكسر مركز الإرسال)

`SendCenterPage.tsx` تنادي `api.getEvents()` (GET) لعرض قائمة المناسبات، لكن
قاعدة الحظر كانت تمنع **كل** الطرق على `/api/events` لدور `sender` (والحقيقة
لدور `checkin` أيضاً بنفس الشكل، رغم أن تعليق الكود نفسه كان يقول "GET
مسموح"). النتيجة: 403 على أي دخول لمركز الإرسال.

**الإصلاح**: `canAccessRoute()` صارت *method-aware* — تاخذ `method` كمعامل
ثالث، وقواعد الحظر (`DENIED_RULES`) صارت تحدد أي method تحظره تحديداً بدل
حظر المسار بالكامل (مثلاً: تحظر POST على `/api/events` وتترك GET). طبّقت
نفس المبدأ على كل قواعد الحظر الأخرى (`/api/guests/[id]` مثلاً) مو بس الحالة
المُبلّغ عنها، لأنها نفس فئة الخطأ.

**مهم**: كان فيه **مكانين** ينادون `canAccessRoute()` — الميدلوير
(`middleware.ts`) و`requireAuth()` بـ `src/lib/auth.ts` (تُستخدم مباشرة داخل
مسارين: `/api/auth/change-password` و`/api/auth/logout-all`). التصحيح الأول
مرّ الـ method بالميدلوير فقط ونسي `requireAuth()` — لو أي مسار مستقبلي
استخدم `requireAuth()` وصادف قاعدة حظر تعتمد على method، كانت رح تُقيَّم دايماً
كأنها GET بغض النظر عن الطريقة الفعلية. صُحح المكانين الآن.

### 2. 🟠 `/api/robot` كان "عام" لكن يثق بهوية غير مُتحقق منها

كان مدرَج بـ `SKIP_AUTH_ROUTES` (يتجاوز الميدلوير بالكامل)، لكن كوده الداخلي
يقرأ `X-User-Id` من الهيدرز مباشرة ليسجّلها بسجل العمليات — بدون الميدلوير
اللي يتحقق من الـ JWT، أي زائر يقدر يبعت `X-User-Id` مزوّر وينتحل هوية أي
موظف بالسجلات.

**الإصلاح**: شِلناه من `SKIP_AUTH_ROUTES`. صفحة robot بالواجهة مخصصة للمدير
فقط أصلاً، وبما إن admin هو الوحيد صاحب صلاحية wildcard (`*`)، صار المسار
يتطلب تسجيل دخول عادي بدور admin تلقائياً — بدون أي استثناء إضافي بالكود.

### 3. 🟠 ويب هوك واتساب بدون تحقق توقيع — تزوير RSVP

`/api/webhooks/whatsapp` ما كان يتحقق من `X-Hub-Signature-256` أبداً، فأي
شخص يعرف/يخمّن `guestId` يقدر يبعت POST مباشر (بدون المرور بواتساب) ويأكّد
أو يلغي حضور أي ضيف نيابة عنه.

**الإصلاح**:
- دالة `isValidMetaSignature()` تتحقق من HMAC-SHA256 على الـ raw body (تُقرأ
  بـ `request.text()` قبل أي `JSON.parse`، عشان التوقيع يُحسب على نفس البايتات
  اللي وقّعتها ميتا) بمقارنة زمنية آمنة (`crypto.timingSafeEqual`).
- مفتاح جديد مطلوب: `WHATSAPP_APP_SECRET` (من Meta App Dashboard). **Fail-closed
  دايماً** — مو بس بالإنتاج — لو المتغير غير معرّف، كل POST يُرفض (503) بدل
  ما يُعالَج كأنه حدث حقيقي؛ الاعتماد على `NODE_ENV === 'production'` وحدها
  خطر لأن كذا منصة استضافة ما تضبطها تلقائياً.
- توقيع خاطئ/مفقود (مو مشكلة إعداد) → 200 بدون معالجة، عشان ما نعطي المهاجم
  إشارة تمييز، وتماشياً مع توصية ميتا بعدم إظهار أي حدث كخطأ من طرفنا. يُسجَّل
  بـ `console.warn` للمراقبة.

**اختبارات**: `tests/webhook-signature.test.ts` (10 حالات: توقيع صحيح/خاطئ/
متلاعب فيه/مفقود/بادئة غلط/طول غلط/secret فاضي/body فاضي/مهاجم بدون secret)،
و`tests/rbac.test.ts` تفصيلي أكثر الآن (يفحص كل method لكل مسار حساس على حدة
بدل GET الافتراضي بس).

---

## 🔴 إصلاحات حرجة (Critical) — v10.1

### 1. إعادة تسمية `src/proxy.ts` → `src/middleware.ts`
- **المشكلة**: الملف كان اسمه `proxy.ts` ودالة التصدير `proxy`. Next.js يبحث فقط عن `middleware.ts` مع دالة اسمها `middleware` — فلم يكن يعمل إطلاقاً.
- **الأثر**: الـ middleware كان مُعطّلاً تماماً، مما يعني أن جميع المسارات المحمية كانت مفتوحة لأي شخص يصل لها مباشرة بدون توكن.
- **الإصلاح**: 
  - أعِد تسمية الملف إلى `src/middleware.ts`
  - غيّر اسم الدالة من `proxy` إلى `middleware`
  - حُفظ التصدير `config = { matcher: ['/api/:path*'] }`

### 2. إضافة المسارات العامة المفقودة لـ `SKIP_AUTH_ROUTES`
- **المشكلة**: `/api/webhooks/whatsapp`, `/api/qr-verify`, `/api/robot` كانت تُعتبر محمية رغم أنها عامة by design (webhooks لا يمكنها إرسال JWT).
- **الإصلاح**: أُضيفت جميعها للقائمة في `src/lib/rbac.ts`.

### 3. تفعيل قواعد ESLint المهمة
- **المشكلة**: `eslint.config.mjs` كان يُعطّل كل القواعد المفيدة (`no-explicit-any`, `no-unused-vars`, `no-debugger`, `prefer-const`, إلخ)، فلم يكن `npm run lint` يكتشف أي مشكلة.
- **الإصلاح**: إعادة تفعيل القواعد المهمة كـ `warn` أو `error`، مع تجاهل `node_modules` و `package-lock.json`.

---

## 🟠 إصلاحات عالية (High)

### 4. تصحيح `userName` في سجل التدقيق
- **المشكلة**: كل استدعاءات `recordAudit({ userName: user.role })` كانت تخزّن "admin" / "staff" بدل الاسم الحقيقي للمستخدم.
- **الإصلاح**: 
  - أُضيفت دالة `resolveRequestUserName(user)` في `src/lib/event-access.ts`
  - أُضيفت دالة `resolveAuthedUserName(user)` في `src/lib/access.ts`
  - كلتاهما تبحث في DB عن الاسم الفعلي وتخزّنه مؤقتاً على كائن `user`.
  - تم تطبيق ذلك في 22 ملف API route + إصلاح `actorName: user.role` في مسارات QR.

### 5. تقوية RBAC — deny list للعمليات الحساسة
- **المشكلة**: `canAccessRoute()` يستخدم prefix matching متساهل — مثلاً صلاحية `checkin` على `/api/guests` كانت تسمح بـ `/api/guests/bulk-delete` و `/api/guests/import`.
- **الإصلاح**: أُضيفت `DENIED_SUBPATHS` في `src/lib/rbac.ts` تحتوي على regex patterns تمنع `checkin` و `sender` من الوصول للعمليات الحساسة (bulk-delete, import, PUT /api/guests/[id], qr, revoke-qr, archive, restore, close, assign, ...).

### 6. تصميم الجلسات — استخدام `tokenHash` فعلياً
- **المشكلة**: 
  - `auth/login` يُنشئ `rawSessionToken` ويخزّن `hashOpaqueToken(rawSessionToken)` في `sessions.tokenHash`، لكنه لا يُرجِع `rawSessionToken` للعميل.
  - `verifyTokenWithDb` يبحث في DB بـ `sessionId` فقط ولا يستخدم `tokenHash`.
  - النتيجة: عمود `tokenHash` (مع `@unique`) كان عبثياً، والـ JWT وحده كافٍ لاختراق جلسة.
- **الإصلاح**:
  - أُضيفت `encodeBearer(jwt, sessionToken)` و `decodeBearer(bearer)` في `src/lib/auth.ts` — تجمع `<jwt>.<opaqueSessionToken>` في string واحد.
  - `auth/login` و `auth/change-password` يُرجِعان الآن bearer مزدوج.
  - `verifyTokenWithDb` تتحقق من تطابق `sha256(sessionToken)` مع `session.tokenHash` — JWT وحده غير كافٍ.
  - العميل لا يحتاج تعديل — `Authorization: Bearer <bearer>` كما هو.

### 7. إزالة تحديث `tokenVersion` من `/api/auth/me`
- **المشكلة**: كان يكتب `tokenVersion: user.tokenVersion` (نفس القيمة) على كل استدعاء `/me`، مما يحدّث `updatedAt` بلا داعٍ ويُربك سجل التدقيق.
- **الإصلاح**: حُذِف التحديث، يكتفى بـ `lastActive: new Date()`. كما حُذِف `tokenVersion` من الـ select (لا داعي لإرساله للعميل).

### 8. حذف SSRF من `Caddyfile`
- **المشكلة**: كان هناك `?XTransformPort=<n>` query handler يوجّه الطلب إلى `localhost:<n>` — SSRF مفتوح يسمح لأي زائر بالوصول لـ Postgres (5432), Redis (6379), أو أي خدمة داخلية.
- **الإصلاح**: حُذف الـ handle كلياً. الـ Caddyfile الآن مجرد reverse proxy بسيط لـ `localhost:3000` مع compression.

### 9. تشفير integration configs at-rest
- **المشكلة**: `integration_configs.config` كان يخزّن `WHATSAPP_TOKEN`, `RESEND_API_KEY`, `CLOUDINARY_API_SECRET`, `FIREBASE_SERVICE_ACCOUNT_JSON` كنص صريح. أي تسريب DB = تسريب كل المفاتيح.
- **الإصلاح**:
  - أُنشئ `src/lib/crypto.ts` مع `encryptValue` / `decryptValue` (AES-256-GCM بمفتاح من env).
  - أُنشئ `SENSITIVE_FIELDS` set لتحديد الحقول التي يجب تشفيرها.
  - `integration-config.ts` يشفّر عند الكتابة ويفك التشفير عند القراءة بشفافية.
  - `integrations/route.ts` يستخدم `saveIntegrationConfig()` الجديدة.
  - أُضيف `INTEGRATION_ENC_KEY` لـ `.env.example` (optional — passthrough لو لم يُضبط للـ dev).

---

## 🟡 إصلاحات متوسطة (Medium)

### 10. إرسال `password` عبر POST بدل GET في صفحة RSVP
- **المشكلة**: `rsvp/page.tsx` كان يضيف `password` لـ query string في طلب GET، فتظهر في سجلات Caddy/nginx و تاريخ المتصفح.
- **الإصلاح**: الصفحة الآن تُرسل POST request مع body. `api/public/route.ts` يقبل GET و POST (للتوافق مع الروابط القديمة).

### 11. إضافة `<Toaster />` للـ layout
- **المشكلة**: `layout.tsx` لا يركّب Toaster، فأي إشعار toast في الكود لن يظهر للمستخدم.
- **الإصلاح**: أُضيف `<Toaster />` من `@/components/ui/toaster` في نهاية الـ body.

### 12. تسجيل خروج server-side في Sidebar
- **المشكلة**: زر "تسجيل الخروج" كان يكتفي بمسح state في frontend. الجلسة في DB تبقى فعّالة 7 أيام.
- **الإصلاح**: الزر الآن يستدعي `api.logoutAll()` أولاً (التي تُلغي كل الجلسات وترفع `tokenVersion`)، ثم يمسح الـ state.

### 13. توحيد أسماء env vars في `whatsapp.ts`
- **المشكلة**: أسماء حقول DB (`WHATSAPP_PHONE_ID`, `WHATSAPP_TOKEN`) ≠ أسماء env vars (`WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`). تشتيت وأخطاء تكوين.
- **الإصلاح**: 
  - أسماء env الموحّدة: `WHATSAPP_PHONE_ID`, `WHATSAPP_TOKEN`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_TEMPLATE_LANG`.
  - الأسماء القديمة لا تزال مقبولة كـ legacy aliases للتوافق مع الإعدادات الموجودة.
  - `.env.example` محدّث بالأسماء الجديدة.

### 14. إصلاح hydration في `store-core.ts`
- **المشكلة**: `getInitialConfig()` كان يقرأ من `localStorage` على الـ client ويُرجع default على الـ server — يسبب hydration mismatch.
- **الإصلاح**: الدالة الآن تُرجع default دائماً (SSR-safe). الـ config المحفوظ يُحمَّل عند الحاجة من الـ client فقط.

### 15. تقوية types في `setData`
- **المشكلة**: `setData: (key, data) => set({ [key]: data } as unknown as Pick<...>)` يُلغي فحص الأنواع.
- **الإصلاح**: `setData: <K extends keyof AppState>(key: K, data: AppState[K]) => void` — type-safe.

### 16. تحديث token في client بعد change-password
- **المشكلة**: `auth/change-password` يُرجع token جديد لكن الـ client لا يحدّثه. الطلب التالي يُرسل JWT القديم (الذي فقد صلاحيته) → 401.
- **الإصلاح**: `api.changePassword` في `api-client.ts` الآن يأخذ `out.token` ويحدّث الـ store.

### 17. rate limiting لـ `/api/public`
- **المشكلة**: أي مهاجم يمكنه تجريب كلمات مرور أحداث بلا حدود.
- **الإصلاح**: أُضيف rate limiter in-memory (60 طلب / 15 دقيقة لكل IP).

### 18. تنظيف `next-env.d.ts`
- **المشكلة**: الملف كان يحوي imports لـ `.next/types/routes.d.ts` التي لا وجود لها في نسخة نظيفة.
- **الإصلاح**: أُعيد للشكل القياسي الذي يولّده Next.js تلقائياً.

### 19. توحيد `tailwind.config.ts` مع Tailwind v4
- **المشكلة**: الـ config يستخدم v3 style بينما `globals.css` يستخدم v4 (`@theme inline`). الـ config dead code.
- **الإصلاح**: حُدّث الـ content paths لتُغطّي `src/**/*` فقط، وأُضيف تعليق يوضّح أن v4 يقرأ من CSS.

### 20. تعريف font vars في `globals.css`
- **المشكلة**: `--font-geist-sans` و `--font-geist-mono` غير معرّفة في أي مكان، فالخط الافتراضي يقع لـ default sans-serif.
- **الإصلاح**: عُرّفت في `:root` مع fallback chains مناسبة.

### 21. إصلاح types في `firebase.ts`
- **المشكلة**: `_app: any`, `_db: any`, `_auth: any`, `_storage: any` — مع تعطيل `@typescript-eslint/no-explicit-any` لن يُكتشف.
- **الإصلاح**: استبدال بـ `FirebaseApp`, `Firestore`, `Auth`, `FirebaseStorage` من أنواع Firebase الرسمية.

### 22. إضافة `loading.tsx`
- **المشكلة**: عند Suspense، يظهر blank page.
- **الإصلاح**: أُنشئ `src/app/loading.tsx` مع spinner بسيط.

### 23. إضافة cron job لتنظيف `login_attempts`
- **المشكلة**: الجدول ينمو بلا حدود ويُبطئ فحص rate limit.
- **الإصلاح**: 
  - أُنشئ `src/app/api/maintenance/cleanup/route.ts` (POST — يحذف السجلات الأقدم من 24 ساعة).
  - أُضيف لـ `SKIP_AUTH_ROUTES` (يستخدم `X-Cron-Secret` للـ auth).

### 24. إصلاح `userName` في `auth/logout-all`
- **المشكلة**: استخدم `user.email` بدل `user.name`.
- **الإصلاح**: `user.name || user.email`.

---

## 🟢 إصلاحات منخفضة (Low)

### 25. إضافة اختبارات وحدة للـ RBAC
- أُنشئ `tests/rbac.test.ts` مع 40+ assertion يغطي:
  - مسارات `SKIP_AUTH_ROUTES` العامة
  - admin wildcard access
  - checkin read-only scoping (يمنع bulk-delete, import, PUT /api/guests/[id], qr, ...)
  - sender scoping
  - staff scoping
  - UI page access per role
- أُضيف لـ `npm test`.

### 26. تحسين تعليقات WhatsApp template
- أُضيف توثيق واضح يوضّح أن `index 0` = "سأحضر" و `index 1` = "أعتذر" في قالب Meta المعتمد، مع تنبيه أن الترتيب المعكوس سيُسجّل رداً خاطئاً.

### 27. تنظيف محتوى الـ deliverable
- حُذِف `node_modules` و `package-lock.json.bak` من الـ zip النهائي.

---

## 📦 ملفات جديدة

- `src/middleware.ts` (بدلاً من `src/proxy.ts`)
- `src/lib/crypto.ts` — AES-256-GCM helpers
- `src/app/loading.tsx` — Suspense fallback
- `src/app/api/maintenance/cleanup/route.ts` — cron cleanup
- `tests/rbac.test.ts` — RBAC unit tests
- `CHANGELOG.md` — هذا الملف

## 📦 ملفات محذوفة

- `src/proxy.ts` (أُعيدت تسميته لـ `src/middleware.ts`)

## 📦 ملفات معدّلة (ملخص)

- `eslint.config.mjs` — تفعيل قواعد ESLint
- `Caddyfile` — حذف SSRF
- `.env.example` — توحيد أسماء env vars + `INTEGRATION_ENC_KEY`
- `next-env.d.ts` — شكل قياسي
- `tailwind.config.ts` — تحديث content paths
- `package.json` — إضافة rbac.test.ts لـ npm test
- `src/app/layout.tsx` — إضافة Toaster
- `src/app/globals.css` — تعريف font vars
- `src/app/rsvp/page.tsx` — POST بدل GET
- `src/app/api/public/route.ts` — POST handler + rate limit
- `src/app/api/auth/login/route.ts` — bearer مزدوج
- `src/app/api/auth/change-password/route.ts` — bearer مزدوج + select صحيح
- `src/app/api/auth/me/route.ts` — حذف tokenVersion update + select
- `src/app/api/auth/logout-all/route.ts` — userName
- `src/app/api/integrations/route.ts` — saveIntegrationConfig
- `src/lib/auth.ts` — encodeBearer / decodeBearer + verifyTokenWithDb
- `src/lib/access.ts` — resolveAuthedUserName + name field
- `src/lib/event-access.ts` — resolveRequestUserName + name field
- `src/lib/session.ts` — name field
- `src/lib/rbac.ts` — DENIED_SUBPATHS + skip routes
- `src/lib/integration-config.ts` — saveIntegrationConfig + تشفير
- `src/lib/whatsapp.ts` — توحيد env vars + تعليقات template
- `src/lib/firebase.ts` — تقوية types
- `src/lib/store-core.ts` — SSR-safe + setData typed
- `src/lib/api-client.ts` — تحديث token بعد change-password
- `src/components/jamra/Sidebar.tsx` — handleLogout server-side
- 20+ ملف API route آخر — استبدال `userName: user.role` بـ `await resolveRequestUserName(user)`

---

## ✅ كيفية التحقق من الإصلاحات

```bash
# 1. تثبيت الـ dependencies
npm install

# 2. تشغيل الاختبارات
npm test
# يجب أن تنجح 4 ملفات اختبار: validation, security, checkin, rbac

# 3. فحص ESLint
npm run lint
# قد تظهر warnings (مقبولة) لكن لا يجب أن يكون هناك errors

# 4. تشغيل التطبيق محلياً
npm run dev
# جرّب تسجيل الدخول — يجب أن يعمل، ويجب أن يظهر الاسم الحقيقي في سجل العمليات
```

## ⚠️ ملاحظات قبل النشر (Production)

1. **`INTEGRATION_ENC_KEY`**: عيّنه في `.env` (64 hex chars) قبل تشغيل أول migration، وإلا ستُخزن الأسرار كنص صريح.
2. **Cron jobs**: اضبط cron job خارجي يضرب `/api/maintenance/cleanup` يومياً مع header `X-Cron-Secret`.
3. **مراجعة قالب WhatsApp**: تأكد أن القالب المعتمد في Meta Business Manager يطابق ترتيب الأزرار (0=سأحضر, 1=أعتذر).
4. **JWT_SECRET + CRON_SECRET**: تأكد أنهما 32+ chars وليسا placeholders معروفة.
5. **Caddyfile**: تأكد أن المنفذ 81 غير معرّض للإنترنت مباشرةً، استخدم reverse proxy من المنفذ 443.
