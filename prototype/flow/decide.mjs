// Decides, for one page, what the app does with each field, WITHOUT the answer key:
// both readers (Claude Opus copy + Vision lines) agree -> pre-filled; a date or a value with a decimal
// point -> must be confirmed by the patient; anything else -> "Unresolved. Original document available." (never blank, never guessed).
// Same rules as reader/score.mjs (copied here because score.mjs only runs as a script); compare with SCORE.md.
import { readFileSync } from 'node:fs';
import { norm, loose, same, mustConfirmValue } from '../../reader/normalise.mjs';
import { valueRegion, rangeRegion, dateRegion } from '../../reader/regions.mjs';
const S = 'samples/test-set-v3/readings/';
const W = JSON.parse(readFileSync(S + 'google-vision-words.json', 'utf8'));
const O = JSON.parse(readFileSync(S + 'claude-opus-5-5.json', 'utf8'));
const V = JSON.parse(readFileSync(S + 'google-vision.json', 'utf8'));
const NOT_SEEN = '«not seen»', FLAGS = new Set(['h', 'l', 'hh', 'll', '*']);
const blank = (v) => v == null || ['', '-'].includes(norm(v));
const rowOf = (lines, test) => { const t = loose(test); return t ? lines.filter((l) => loose(l).includes(t)).join('  ') : ''; };
function confirmValue(row, v, kind) {
  if (kind === 'flag') { const toks = norm(row).split(/[\s|]+/); if (blank(v)) { const f = toks.find((t) => FLAGS.has(t)); return f ? f.toUpperCase() : ''; } return toks.includes(norm(v)) ? v : NOT_SEEN; }
  if (blank(v)) return v ?? '';
  return loose(row).includes(loose(v)) ? v : NOT_SEEN;
}
function decide(values, mustConfirm) {
  const agree = values.every((v) => blank(v) ? blank(values[0]) : same(v, values[0] ?? ''));
  if (agree && blank(values[0])) return 'blank';
  if (!agree) return 'check';
  return mustConfirm ? 'confirm' : 'ticked';
}
export function pageFields(file) {
  const o = O[file] ?? {}, lines = V[file]?.lines ?? [], words = W[file].words;
  const res = { file, date: { state: 'type', region: dateRegion(words) }, tests: [] };
  for (const r of o.results ?? []) {
    const row = rowOf(lines, r.test);
    const must = mustConfirmValue(r.value, r.range);
    const f = (k, kind = 'text') => ({ reading: r[k] ?? '', state: decide([r[k] ?? '', confirmValue(row, r[k], kind)], k === 'value' && must) });
    res.tests.push({ test: r.test, value: f('value'), unit: f('unit'), range: f('range'), flag: f('flag', 'flag'), vregion: valueRegion(words, r.test, r.value), rregion: rangeRegion(words, r.test) });
  }
  return res;
}
if (process.argv[2]) console.log(JSON.stringify(process.argv.slice(2).map(pageFields)));
