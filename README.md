# James Laser Hair Removal for Men: WhatsApp integration

Harmony Derma, Khalid Bin Walid St, Al Hamra, Riyadh. WhatsApp +966 55 740 1562. Saturday to Thursday, 1:00 PM – 10:00 PM.

## ما الموجود هنا

- **`site/`** موقع ثابت مجاني على GitHub Pages: صفحة رئيسية، ونموذج طلب موعد يفتح واتساب برسالة جاهزة، وأداة روابط لفريق العيادة (22 منطقة بالعربية والإنجليزية). لا يحفظ بيانات ولا يستخدم تتبعاً.
- **`blogger/`** زر واتساب عائم للمدونة، مع خطوات التركيب.
- **`api/worker/`** خادم Cloud API جاهز ومُختبَر دون اتصال، **غير منشور**، والردود الآلية متوقفة افتراضياً.
- **`docs/CLOUD-API-PLAN.md`** الخطة والتكلفة وقائمة ما قبل التفعيل.
- **`admin/`** لوحة إدارة (مواعيد، عملاء وموافقات، قوالب رسائل، عروض، مناطق) على Supabase مع استضافة مجانية. الإرسال يدوي بروابط واتساب. الدليل: `docs/ADMIN-PORTAL.md`.

## What is here

| Folder | What | State |
|---|---|---|
| `site/` | Free static site for GitHub Pages: home, appointment-request form that opens WhatsApp with a ready message, link builder for the team (22 areas, Arabic and English) | Browser-tested locally. Not yet published |
| `blogger/` | Floating WhatsApp button for the Blogger blog, plus install steps | Tested in a desktop page, not inside Blogger |
| `api/worker/` | WhatsApp Cloud API webhook (Cloudflare Worker) | 53 offline tests. **Not deployed. Replies OFF** |
| `admin/` | Admin portal on Supabase + GitHub Pages: appointments, clients and consent, message templates, offers, areas. Sending is manual via WhatsApp links | 16 unit tests, 67 browser checks (mock backend), 87 database security checks on the real project. Guide: `docs/ADMIN-PORTAL.md` |
| `docs/` | Cloud API plan, costs, go-live checklist | |

## Publish the site (free)

1. Merge the `whatsapp-integration` branch into `main`.
2. Repository **Settings > Pages > Build and deployment > Source: GitHub Actions**.
3. The `Deploy site to Pages` workflow publishes `site/` at `https://jameslaser.github.io/whatsappbusiness/`.

## Change things in one place

- Area names and codes: `site/data/areas.js` (matches the WhatsApp catalog).
- Number, hours and brand text: `CFG` at the top of `site/assets/wa.js`, plus the footers in the three HTML pages.
- Floating button: `site/assets/wa-button.js`, then `node tools/build-snippet.mjs`.
- Tests: `cd api/worker && npm test`. No installs needed.

## Rules built into the wording

- No "permanent", "painless", "guaranteed", "best", "expert" or "number one". No prices or offers (they need the clinic's approved totals and, for offers, the Ministry approval number). No patient photos or testimonials.
- Every page carries the advertisement label, entity name, contact, hours and the risk warning, Arabic first.
- The booking form stores nothing. It asks visitors not to type medical details.
- The pages are set to `noindex`: the blog stays the single SEO page for this topic.

These rules follow our reading of the Ministry of Health advertising annex. The clinic's licensing contact should confirm them.
