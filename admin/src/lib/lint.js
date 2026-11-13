// Wording check for anything that could be sent to a client.
// It flags words the clinic's reading of the Ministry of Health advertising rules says to avoid:
// "permanent", "painless", "guaranteed", "best", "expert", "number one", and practitioner self-promotion.
// This is a safety net, not legal advice: the clinic's licensing contact makes the final call.

const MARKS = /[ً-ٰٟـ]/g;

export function norm(s) {
  return String(s || '')
    .replace(MARKS, '')
    .replace(/[أإآٱ]/g, 'ا')   // أ إ آ ٱ -> ا
    .replace(/ى/g, 'ي')                       // ى -> ي
    .replace(/ة/g, 'ه')                       // ة -> ه
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .toLowerCase();
}

// Arabic stems get optional common prefixes and endings, so "للأبد", "الدائمة" and "دائماً" are all caught.
const AR_PRE = '(?:و?ال|وبال|بال|لل|و|ب|ل|ف)?';
const AR_SUF = '(?:ا|ه|ات|ين|ون|ان|ها)?';
const L = '[\\p{L}\\p{N}]';

const EN = [
  'permanent(?:ly)?', 'painless(?:ly)?', 'pain[- ]?free', 'guarantee[sd]?', 'forever', 'lifetime',
  'never (?:grow|come) back', 'best', 'expert[s]?', 'number (?:one|1)', 'no\\.? ?1', '#1', 'specialist'
];
const AR = [
  'دايم',                               // دائم (after norm: دايم is a spelling; handled below)
  'دائم',                               // دائم
  'للابد',                         // للأبد
  'نهائي',                         // نهائي
  '(?:بدون|بلا|دون) الم',          // بدون ألم / بلا ألم / دون ألم (norm: الم)
  'مضمون',                         // مضمون
  'ضمان',                               // ضمان
  'نضمن',                               // نضمن
  'افضل',                               // أفضل
  'خبير',                               // خبير
  'خبراء',                         // خبراء
  'رقم (?:1|واحد)',      // رقم 1 / رقم واحد
  'اخصائي'                    // أخصائي (practitioner self-promotion)
];

const EN_RX = EN.map((t) => new RegExp('(?<!' + L + ')(?:' + t + ')(?!' + L + ')', 'giu'));
// "(?:ال)?الم" style alternatives already inside; others take prefix and suffix.
const AR_RX = AR.map((t) => new RegExp('(?<!' + L + ')' + AR_PRE + '(?:' + norm(t) + ')' + AR_SUF + '(?!' + L + ')', 'gu'));

// The honest risk wording is allowed: "not guaranteed", "cannot be guaranteed", "no guarantee", "results vary and are not guaranteed".
const ALLOWED = [
  /\b(?:are |is |be |can ?not be |can't be )?not (?:be )?guaranteed\b/gi,
  /\bcannot be guaranteed\b/gi,
  /\bno guarantees?\b/gi,
  /\bwithout guarantees?\b/gi
];

export function lint(text) {
  let t = String(text || '');
  for (const rx of ALLOWED) t = t.replace(rx, ' ');
  const n = norm(t);
  const hits = new Set();
  for (const rx of EN_RX) for (const m of n.matchAll(rx)) hits.add(m[0].trim());
  for (const rx of AR_RX) for (const m of n.matchAll(rx)) hits.add(m[0].trim());
  return [...hits];
}

// Bracket placeholders such as [the clinic writes this] mean the text is not finished.
export function hasPlaceholders(text) {
  return /[\[\]【】]/.test(String(text || ''));
}
