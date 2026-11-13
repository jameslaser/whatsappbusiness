# لوحة الإدارة | Admin portal

الرابط بعد النشر: `https://jameslaser.github.io/whatsappbusiness/admin/` (الصفحة مخفية عن محركات البحث ولا يدخلها إلا من أُضيف كمسؤول).
After publishing: `https://jameslaser.github.io/whatsappbusiness/admin/` (hidden from search engines; only people added as admins can see anything).

## ما تفعله اللوحة | What it does

| الشاشة / Screen | العربية | English |
|---|---|---|
| اليوم / Today | طلبات جديدة، مواعيد اليوم، وما يستحق الإرسال: تذكير، تعليمات قبل الجلسة، تعليمات بعدها | New requests, today's appointments, and what is due: reminders, pre- and post-session messages |
| المواعيد / Appointments | إضافة وتعديل وتغيير الحالة (جديد، تم التواصل، مؤكد، تمت، ملغي، لم يحضر) بتوقيت الرياض | Add, edit, change status, all in Riyadh time |
| العملاء / Clients | الاسم والرقم (يُوحَّد تلقائياً إلى 9665…)، اللغة، موافقة العروض ومصدرها، إيقاف الرسائل، الحذف الكامل | Name, number (normalised to 9665…), language, offer consent and its source, opt-out, full erasure |
| الرسائل / Messages | قوالب التذكير وما قبل وبعد الجلسة. لا يُرسل قالب إلا بعد اعتماده | Reminder, before and after templates. A template can be sent only after approval |
| العروض / Offers | عرض بالعربية والإنجليزية، رقم الموافقة، التواريخ (60 يوماً كحد أقصى)، قائمة المستلمين الموافقين فقط | Bilingual offer, approval number, dates (60 days max), recipient list of consenting clients only |
| المناطق / Areas | أسماء المناطق وتفعيلها، وتنزيل `areas.js` لموقع الحجز | Area names and on/off, plus a download of `areas.js` for the booking pages |
| السجل / Log | ما سُجّل كمُرسل آخر 90 يوماً + نسخة احتياطية JSON | What was marked as sent in the last 90 days + JSON backup |

## الإرسال: ما يحدث فعلاً | Sending: what really happens

**لا يوجد إرسال تلقائي.** اللوحة تجهّز النص وتفتح واتساب برسالة جاهزة (`wa.me`)؛ تضغط إرسال بنفسك ثم ترجع وتضغط «تم الإرسال» ليُسجَّل. الإرسال التلقائي يتطلب واجهة Cloud API (مدفوعة) وهي غير مفعّلة، انظر `CLOUD-API-PLAN.md`.

**There is no automatic sending.** The portal prepares the text and opens WhatsApp with the message ready (`wa.me`); you press send yourself, then come back and tap "Mark as sent". Automatic sending needs the Cloud API (paid), which is not enabled; see `CLOUD-API-PLAN.md`.

## قواعد مضمونة في قاعدة البيانات | Rules enforced by the database

هذه القواعد تعمل حتى لو تعطل التطبيق أو دخل أحد مباشرة إلى الواجهة البرمجية، وقد اختُبرت على قاعدة البيانات الفعلية (87 فحصاً، `admin/test/db-security.sql`):
These hold even if the app is bypassed, and were tested on the real database (87 checks, `admin/test/db-security.sql`):

- لا قراءة ولا كتابة لغير المسؤولين، ولا شيء للزائر غير المسجّل. No access at all for anonymous visitors, and none for signed-in people who are not admins.
- العرض يُرسل فقط إذا كان معتمداً وله رقم موافقة وداخل تواريخه (توقيت الرياض)، ولعميل وافق ولم يوقف الرسائل. An offer can be logged as sent only if it is approved, has an approval number, is inside its dates (Riyadh time), and the client agreed and has not opted out.
- العرض لا يزيد على 60 يوماً. An offer lasts at most 60 days.
- الرسائل الأخرى لا تُسجَّل إلا من قالب معتمد. Other messages can be logged only from an approved template.
- حذف العميل يحذف مواعيده وسجل رسائله. Deleting a client deletes their appointments and message history.

## فحص الصياغة | Wording check

اللوحة تمنع اعتماد أي قالب أو عرض يحتوي كلمات مثل «دائم»، «بدون ألم»، «مضمون»، «أفضل»، «خبير»، "permanent"، "painless"، "guaranteed"، "best"، "expert"، أو أقواساً `[ ]` تعني أن النص لم يكتمل. عبارة «النتائج لا تُضمن» مسموحة. هذا فحص مساعد وليس رأياً قانونياً: مسؤول التراخيص في العيادة هو من يؤكد القواعد.
The portal blocks approving any template or offer containing words like those above, or `[ ]` brackets (unfinished text). "Results are not guaranteed" is allowed. This is a safety net, not legal advice: the clinic's licensing contact confirms the rules.

**نصوص ما قبل وبعد الجلسة طبية:** تكتبها العيادة وتعتمدها؛ لم أكتب أي تعليمات طبية، والقالبان يبدآن فارغين وغير معتمدين.
**Before and after instructions are medical text:** the clinic writes and approves them. No medical instructions were written for you; both templates start empty and unapproved.

## التشغيل لأول مرة | First-time setup

1. **إنشاء حسابك.** في لوحة Supabase: Authentication > Users > Add user > Create new user. اكتب بريدك وكلمة مرور طويلة وفريدة، وفعّل «Auto Confirm User».
   **Create your login.** Supabase dashboard: Authentication > Users > Add user > Create new user. Enter your email and a long, unique password, and tick "Auto Confirm User".
2. **أوقف التسجيل الجديد** من إعدادات Authentication (خيار السماح للمستخدمين الجدد بالتسجيل). حتى لو بقي مفتوحاً، أي حساب جديد لا يرى شيئاً لأنه ليس مسؤولاً (مُختبَر)، لكن إيقافه أنظف.
   **Turn off new sign-ups** in the Authentication settings. Even if left on, a new account sees nothing because it is not an admin (tested), but turning it off is cleaner.
3. **أضف نفسك كمسؤول.** في Supabase > SQL Editor نفّذ (بدّل البريد ببريدك):
   **Make yourself an admin.** In Supabase > SQL Editor run (replace the email with yours):
   ```sql
   insert into private.admin_users (user_id)
   select id from auth.users where email = 'YOUR-EMAIL-HERE';
   ```
4. **انشر.** ادمج فرع `admin-portal` في `main`؛ سيبني سير عمل `Deploy site to Pages` اللوحة وينشرها مع الموقع. (Pages يجب أن يكون مضبوطاً على GitHub Actions.)
   **Publish.** Merge `admin-portal` into `main`; the `Deploy site to Pages` workflow builds the portal and publishes it with the site. (Pages must be set to GitHub Actions.)
5. **اعتمد القوالب والعروض** من داخل اللوحة قبل أول إرسال. **Approve templates and offers** in the portal before your first send.

## حدود يجب أن تعرفها | Limits you should know

- **الخطة المجانية في Supabase تتوقف بعد أسبوع دون نشاط ولا تحتفظ بنسخ احتياطية.** افتح اللوحة أسبوعياً ونزّل نسخة JSON من شاشة «السجل». الملف يحوي أسماء وأرقام العملاء، فاحفظه بأمان.
  **The free Supabase plan pauses after a week of inactivity and keeps no backups.** Open the portal weekly and download the JSON backup from the Log screen. It holds client names and numbers, so store it safely.
- **موقع البيانات:** مشروع Supabase الحالي في منطقة `ap-northeast-2` (كوريا الجنوبية). بيانات العملاء بيانات شخصية، ونقلها خارج المملكة قد يخضع لنظام حماية البيانات الشخصية (PDPL). لم أتحقق من ذلك قانونياً؛ يجب أن يؤكده المسؤول عن التراخيص والخصوصية في العيادة قبل إدخال بيانات حقيقية. لا يمكن تغيير منطقة مشروع قائم؛ يلزم مشروع جديد.
  **Data location:** the current Supabase project is in `ap-northeast-2` (South Korea). Client data is personal data, and moving it outside the Kingdom may be covered by the PDPL. I have not verified this legally; the clinic's licensing and privacy contact must confirm before real data goes in. A project's region cannot be changed; a new project would be needed.
- **لا توجد مصادقة ثنائية** في اللوحة بعد. استخدم كلمة مرور طويلة فريدة. يُسجَّل الخروج تلقائياً بعد 30 دقيقة دون نشاط.
  **No two-factor sign-in** in the portal yet. Use a long, unique password. It signs out after 30 minutes of inactivity.
- **ردود الواتساب الآلية** في الخادم (`api/worker/src/index.js`) لا تتغير من اللوحة، ومتوقفة أصلاً حتى يُفعَّل Cloud API.
  **Automatic WhatsApp replies** on the server (`api/worker/src/index.js`) are not editable here and are off until the Cloud API is enabled.
- **صفحة الحجز العامة** تقرأ `site/data/areas.js` الثابت. بعد تعديل المناطق في اللوحة نزّل `areas.js` واستبدل به الملف وادفع التغيير.
  **The public booking page** reads the static `site/data/areas.js`. After editing areas in the portal, download `areas.js`, replace the file and push.
- لا تضع ملاحظات طبية في حقل الملاحظات (الحد 500 حرف). Keep medical details out of the notes field (500 characters max).

## للمطوّر | For developers

```bash
cd admin
npm ci            # pinned versions, lockfile committed
npm test          # 16 unit tests (phone, dates, wording check, templates, offers, due list)
node build.mjs    # bundles into ../site/admin (ignored by git; the workflow builds it)
python3 test/e2e/e2e.py   # 67 browser checks on a phone-sized screen against a MOCK Supabase (needs Playwright)
```

- المفتاح في `admin/src/config.js` هو المفتاح العام (publishable) المصمم للمتصفح؛ الحماية من سياسات RLS. لا تضع أبداً مفتاح `service_role` أو السري في الكود. The key in `admin/src/config.js` is the publishable key meant for browsers; RLS does the protecting. Never put a `service_role` or secret key in the code.
- الهجرة: `admin/supabase/migrations/20261113000001_init.sql` (مطبّقة على المشروع). Migration: already applied to the project.
- اختبار الأمان على قاعدة البيانات: `admin/test/db-security.sql` (كل كتلة `DO` تنتهي بخطأ مقصود فيُتراجع عن كل شيء). Database security test: each `DO` block ends with an intentional error, so everything rolls back.
- سياسة أمان المحتوى (CSP) في `admin/index.html`: لا سكربتات خارجية ولا أنماط مضمّنة؛ كل نص بيانات يُعرض بـ `textContent`. The CSP in `admin/index.html` allows no external scripts or inline styles; all data is rendered with `textContent`.
