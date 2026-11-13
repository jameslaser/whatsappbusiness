# WhatsApp Cloud API plan (not deployed)

Status: code written and unit-tested offline. **Nothing is deployed, nothing was purchased, and automatic replies are OFF by default.**

## ملخص بالعربية

هذه خطة لربط واتساب عبر Cloud API. لم يُنشر أي شيء ولم يُدفع أي مبلغ، والردود الآلية متوقفة افتراضياً.

- **الخيار أ: رقم جديد منفصل.** رقمك الحالي في تطبيق واتساب للأعمال يبقى كما هو (قوائم البث والكتالوج والحالة). لكن الرقم الجديد ليس له صندوق وارد في التطبيق، فتحتاج طريقة لمتابعة المحادثات.
- **الخيار ب: الاحتفاظ برقمك الحالي (التعايش).** وفق وثائق Meta يتم التسجيل عبر مزوّد حلول معتمد، وبعدها تتعطل قوائم البث في التطبيق ولا يمكن إنشاء قوائم جديدة.
- **قبل التفعيل:** موافقة العيادة على نص كل رد، وتوصيل تحويل الرسائل إلى فريق العيادة، وسياسة الخصوصية (PDPL)، والتأكد من رسوم Meta. لا تكلفة بدون موافقتك.

## 1. What is built

| Piece | Where | State |
|---|---|---|
| Webhook: verification handshake, signature check, rule-based bilingual replies, hand-off hook | `api/worker/src/index.js` | 53 offline tests pass; bundle and config validate with a Cloudflare dry run |
| Template sender for reminders (`sendTemplate`) | same file | payload shape tested only; unused by default |
| Website kit (booking form, area links, floating button) | `site/`, `blogger/` | separate from the API; works without it |

The replies are fixed wording (Arabic first when the customer writes Arabic). There is no AI, no price, no outcome claim and no medical advice in them. Anything about price, offers, symptoms or an unknown question is flagged as a hand-off. A symptom message gets a safety line (nearest hospital, ambulance 997) plus a hand-off.

## 2. Decision needed: which number

**Option A: a new, separate number on the Cloud API.**
- Your current WhatsApp Business app number is untouched: broadcast lists, catalog, Status and the Meta Business Agent keep working.
- The new number has no inbox in the WhatsApp Business app. A person can only answer through some inbox you choose or build, so hand-off (section 6) matters.
- Start with the test number Meta's developer dashboard provides (check its current limits). That changes nothing on your live number.

**Option B: keep your current number (coexistence).**
- Per Meta's documentation, onboarding is done through Embedded Signup by a Solution Partner or Tech Provider. A solo clinic would normally go through such a provider. Provider fees were not checked.
- After onboarding (Meta's documented limits): group chats are not synced; disappearing messages, view-once and live location are turned off in 1:1 chats; **broadcast lists are blocked (new ones) and existing ones become read-only**; voice and video calls are not supported; business tools, messaging tools and the business profile stay in the app but are not supported through the API; Windows and WearOS companion apps are unsupported and onboarding unlinks all companion devices.
- You would lose free broadcast lists on the app, which you may want to keep.

**Recommendation:** Option A for testing first. Decide on B only after you have the provider price and accept the broadcast-list change.

## 3. Money

Nothing here has been bought. Items that can cost money, each needing your explicit approval first:

- Meta's per-message charges for template messages (marketing, utility, authentication). See Meta's pricing page. Saudi rates were **not** verified.
- A provider, if you choose Option B.
- An inbox tool, if you choose Option A.
- Cloudflare, only if you outgrow its free Workers plan.

## 4. Go-live checklist (every line must be yes)

1. Number decision made (section 2).
2. Business verification and the Meta app are set up; a permanent System User token exists (temporary tokens expire).
3. Webhook verified and receiving test messages.
4. **Hand-off works** (section 6), because every "we will pass it to the clinic team" line promises it.
5. The clinic has approved each reply in `T` inside `src/index.js`, and the Ministry of Health advertising rules were checked for any marketing template. Offers need the regional approval number.
6. Opt-in is recorded before any template or marketing message. Meta's send guide states you can message only users who opted in.
7. PDPL: the privacy notice mentions WhatsApp (Meta) and the hosting provider. Logs hold message ids and intents only, never phone numbers or text. Retention for hand-off emails is decided.
8. Only then set `REPLIES_ENABLED` to `"true"`.

## 5. Technical setup

1. In Meta for Developers, create an app of the Business type and add the WhatsApp product. Note the **Phone Number ID** and the **WABA ID**.
2. `cd api/worker`, then `npx wrangler login` (free Cloudflare account).
3. Set the secrets: `npx wrangler secret put VERIFY_TOKEN`, `APP_SECRET`, `WHATSAPP_TOKEN`, `PHONE_NUMBER_ID` (and `HANDOFF_WEBHOOK_URL` when ready).
4. `npx wrangler deploy`. Check `GRAPH_VERSION` in `wrangler.toml` against Meta's current Graph API version first. Meta says versions live roughly two years.
5. In the Meta dashboard set the callback URL to `https://<your-worker>.workers.dev/webhook` and the same verify token. Subscribe to the `messages` field.
6. Test with the test number. Watch `npx wrangler tail`: you should see `intent`, `live` and `sent` only.
7. To check your own signature handling, sign a body with your app secret:
   `node -e "const c=require('crypto');const b=JSON.stringify({object:'whatsapp_business_account',entry:[]});console.log(c.createHmac('sha256',process.env.APP_SECRET).update(b).digest('hex'))"`
   then send it with `curl -X POST <url>/webhook -H "X-Hub-Signature-256: sha256=<hex>" -d '<same body>'` and expect `200`. A wrong hex must return `401`.
8. Optional: create a KV namespace named `SEEN` and bind it to skip duplicate deliveries.

## 6. Hand-off to a person

If `HANDOFF_WEBHOOK_URL` is set, the worker POSTs `{id, from, text, type, intent, at}` there for flagged messages. A free route is a Google Apps Script web app that emails the clinic. It carries the customer's number and text, so it is personal data going to your own Google account. Treat it as such under PDPL.

```javascript
function doPost(e) {
  if (e.parameter.k !== 'PUT-A-LONG-RANDOM-STRING-HERE') return ContentService.createTextOutput('no');
  var d = JSON.parse(e.postData.contents);
  MailApp.sendEmail('jameslaserappointment@gmail.com', 'WhatsApp follow-up: ' + d.intent,
    'From: ' + d.from + '\nType: ' + d.type + '\nTime: ' + d.at + '\n\n' + d.text);
  return ContentService.createTextOutput('ok');
}
```

Deploy it as a web app that anyone can call, then use `https://script.google.com/macros/s/<id>/exec?k=PUT-A-LONG-RANDOM-STRING-HERE` as `HANDOFF_WEBHOOK_URL`. The random string stops strangers from posting to it.

## 7. Appointment reminders (later)

Needs four things that do not exist yet: an appointment data source, a utility template approved by Meta, the patient's opt-in, and a scheduler (for example Cloudflare Cron Triggers). The sender function is ready (`sendTemplate`); the rest is not started. Outside the 24-hour customer window only approved templates can be sent.

## 8. Tested and not tested

- Tested: webhook handshake, signature check (including Arabic and emoji bodies), reply routing in Arabic and English, no phone numbers or text in logs, replies off by default, duplicate guard, failure handling. A Cloudflare dry run accepted the bundle and config.
- **Not tested:** any call to the live Meta API, the current Graph API version, Meta's approval of your templates, a real deployment, and the GitHub Pages deployment of `site/`.

## Sources

- [Onboarding WhatsApp Business app users (coexistence), Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users)
- [Webhooks overview and message payload, Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview)
- [Create a webhook endpoint (verification and X-Hub-Signature-256), Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint)
- [Sending messages, Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages)
- [Cloud API overview (versions, free-form versus template messages), Meta](https://developers.secure.facebook.com/docs/whatsapp/cloud-api/overview)
- [WhatsApp Business Platform overview and pricing entry point, Meta](https://developers.facebook.com/documentation/business-messaging/whatsapp/overview)
