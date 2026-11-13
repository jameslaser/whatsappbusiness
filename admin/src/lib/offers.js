import { LEGAL_FOOTER } from '../config.js';
import { fmtYmd } from './dates.js';
import { lint, hasPlaceholders } from './lint.js';

// Rules from the clinic's reading of the MoH advertising annex: regional approval, at most 60 days, approval number shown.
// The database enforces the same rules; this explains them in the app before a save fails.

export function offerState(o, today) {
  if (o.status === 'withdrawn') return 'withdrawn';
  if (o.status !== 'approved') return 'draft';
  if (today < o.starts_on) return 'upcoming';
  if (today > o.ends_on) return 'expired';
  return 'active';
}

export function spanDays(from, to) {
  if (!from || !to) return null;
  const a = Date.UTC(...from.split('-').map((n, i) => (i === 1 ? Number(n) - 1 : Number(n))));
  const b = Date.UTC(...to.split('-').map((n, i) => (i === 1 ? Number(n) - 1 : Number(n))));
  return Math.round((b - a) / 86400000) + 1;
}

export function offerLint(o) {
  return [...new Set([o.title_ar, o.title_en, o.body_ar, o.body_en].flatMap((t) => lint(t)))];
}

// Returns a list of problem codes. An offer can be approved only when this list is empty.
export function offerProblems(o) {
  const p = [];
  for (const k of ['title_ar', 'title_en', 'body_ar', 'body_en']) if (!String(o[k] || '').trim()) { p.push('text'); break; }
  if (!String(o.approval_number || '').trim()) p.push('approval_number');
  if (!o.starts_on || !o.ends_on) p.push('dates');
  else if (o.ends_on < o.starts_on) p.push('order');
  else if (spanDays(o.starts_on, o.ends_on) > 60) p.push('span');
  if (offerLint(o).length) p.push('lint');
  if ([o.title_ar, o.title_en, o.body_ar, o.body_en].some(hasPlaceholders)) p.push('placeholder');
  return p;
}

// One bilingual message, Arabic first: title, body, approval number, validity, footer, stop line.
export function composeOffer(o) {
  const lines = (title, body, lang) => {
    const approval = lang === 'ar' ? 'رقم الموافقة' : 'Approval no.';
    const valid = lang === 'ar' ? 'ساري من' : 'Valid';
    const to = lang === 'ar' ? 'إلى' : 'to';
    return [
      title, '', body, '',
      approval + ': ' + o.approval_number,
      valid + ' ' + fmtYmd(o.starts_on, lang) + ' ' + to + ' ' + fmtYmd(o.ends_on, lang)
    ].join('\n');
  };
  return [
    lines(o.title_ar, o.body_ar, 'ar'),
    '———',
    lines(o.title_en, o.body_en, 'en'),
    '',
    LEGAL_FOOTER.ar,
    '',
    LEGAL_FOOTER.en,
    '',
    LEGAL_FOOTER.stop
  ].join('\n');
}

export function canReceiveOffers(c) {
  return Boolean(c.whatsapp_opt_in) && !c.opted_out_at;
}
