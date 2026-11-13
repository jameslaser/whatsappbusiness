// Phone numbers are stored as digits only, country code first (9665XXXXXXXX), which is what wa.me needs.

const ARABIC_DIGITS = /[٠-٩۰-۹]/g;

function asciiDigits(s) {
  return String(s || '').replace(ARABIC_DIGITS, (d) => String(d.charCodeAt(0) & 0x0f));
}

export function normalizePhone(input) {
  let s = asciiDigits(input).trim().replace(/[\s\-().]/g, '');
  if (!s) return null;
  if (s.startsWith('+')) s = s.slice(1);
  else if (s.startsWith('00')) s = s.slice(2);
  if (!/^\d+$/.test(s)) return null;

  if (/^05\d{8}$/.test(s)) s = '966' + s.slice(1);          // 0555123456 style (local Saudi mobile)
  else if (/^5\d{8}$/.test(s)) s = '966' + s;               // 555123456
  else if (/^9660\d{9}$/.test(s)) s = '966' + s.slice(4);   // 96605... (stray zero after the country code)

  return /^[1-9]\d{7,14}$/.test(s) ? s : null;
}

export function formatPhone(digits) {
  const s = String(digits || '');
  if (/^9665\d{8}$/.test(s)) return '+966 ' + s.slice(3, 5) + ' ' + s.slice(5, 8) + ' ' + s.slice(8);
  return s ? '+' + s : '';
}

export function waLink(digits, text) {
  return 'https://wa.me/' + digits + (text ? '?text=' + encodeURIComponent(text) : '');
}
