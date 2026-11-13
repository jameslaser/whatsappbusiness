import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone, formatPhone, waLink } from '../src/lib/phone.js';
import { riyadhYmd, addDaysYmd, toIsoRiyadh, splitRiyadh, fmtTime } from '../src/lib/dates.js';
import { lint, hasPlaceholders } from '../src/lib/lint.js';
import { render, unknownVars, areaNames, buildVars } from '../src/lib/templates.js';
import { offerState, spanDays, offerProblems, composeOffer, canReceiveOffers } from '../src/lib/offers.js';
import { computeDue } from '../src/lib/due.js';

test('phone: Saudi mobile formats become country code first', () => {
  assert.equal(normalizePhone('0557401562'), '966557401562');
  assert.equal(normalizePhone('557401562'), '966557401562');
  assert.equal(normalizePhone('+966 55 740 1562'), '966557401562');
  assert.equal(normalizePhone('00966557401562'), '966557401562');
  assert.equal(normalizePhone('٠٥٥٧٤٠١٥٦٢'), '966557401562');
  assert.equal(normalizePhone('+966 (0) 557401562'.replace('(0)', '0')), '966557401562');
  assert.equal(normalizePhone('+44 7700 900123'), '447700900123');
});
test('phone: rejects junk', () => {
  for (const bad of ['', '   ', 'abc', '123', '+0123456789', '12345678901234567890', null, undefined]) assert.equal(normalizePhone(bad), null, String(bad));
});
test('phone: format and link', () => {
  assert.equal(formatPhone('966557401562'), '+966 55 740 1562');
  assert.equal(waLink('966557401562', 'مرحبا & hi'), 'https://wa.me/966557401562?text=' + encodeURIComponent('مرحبا & hi'));
  assert.equal(waLink('966557401562'), 'https://wa.me/966557401562');
});

test('dates: Riyadh is UTC+3', () => {
  assert.equal(riyadhYmd(new Date('2026-11-13T21:30:00Z')), '2026-11-14'); // 00:30 next day in Riyadh
  assert.equal(riyadhYmd(new Date('2026-11-13T20:59:00Z')), '2026-11-13');
  assert.equal(addDaysYmd('2026-12-31', 1), '2027-01-01');
  assert.equal(addDaysYmd('2026-03-01', -1), '2026-02-28');
  assert.equal(toIsoRiyadh('2026-12-01', '17:30'), '2026-12-01T17:30:00+03:00');
  assert.deepEqual(splitRiyadh('2026-12-01T14:30:00Z'), { ymd: '2026-12-01', hm: '17:30' });
  assert.deepEqual(splitRiyadh(null), { ymd: '', hm: '' });
  assert.match(fmtTime('2026-12-01T14:30:00Z', 'en'), /5:30\s?PM/);
});

test('lint: catches banned claims in English', () => {
  for (const t of ['Permanent hair removal', 'painless laser', 'pain-free', 'Guaranteed results', 'we are the best', 'Our expert team', 'number one in Riyadh', 'hair gone forever', 'Specialist James'])
    assert.ok(lint(t).length > 0, t);
});
test('lint: catches banned claims in Arabic, with diacritics and prefixes', () => {
  for (const t of ['إزالة دائمة للشعر', 'ازالة نهائية', 'بدون ألم', 'بلا ألم', 'نتائج مضمونة', 'نضمن لك', 'أفضل عيادة', 'خبير ليزر', 'للأبد', 'الأخصائي جيمس', '\u062F\u064E\u0627\u0626\u0650\u0645\u064B\u0627'])
    assert.ok(lint(t).length > 0, t);
});
test('lint: allows honest risk wording and ordinary text', () => {
  assert.deepEqual(lint('Results vary and are not guaranteed.'), []);
  assert.deepEqual(lint('Results cannot be guaranteed. There is no guarantee.'), []);
  assert.deepEqual(lint('النتائج تختلف ولا تُضمن.'), []);
  assert.deepEqual(lint('Your appointment is at 5:30 PM. Please arrive 10 minutes early.'), []);
  assert.deepEqual(lint('موعدك يوم الثلاثاء الساعة 5 مساءً'), []);
  assert.deepEqual(lint('bestow the digest'), []);   // word boundaries
});
test('lint: placeholders', () => {
  assert.ok(hasPlaceholders('[تكتبها العيادة]'));
  assert.ok(hasPlaceholders('text [x]'));
  assert.ok(!hasPlaceholders('plain text (with brackets)'));
});

test('templates: render and unknown variables', () => {
  assert.equal(render('Hi {{name}} at {{ time }}', { name: 'Ali', time: '5 PM' }), 'Hi Ali at 5 PM');
  assert.equal(render('{{nope}}', {}), '{{nope}}');
  assert.deepEqual(unknownVars('{{name}} {{oops}} {{oops}}'), ['oops']);
});
test('templates: areas and vars', () => {
  const areas = [{ code: 'FACE-01', name_ar: 'خط اللحية', name_en: 'Beard line' }, { code: 'UPPER-01', name_ar: 'الإبطان', name_en: 'Underarms' }];
  assert.equal(areaNames(['FACE-01', 'UPPER-01', 'X'], areas, 'en'), 'Beard line, Underarms');
  assert.equal(areaNames(['FACE-01', 'UPPER-01'], areas, 'ar'), 'خط اللحية، الإبطان');
  const v = buildVars({ client: { full_name: 'Ali' }, appointment: { scheduled_at: '2026-12-01T14:30:00Z', area_codes: ['FACE-01'] }, areas }, 'en');
  assert.equal(v.name, 'Ali');
  assert.match(v.time, /5:30/);
  assert.equal(v.areas, 'Beard line');
  assert.equal(buildVars({ client: { full_name: 'Ali' }, areas }, 'en').date, '');
});

const offer = (o = {}) => ({ title_ar: 'عرض', title_en: 'Offer', body_ar: 'نص', body_en: 'Text', starts_on: '2026-11-01', ends_on: '2026-12-15', approval_number: 'RUH-123', status: 'approved', ...o });
test('offers: state', () => {
  assert.equal(offerState(offer({ status: 'draft' }), '2026-11-13'), 'draft');
  assert.equal(offerState(offer({ status: 'withdrawn' }), '2026-11-13'), 'withdrawn');
  assert.equal(offerState(offer(), '2026-10-31'), 'upcoming');
  assert.equal(offerState(offer(), '2026-11-01'), 'active');
  assert.equal(offerState(offer(), '2026-12-15'), 'active');
  assert.equal(offerState(offer(), '2026-12-16'), 'expired');
});
test('offers: 60-day rule is inclusive', () => {
  assert.equal(spanDays('2026-11-01', '2026-11-01'), 1);
  assert.equal(spanDays('2026-11-01', '2026-12-30'), 60);
  assert.deepEqual(offerProblems(offer({ ends_on: '2026-12-30' })), []);
  assert.deepEqual(offerProblems(offer({ ends_on: '2026-12-31' })), ['span']);
});
test('offers: problems', () => {
  assert.deepEqual(offerProblems(offer()), []);
  assert.ok(offerProblems(offer({ approval_number: ' ' })).includes('approval_number'));
  assert.ok(offerProblems(offer({ starts_on: null })).includes('dates'));
  assert.ok(offerProblems(offer({ ends_on: '2026-10-01' })).includes('order'));
  assert.ok(offerProblems(offer({ body_en: 'Permanent results' })).includes('lint'));
  assert.ok(offerProblems(offer({ body_ar: '[اكتب هنا]' })).includes('placeholder'));
  assert.ok(offerProblems(offer({ title_en: '' })).includes('text'));
});
test('offers: composed message is Arabic first, has approval number, dates, footer and stop line', () => {
  const m = composeOffer(offer());
  assert.ok(m.indexOf('عرض') < m.indexOf('Offer'));
  assert.ok(m.includes('RUH-123'));
  assert.ok(m.includes('إعلان') && m.includes('Advertisement'));
  assert.ok(m.includes('إيقاف') && m.includes('STOP'));
  assert.ok(m.includes('not guaranteed'));
  assert.deepEqual(lint(m.replace(/Specialist/g, '')), [], 'footer itself must pass the wording check');
});
test('offers: only opted-in, not opted-out clients can receive', () => {
  assert.equal(canReceiveOffers({ whatsapp_opt_in: true, opted_out_at: null }), true);
  assert.equal(canReceiveOffers({ whatsapp_opt_in: true, opted_out_at: '2026-01-01T00:00:00Z' }), false);
  assert.equal(canReceiveOffers({ whatsapp_opt_in: false, opted_out_at: null }), false);
});

test('due: reminders, pre, post and requests', () => {
  const now = new Date('2026-11-13T09:00:00Z');           // 12:00 Riyadh, Friday 13 Nov
  const clients = [{ id: 'c1' }, { id: 'c2' }];
  const mk = (id, status, iso, cid = 'c1') => ({ id, client_id: cid, status, scheduled_at: iso, created_at: '2026-11-01T00:00:00Z' });
  const appointments = [
    mk('today-late', 'confirmed', '2026-11-13T15:00:00Z'),
    mk('today-passed', 'confirmed', '2026-11-13T07:00:00Z'),
    mk('tomorrow', 'confirmed', '2026-11-14T12:00:00Z'),
    mk('in2', 'confirmed', '2026-11-15T12:00:00Z'),
    mk('in3', 'confirmed', '2026-11-16T12:00:00Z'),
    mk('done-yday', 'done', '2026-11-12T12:00:00Z'),
    mk('done-old', 'done', '2026-11-10T12:00:00Z'),
    mk('new1', 'new', null, 'c2'),
    mk('ghost', 'new', null, 'nobody')
  ];
  const log = [{ appointment_id: 'tomorrow', kind: 'reminder', status: 'sent' }, { appointment_id: 'done-yday', kind: 'post', status: 'prepared' }];
  const d = computeDue({ appointments, clients, log, now });
  assert.deepEqual(d.reminders.map((x) => x.appointment.id), ['today-late']);
  assert.deepEqual(d.pre.map((x) => x.appointment.id), ['today-late', 'tomorrow', 'in2']);
  assert.deepEqual(d.post.map((x) => x.appointment.id), ['done-yday']);   // 'prepared' is not 'sent'
  assert.deepEqual(d.requests.map((x) => x.appointment.id), ['new1']);
});
