// James Laser Hair Removal for Men: WhatsApp Cloud API webhook (Cloudflare Worker, module syntax).
//
// STATUS: written and unit-tested offline against a mocked Graph API. NOT deployed, NOT run against live Meta.
// It answers only from fixed, pre-approved wording: no AI, no prices, no outcome claims, no medical advice.
// Replies stay OFF until REPLIES_ENABLED is "true". See docs/CLOUD-API-PLAN.md before enabling anything.

const DEFAULTS = {
  GRAPH_VERSION: 'v22.0', // check Meta's current Graph API version before go-live
  SITE_URL: 'https://jameslaser.github.io/whatsappbusiness/',
  GUIDE_URL: 'https://jameslaserhairremoval.blogspot.com/2026/11/mens-laser-hair-removal-riyadh.html'
};

const MAPS_URL = 'https://www.google.com/maps/search/?api=1&query=Harmony+Derma+Khalid+Bin+Walid+St+Al+Hamra+Riyadh';

/* ------------------------------------------------------------------ text helpers */

const AR_RE = /[؀-ۿ]/;

export function isArabic(text) { return AR_RE.test(text || ''); }

// Lower-case, Arabic-Indic digits to ASCII, strip diacritics/tatweel, unify alef/ya/ta marbuta.
export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

function tokens(text) {
  return normalize(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

// An Arabic word can carry one prefix (ال، و، ب، ل، ف، وال، بال، لل). Try the bare word and the common stripped forms.
function variants(token) {
  const out = new Set([token]);
  for (const p of ['وال', 'بال', 'لل', 'ال', 'و', 'ب', 'ل', 'ف']) {
    if (token.startsWith(p) && token.length > p.length + 1) out.add(token.slice(p.length));
  }
  return out;
}

function hasAny(toks, wordSet) {
  for (const t of toks) for (const v of variants(t)) if (wordSet.has(v)) return true;
  return false;
}

const W = (s) => new Set(s.split(/\s+/).filter(Boolean));

// Keywords are written already normalized (no hamza, ya instead of alef maqsura, ha instead of ta marbuta).
const KW = {
  safety: W('حرق حروق حرقه تورم ورم بثور حويصلات الم حساسيه تحسس التهاب عدوي نزيف تفاعل مضاعفات شكوي مشكله ' +
            'burn burns burned blister blisters swelling swollen pain painful infection infected reaction allergic complaint bleeding scar scars'),
  price: W('سعر اسعار تكلفه تكاليف كم بكم عرض عروض خصم خصومات ' +
           'price prices cost costs pricing offers discount discounts'),
  book: W('موعد حجز احجز book booking appointment appointments reserve'),
  hours: W('دوام ساعات مفتوح تفتحون اوقات مواعيد مواعيدكم hours open opening closing closed'),
  where: W('موقع عنوان وين فين لوكيشن خريطه اين location address where map directions'),
  areas: W('مناطق منطقه خدمات services areas area treat treatment treatments'),
  greet: W('السلام سلام مرحبا اهلا هلا hi hello hey menu قائمه start')
};

/* ------------------------------------------------------------------ fixed wording (Arabic first) */

const T = {
  ar: {
    footer: 'James Laser Hair Removal for Men، Harmony Derma، الحمراء، الرياض.\nمن السبت إلى الخميس، 1:00 ظهراً – 10:00 مساءً.',
    hoursLine: 'ساعات العمل: من السبت إلى الخميس، 1:00 ظهراً – 10:00 مساءً. الجمعة مغلق.',
    menu: (s) => 'أهلاً بك في James Laser Hair Removal for Men.\nاكتب رقماً أو كلمة:\n1 - المناطق\n2 - ساعات العمل\n3 - الموقع\n4 - طلب موعد\nأو اكتب سؤالك وسنحوّله إلى فريق العيادة.',
    areas: (s) => 'نقدّم إزالة الشعر بالليزر للرجال في: الوجه والرقبة، والجزء العلوي، والذراعين والساقين، ومنطقة البوكسر، والباقات.\nتفاصيل كل منطقة وروابط للاستفسار عنها: ' + s,
    hours: () => T.ar.hoursLine,
    where: () => 'Harmony Derma، شارع خالد بن الوليد، الحمراء، الرياض.\n' + MAPS_URL,
    book: (s) => 'يمكنك إرسال طلب موعد من هنا: ' + s + 'book.html\nهذا طلب وليس تأكيداً، ويتأكد موعدك برد العيادة.',
    price: () => 'تختلف التكلفة حسب المنطقة وعدد الجلسات المناسب لك، وتُؤكَّد بعد فحص بشرتك وشعرك. سنحوّل سؤالك إلى فريق العيادة ليزوّدك بالتفاصيل المعتمدة.',
    safety: () => 'نأسف لسماع ذلك. إذا كانت لديك أعراض شديدة مثل ألم شديد أو حروق أو تورم متزايد أو صعوبة في التنفس، فتوجّه فوراً إلى أقرب مستشفى أو اتصل بالإسعاف على 997. وسنحوّل رسالتك إلى فريق العيادة للمتابعة.',
    fallback: () => 'شكراً لرسالتك. سنحوّلها إلى فريق العيادة.\nللقائمة اكتب: 1 للمناطق، 2 للدوام، 3 للموقع، 4 للموعد.',
    nontext: () => 'استلمنا رسالتك. نستطيع الرد هنا على الرسائل النصية فقط، وسنحوّل رسالتك إلى فريق العيادة.'
  },
  en: {
    footer: 'James Laser Hair Removal for Men, Harmony Derma, Al Hamra, Riyadh.\nSaturday to Thursday, 1:00 PM – 10:00 PM.',
    hoursLine: 'Hours: Saturday to Thursday, 1:00 PM – 10:00 PM. Closed on Friday.',
    menu: () => 'Welcome to James Laser Hair Removal for Men.\nReply with a number or a word:\n1 - Areas\n2 - Hours\n3 - Location\n4 - Appointment request\nOr type your question and we will pass it to the clinic team.',
    areas: (s) => 'We offer men\'s laser hair removal for: face and neck, upper body, arms and legs, the boxer area, and packages.\nDetails for each area and links to ask about it: ' + s,
    hours: () => T.en.hoursLine,
    where: () => 'Harmony Derma, Khalid Bin Walid St, Al Hamra, Riyadh.\n' + MAPS_URL,
    book: (s) => 'You can send an appointment request here: ' + s + 'book.html?lang=en\nThis is a request, not a confirmation. Your appointment is confirmed by the clinic\'s reply.',
    price: () => 'Cost depends on the area and the number of sessions that suits you, and is confirmed after your skin and hair are checked. We will pass your question to the clinic team for the approved details.',
    safety: () => 'We are sorry to hear that. If you have severe symptoms such as strong pain, burns, increasing swelling or difficulty breathing, go to the nearest hospital now or call the ambulance on 997. We will pass your message to the clinic team for follow-up.',
    fallback: () => 'Thank you for your message. We will pass it to the clinic team.\nFor the menu reply: 1 areas, 2 hours, 3 location, 4 appointment.',
    nontext: () => 'We received your message. We can only reply to text messages here, and we will pass it to the clinic team.'
  }
};

/* ------------------------------------------------------------------ intent + reply */

export function detectIntent(text) {
  const toks = tokens(text);
  const joined = toks.join(' ');
  if (hasAny(toks, KW.safety)) return 'safety';
  if (hasAny(toks, KW.price) || /how much/.test(joined)) return 'price';
  if (hasAny(toks, KW.book)) return 'book';
  if (hasAny(toks, KW.hours) || /what time|when do you/.test(joined)) return 'hours';
  if (hasAny(toks, KW.where)) return 'where';
  if (hasAny(toks, KW.areas) || /what do you (offer|treat|do)/.test(joined)) return 'areas';
  if (joined === '1') return 'areas';
  if (joined === '2') return 'hours';
  if (joined === '3') return 'where';
  if (joined === '4') return 'book';
  if (hasAny(toks, KW.greet)) return 'menu';
  return 'fallback';
}

const HANDOFF = new Set(['safety', 'price', 'fallback', 'nontext']);

export function buildReply(text, opts = {}) {
  const site = opts.siteUrl || DEFAULTS.SITE_URL;
  const lang = isArabic(text) ? 'ar' : 'en';
  const intent = opts.type && opts.type !== 'text' ? 'nontext' : detectIntent(text);
  const body = T[lang][intent](site.endsWith('/') ? site : site + '/');
  return {
    lang, intent,
    handoff: HANDOFF.has(intent),
    text: body + '\n\n' + T[lang].footer
  };
}

/* ------------------------------------------------------------------ Meta plumbing */

const encoder = new TextEncoder();

function hexToBytes(hex) {
  if (!/^[0-9a-f]{64}$/i.test(hex)) return null;
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

// X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(raw request bytes, app secret). crypto.subtle.verify compares in constant time.
export async function verifySignature(rawBytes, header, appSecret) {
  if (!appSecret || !header || !header.startsWith('sha256=')) return false;
  const sig = hexToBytes(header.slice(7));
  if (!sig) return false;
  const key = await crypto.subtle.importKey('raw', encoder.encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('HMAC', key, sig, rawBytes);
}

export function* iterMessages(payload, expectedPhoneNumberId) {
  if (!payload || payload.object !== 'whatsapp_business_account') return;
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'messages') continue;
      const value = change.value || {};
      const pnid = value.metadata && value.metadata.phone_number_id;
      if (expectedPhoneNumberId && pnid && pnid !== expectedPhoneNumberId) continue;
      for (const m of value.messages || []) {
        yield { id: m.id, from: m.from, type: m.type, text: m.text && m.text.body ? m.text.body : '' };
      }
    }
  }
}

function graphUrl(env) {
  return 'https://graph.facebook.com/' + (env.GRAPH_VERSION || DEFAULTS.GRAPH_VERSION) + '/' + env.PHONE_NUMBER_ID + '/messages';
}

async function postGraph(env, body, fetchImpl) {
  const res = await fetchImpl(graphUrl(env), {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.WHATSAPP_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res;
}

// Free-form text. Only allowed inside the 24-hour window that opens when the customer writes to you.
export function sendText(env, to, text, fetchImpl = fetch) {
  return postGraph(env, { messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { preview_url: false, body: text } }, fetchImpl);
}

// Approved template. Needed to start a conversation or to write outside the 24-hour window (reminders). Not used by default.
export function sendTemplate(env, to, name, languageCode, bodyParams = [], fetchImpl = fetch) {
  const template = { name, language: { code: languageCode } };
  if (bodyParams.length) template.components = [{ type: 'body', parameters: bodyParams.map((t) => ({ type: 'text', text: String(t) })) }];
  return postGraph(env, { messaging_product: 'whatsapp', to, type: 'template', template }, fetchImpl);
}

async function seenBefore(env, id) {
  if (!env.SEEN || !id) return false;               // optional KV namespace binding named SEEN
  if (await env.SEEN.get(id)) return true;
  await env.SEEN.put(id, '1', { expirationTtl: 86400 });
  return false;
}

async function notifyHandoff(env, info, fetchImpl) {
  if (!env.HANDOFF_WEBHOOK_URL) return false;       // optional: any URL that accepts a JSON POST
  const res = await fetchImpl(env.HANDOFF_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(info) });
  return res.ok;
}

// Logs carry ids and intents only: no phone numbers, no message text (personal data).
function log(obj) { console.log(JSON.stringify(obj)); }

export async function processPayload(payload, env, fetchImpl = fetch) {
  const live = env.REPLIES_ENABLED === 'true';
  for (const m of iterMessages(payload, env.PHONE_NUMBER_ID)) {
    try {
      if (await seenBefore(env, m.id)) { log({ evt: 'duplicate', id: m.id }); continue; }
      const reply = buildReply(m.text, { type: m.type, siteUrl: env.SITE_URL });
      let sent = false;
      if (live) {
        const res = await sendText(env, m.from, reply.text, fetchImpl);
        sent = res.ok;
        if (!res.ok) log({ evt: 'send_failed', id: m.id, status: res.status });
      }
      let handed = false;
      if (reply.handoff) {
        handed = await notifyHandoff(env, { id: m.id, from: m.from, text: m.text, type: m.type, intent: reply.intent, at: new Date().toISOString() }, fetchImpl);
      }
      log({ evt: 'message', id: m.id, type: m.type, intent: reply.intent, lang: reply.lang, live, sent, handoff: reply.handoff, handoffSent: handed });
    } catch (err) {
      log({ evt: 'error', id: m.id, message: String(err && err.message ? err.message : err) });
    }
  }
}

/* ------------------------------------------------------------------ HTTP entry */

export default {
  async fetch(request, env, ctx, fetchImpl = fetch) {
    const url = new URL(request.url);

    if (url.pathname === '/' && request.method === 'GET') return new Response('ok', { status: 200 });
    if (url.pathname !== '/webhook') return new Response('Not found', { status: 404 });

    if (request.method === 'GET') {                 // Meta's one-time verification handshake
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      if (mode === 'subscribe' && env.VERIFY_TOKEN && token === env.VERIFY_TOKEN && challenge) {
        return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
      }
      return new Response('Forbidden', { status: 403 });
    }

    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, POST' } });

    const raw = await request.arrayBuffer();         // verify over the exact bytes, before any JSON parsing
    const ok = await verifySignature(raw, request.headers.get('X-Hub-Signature-256'), env.APP_SECRET);
    if (!ok) return new Response('Invalid signature', { status: 401 });

    let payload;
    try { payload = JSON.parse(new TextDecoder().decode(raw)); } catch { return new Response('Bad request', { status: 400 }); }

    const work = processPayload(payload, env, fetchImpl);
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(work); else await work;
    return new Response('EVENT_RECEIVED', { status: 200 });   // answer fast; Meta retries slow or failed deliveries
  }
};
