// All clinic dates are Riyadh time (UTC+3, no daylight saving).
const TZ = 'Asia/Riyadh';

export function riyadhYmd(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function addDaysYmd(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function toIsoRiyadh(ymd, hm) {
  return ymd + 'T' + hm + ':00+03:00';
}

export function splitRiyadh(iso) {
  if (!iso) return { ymd: '', hm: '' };
  const d = new Date(iso);
  const hm = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
  return { ymd: riyadhYmd(d), hm };
}

export function fmtDate(iso, lang) {
  if (!iso) return '';
  const loc = lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB';
  return new Intl.DateTimeFormat(loc, { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}

export function fmtTime(iso, lang) {
  if (!iso) return '';
  const loc = lang === 'ar' ? 'ar-SA-u-nu-latn' : 'en-US';
  return new Intl.DateTimeFormat(loc, { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso));
}

export function fmtYmd(ymd, lang) {           // a plain date such as an offer's start day
  if (!ymd) return '';
  return fmtDate(ymd + 'T12:00:00+03:00', lang);
}

export function fmtShort(iso, lang) {
  if (!iso) return '';
  const loc = lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB';
  return new Intl.DateTimeFormat(loc, { timeZone: TZ, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(iso));
}
