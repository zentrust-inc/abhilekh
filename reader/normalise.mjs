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

