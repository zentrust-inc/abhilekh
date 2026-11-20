// Normalising copies of the paper (never their meaning). Used by score.mjs and tested in test/normalise.test.mjs.
export const DEV = '०१२३४५६७८९';
export const ascii = (s) => s.replace(/[०-९]/g, (c) => String(DEV.indexOf(c)));
export const norm = (s) => s == null ? '' : ascii(String(s)).normalize('NFKC').toLowerCase()
  .replace(/[–—−]/g, '-').replace(/μ/g, 'µ').replace(/\s+/g, ' ').replace(/\s*-\s*/g, '-').replace(/\s*([<>])\s*/g, '$1').replace(/^—$/, '').trim();
export const loose = (s) => norm(s).replace(/[^\p{L}\p{N}%µ<>.\-]/gu, '');
export const num = (s) => { const t = norm(s).replace(/,/g, ''); return /^-?\d+(\.\d+)?$/.test(t) ? +t : null; };
export const same = (a, b) => { const na = num(a), nb = num(b); return na !== null && nb !== null ? na === nb : loose(a) === loose(b); };
// Dose: the characters of the dose as written ("1 - 0 - 1" = "1-0-1"; "TDS (3 times a day)" = "TDS"). Never "TDS" = "1-1-1":
// those are different copies of the paper and a reader that rewrites one into the other has interpreted it.
export const doseOf = (s) => loose(String(s ?? '').replace(/\(.*?\)/g, ''));
export const sameDose = (a, b) => doseOf(a) === doseOf(b);
// Duration: the number and the unit, with the unit's usual spellings read as one ("5 d" = "5 days" = "5 दिन";
// "2 mo" = "2 months"; a leading "x" or "for" is not part of the duration). The number must be the same.
export const UNITS = [['days', 'd'], ['day', 'd'], ['दिन', 'd'], ['d', 'd'], ['weeks', 'w'], ['week', 'w'], ['wks', 'w'], ['wk', 'w'], ['w', 'w'],
  ['months', 'm'], ['month', 'm'], ['mos', 'm'], ['mo', 'm'], ['m', 'm']];
export const durOf = (s) => {
  const t = norm(s).replace(/^(x|×|for)\s*/, '');
  const m = t.match(/^(\d+(?:\.\d+)?)\s*([\p{L}\p{M}]+)?\s*$/u);
  if (!m) return loose(t);
  const u = UNITS.find(([w]) => w === m[2]);
  return `${+m[1]}${u ? u[1] : (m[2] ?? '')}`;
};
export const sameDur = (a, b) => durOf(a) === durOf(b);

// Dose confirmation by a text-only reader (Google Vision), for doses written as digits in slots ("1-0-1", "1 + 0 + 1").
// OCR often loses or merges the dashes ("1-01", "1-00", "100", "10-0") but keeps the digits. So a numeric dose is
// confirmed when a standalone group of digits on the medicine's own line has the same digits in the same order as the
// dose being confirmed; dashes, spaces and "+" between digits do not matter. Nothing else changes:
//  - the digits must be the same, in the same order ("0-04" does not confirm "0-0-1"; "2-0-2" does not confirm "1-0-1");
//  - a group stuck to letters ("100d", "x3days", "650m") or followed by a strength or duration unit ("500 mg", "5 d")
//    is a strength or a duration, not a dose, and a group after "x" / "for" is a duration;
//  - a dose that is not digits in slots ("SOS", "TDS", "0.5-0-0.5") is not handled here and keeps the strict rule.
export const doseSlots = (s) => {
  const t = norm(String(s ?? '').replace(/\(.*?\)/g, '')).replace(/\s+/g, '');
  return /^\d+(?:[-+]\d+)+$/.test(t) ? t.replace(/\D/g, '') : null;
};
const UNIT_AFTER = /^\s+(?:mg|mcg|µg|ug|g|ml|iu|%|d|days?|wks?|weeks?|mos?|months?|दिन)(?![\p{L}\p{M}])/iu;
export const confirmsDose = (row, dose) => {
  const want = doseSlots(dose);
  if (want === null) return false;
  const text = ascii(String(row ?? '')).replace(/[–—−]/g, '-');
  for (const m of text.matchAll(/\d[\d\s+-]*/g)) {
    const group = m[0].replace(/[\s+-]+$/, '');
    const before = text.slice(0, m.index), after = text.slice(m.index + group.length);
    if (/[\p{L}\p{M}\d.]$/u.test(before)) continue;           // stuck to a word or a decimal: not a dose
    if (/(?:^|\s)(?:x|×|for)\s*$/i.test(before)) continue;   // after "x" / "for": a duration
    if (/^[\p{L}\p{M}%µ]/u.test(after) || UNIT_AFTER.test(after)) continue; // a strength or a duration
    if (group.replace(/\D/g, '') === want) return true;
  }
  return false;
};
