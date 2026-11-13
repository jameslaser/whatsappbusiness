// Offline tests: Graph API and handoff URL are mocked. Run: cd api/worker && npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import worker, {
  buildReply, detectIntent, normalize, verifySignature, iterMessages, sendTemplate
} from '../src/index.js';

const SECRET = 'app-secret-for-tests';
const baseEnv = {
  VERIFY_TOKEN: 'vt-123', APP_SECRET: SECRET, WHATSAPP_TOKEN: 'tok-abc', PHONE_NUMBER_ID: '111222333',
  REPLIES_ENABLED: 'true', GRAPH_VERSION: 'v22.0'
};

const sign = (body) => 'sha256=' + createHmac('sha256', SECRET).update(Buffer.from(body, 'utf8')).digest('hex');

function textPayload(text, { id = 'wamid.A1', from = '966500000000', type = 'text', pnid = '111222333' } = {}) {
  const msg = { from, id, timestamp: '1760000000', type };
  if (type === 'text') msg.text = { body: text };
  return {
    object: 'whatsapp_business_account',
    entry: [{ id: 'WABA', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { display_phone_number: '966500000000', phone_number_id: pnid }, contacts: [{ profile: { name: 'Test' }, wa_id: from }], messages: [msg] } }] }]
  };
}

function mockFetch() {
  const calls = [];
  const fn = async (url, init) => { calls.push({ url, init, body: init && init.body ? JSON.parse(init.body) : null }); return new Response('{}', { status: 200 }); };
  fn.calls = calls;
  return fn;
}

async function post(payloadObj, env = baseEnv, { signature, fetchImpl = mockFetch() } = {}) {
  const raw = JSON.stringify(payloadObj);
  const req = new Request('https://w.example/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': signature === undefined ? sign(raw) : signature }, body: raw });
  const pending = [];
  const res = await worker.fetch(req, env, { waitUntil: (p) => pending.push(p) }, fetchImpl);
  await Promise.all(pending);
  return { res, fetchImpl };
}

/* ---------- GET verification ---------- */

test('GET verification echoes the raw challenge', async () => {
  const res = await worker.fetch(new Request('https://w.example/webhook?hub.mode=subscribe&hub.verify_token=vt-123&hub.challenge=1158201444'), baseEnv, {});
  assert.equal(res.status, 200);
  assert.equal(await res.text(), '1158201444');
});

test('GET verification rejects a wrong token, wrong mode, or missing token config', async () => {
  const bad = await worker.fetch(new Request('https://w.example/webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=1'), baseEnv, {});
  assert.equal(bad.status, 403);
  const mode = await worker.fetch(new Request('https://w.example/webhook?hub.mode=other&hub.verify_token=vt-123&hub.challenge=1'), baseEnv, {});
  assert.equal(mode.status, 403);
  const unset = await worker.fetch(new Request('https://w.example/webhook?hub.mode=subscribe&hub.verify_token=undefined&hub.challenge=1'), { ...baseEnv, VERIFY_TOKEN: undefined }, {});
  assert.equal(unset.status, 403);
});

test('routes: health, 404, 405', async () => {
  assert.equal((await worker.fetch(new Request('https://w.example/'), baseEnv, {})).status, 200);
  assert.equal((await worker.fetch(new Request('https://w.example/x'), baseEnv, {})).status, 404);
  assert.equal((await worker.fetch(new Request('https://w.example/webhook', { method: 'PUT' }), baseEnv, {})).status, 405);
});

/* ---------- signature ---------- */

test('signature: valid, invalid, missing, malformed, and Arabic (multi-byte) bodies', async () => {
  const body = JSON.stringify({ text: 'السلام عليكم 👋' });
  const bytes = new TextEncoder().encode(body);
  assert.equal(await verifySignature(bytes, sign(body), SECRET), true);
  assert.equal(await verifySignature(bytes, sign(body + ' '), SECRET), false);
  assert.equal(await verifySignature(bytes, undefined, SECRET), false);
  assert.equal(await verifySignature(bytes, 'sha256=zzzz', SECRET), false);
  assert.equal(await verifySignature(bytes, sign(body), ''), false);
});

test('POST without a valid signature is rejected and nothing is sent', async () => {
  const { res, fetchImpl } = await post(textPayload('hello'), baseEnv, { signature: 'sha256=' + '0'.repeat(64) });
  assert.equal(res.status, 401);
  assert.equal(fetchImpl.calls.length, 0);
  const none = await post(textPayload('hello'), baseEnv, { signature: null });
  assert.equal(none.res.status, 401);
});

test('POST with no APP_SECRET configured is rejected (never skips verification)', async () => {
  const { res } = await post(textPayload('hello'), { ...baseEnv, APP_SECRET: undefined });
  assert.equal(res.status, 401);
});

test('invalid JSON with a valid signature returns 400', async () => {
  const raw = '{not json';
  const req = new Request('https://w.example/webhook', { method: 'POST', headers: { 'X-Hub-Signature-256': sign(raw) }, body: raw });
  assert.equal((await worker.fetch(req, baseEnv, {})).status, 400);
});

/* ---------- sending ---------- */

test('Arabic greeting sends one correctly shaped Graph API text message', async () => {
  const { res, fetchImpl } = await post(textPayload('السلام عليكم'));
  assert.equal(res.status, 200);
  assert.equal(fetchImpl.calls.length, 1);
  const c = fetchImpl.calls[0];
  assert.equal(c.url, 'https://graph.facebook.com/v22.0/111222333/messages');
  assert.equal(c.init.method, 'POST');
  assert.equal(c.init.headers.Authorization, 'Bearer tok-abc');
  assert.equal(c.body.messaging_product, 'whatsapp');
  assert.equal(c.body.to, '966500000000');
  assert.equal(c.body.type, 'text');
  assert.match(c.body.text.body, /أهلاً بك/);
  assert.match(c.body.text.body, /Harmony Derma/);
});

test('replies are OFF unless REPLIES_ENABLED is exactly "true"', async () => {
  for (const v of [undefined, 'false', 'TRUE', '1']) {
    const { res, fetchImpl } = await post(textPayload('hello'), { ...baseEnv, REPLIES_ENABLED: v });
    assert.equal(res.status, 200);
    assert.equal(fetchImpl.calls.length, 0, 'REPLIES_ENABLED=' + v);
  }
});

test('status webhooks, other fields and other phone numbers are ignored', async () => {
  const statuses = { object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: '111222333' }, statuses: [{ id: 'x', status: 'delivered' }] } }] }] };
  assert.equal((await post(statuses)).fetchImpl.calls.length, 0);
  const echoes = { object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'smb_message_echoes', value: { message_echoes: [{}] } }] }] };
  assert.equal((await post(echoes)).fetchImpl.calls.length, 0);
  assert.equal((await post(textPayload('hello', { pnid: '999' }))).fetchImpl.calls.length, 0);
  assert.equal((await post({ object: 'page', entry: [] })).fetchImpl.calls.length, 0);
});

test('Graph API failure does not crash the webhook', async () => {
  const failing = async () => new Response('{"error":{}}', { status: 400 });
  const { res } = await post(textPayload('hello'), baseEnv, { fetchImpl: failing });
  assert.equal(res.status, 200);
});

test('duplicate deliveries are skipped when the optional KV binding exists', async () => {
  const store = new Map();
  const SEEN = { get: async (k) => store.get(k) || null, put: async (k, v) => { store.set(k, v); } };
  const env = { ...baseEnv, SEEN };
  const first = await post(textPayload('hello', { id: 'wamid.DUP' }), env);
  const second = await post(textPayload('hello', { id: 'wamid.DUP' }), env);
  assert.equal(first.fetchImpl.calls.length, 1);
  assert.equal(second.fetchImpl.calls.length, 0);
});

test('non-text messages get the text-only notice and a handoff', async () => {
  const handoffs = [];
  const f = async (url, init) => { handoffs.push({ url, init }); return new Response('{}', { status: 200 }); };
  const env = { ...baseEnv, HANDOFF_WEBHOOK_URL: 'https://hook.example/h' };
  const { res } = await post(textPayload('', { type: 'image' }), env, { fetchImpl: f });
  assert.equal(res.status, 200);
  const graph = handoffs.find((c) => c.url.includes('graph.facebook.com'));
  const hook = handoffs.find((c) => c.url === 'https://hook.example/h');
  assert.ok(graph && hook);
  assert.match(JSON.parse(graph.init.body).text.body, /نصية|text/);
  assert.equal(JSON.parse(hook.init.body).intent, 'nontext');
});

test('logs contain ids and intents but never phone numbers or message text', async () => {
  const lines = [];
  const orig = console.log;
  console.log = (s) => lines.push(String(s));
  try { await post(textPayload('بكم الصدر؟ 0551234567', { from: '966511122233' })); } finally { console.log = orig; }
  const joined = lines.join('\n');
  assert.ok(lines.length > 0);
  assert.ok(!joined.includes('966511122233'));
  assert.ok(!joined.includes('0551234567'));
  assert.ok(!joined.includes('الصدر'));
});

/* ---------- intents and wording ---------- */

const cases = [
  ['السلام عليكم', 'menu'], ['مرحبا', 'menu'], ['hi', 'menu'], ['Hello there', 'menu'],
  ['1', 'areas'], ['١', 'areas'], ['2', 'hours'], ['3', 'where'], ['4', 'book'],
  ['ما هي مواعيد الدوام؟', 'hours'], ['what are your opening hours', 'hours'], ['are you open', 'hours'],
  ['وين موقعكم', 'where'], ['what is your address', 'where'], ['location please', 'where'],
  ['أبغى أحجز موعد', 'book'], ['I want to book an appointment', 'book'],
  ['كم سعر الصدر', 'price'], ['بكم الظهر', 'price'], ['how much is full legs', 'price'], ['any offers?', 'price'], ['عندكم عروض؟', 'price'],
  ['عندي حرق بعد الجلسة', 'safety'], ['I have a burn and swelling', 'safety'], ['فيه تورم وألم', 'safety'],
  ['ما هي المناطق اللي تعالجونها', 'areas'], ['what services do you offer', 'areas'], ['what do you offer', 'areas'],
  ['شكراً جزيلاً', 'fallback'], ['asdf', 'fallback'],
  ['سالم يسأل عن العالم', 'fallback']          // "الم" must not match inside "سالم" / "العالم"
];
for (const [text, want] of cases) {
  test('intent: ' + JSON.stringify(text) + ' -> ' + want, () => assert.equal(detectIntent(text), want));
}

test('safety outranks price and booking', () => {
  assert.equal(detectIntent('كم السعر وعندي حرق'), 'safety');
  assert.equal(detectIntent('book appointment I have a burn'), 'safety');
});

test('reply language follows the customer: Arabic text gets Arabic, others get English', () => {
  assert.equal(buildReply('مرحبا').lang, 'ar');
  assert.equal(buildReply('hello').lang, 'en');
});

test('wording rules: no prices, no outcome or superlative claims, no "permanent/guaranteed"', () => {
  const banned = /(\d+\s*(SAR|ريال|SR))|permanent|guarantee|painless|best|expert|specialist|number one|دائم|نهائي|مضمون|بدون ألم|أفضل|خبير|متخصص/i;
  const samples = ['السلام', 'hi', '1', 'one', '2', '3', '4', 'كم السعر', 'how much', 'حرق', 'burn', 'مرحبا اريد المناطق', 'xyz', 'زد'];
  for (const s of samples) {
    for (const type of ['text']) {
      const r = buildReply(s, { type });
      assert.ok(!banned.test(r.text), s + ' -> ' + r.text);
    }
  }
  assert.ok(!banned.test(buildReply('', { type: 'image' }).text));
});

test('handoff flags: price, safety, fallback, non-text yes; menu, hours, location, areas, booking no', () => {
  const flag = (t, o) => buildReply(t, o).handoff;
  assert.equal(flag('كم السعر'), true);
  assert.equal(flag('burn'), true);
  assert.equal(flag('xyz'), true);
  assert.equal(flag('', { type: 'audio' }), true);
  for (const t of ['hi', '1', '2', '3', '4']) assert.equal(flag(t), false, t);
});

test('every reply ends with the entity footer and includes hours where relevant', () => {
  for (const t of ['hi', '2', 'مرحبا', 'حرق']) {
    const r = buildReply(t);
    assert.match(r.text, /Harmony Derma/);
  }
  assert.match(buildReply('2').text, /1:00 PM – 10:00 PM/);
  assert.match(buildReply('٢ دوام').text, /1:00 ظهراً – 10:00 مساءً/);
});

test('normalize handles hamza, alef maqsura, ta marbuta, diacritics and Arabic digits', () => {
  assert.equal(normalize('أَسْعَار'), 'اسعار');
  assert.equal(normalize('موعـد'), 'موعد');
  assert.equal(normalize('على ٣'), 'علي 3');
  assert.equal(normalize('خدمة'), 'خدمه');
});

test('iterMessages yields text messages only from our phone number id', () => {
  const list = [...iterMessages(textPayload('hello'), '111222333')];
  assert.equal(list.length, 1);
  assert.deepEqual(list[0], { id: 'wamid.A1', from: '966500000000', type: 'text', text: 'hello' });
  assert.equal([...iterMessages(textPayload('hello'), 'other')].length, 0);
});

test('sendTemplate builds the documented template payload (not used by default)', async () => {
  const f = mockFetch();
  await sendTemplate(baseEnv, '966500000000', 'appointment_reminder', 'ar', ['السبت', '5:00 م'], f);
  const b = f.calls[0].body;
  assert.equal(b.type, 'template');
  assert.equal(b.template.name, 'appointment_reminder');
  assert.equal(b.template.language.code, 'ar');
  assert.deepEqual(b.template.components[0].parameters, [{ type: 'text', text: 'السبت' }, { type: 'text', text: '5:00 م' }]);
});
