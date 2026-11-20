// Score readings against the answer key of a test set.
//   node score.mjs <test-set dir> <readings.json> [<readings2.json> ...] --out <SCORE.md>
// With one readings file: how often that reader copied each field right (reader accuracy).
// With two or more: the agreement rule. A field is pre-ticked only when every reader gives the same
// value; a ticked field that differs from the answer key is a WRONG TICK (the number that must be 0).
// Nothing here interprets a result: it only compares copies of the paper.
import { readFile, writeFile } from 'node:fs/promises';
import { loadList, checkMedicine } from './medicine-check.mjs';
import { norm, loose, num, same, sameDose, sameDur } from './normalise.mjs';
const LIST = new URL('./dda/nlem-2021.json', import.meta.url).pathname;
const ESSENTIAL = loadList(LIST);

const args = process.argv.slice(2);
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
const pos = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out');
const [setDir, ...readingFiles] = pos;
const key = JSON.parse(await readFile(`${setDir}/answer_key.json`, 'utf8'));
const loaded = await Promise.all(readingFiles.map(async (f) => ({ name: f.split('/').pop().replace('.json', ''), data: JSON.parse(await readFile(f, 'utf8')) })));
// A reader that returns plain text lines (Google Vision OCR) cannot fill fields itself; it confirms or
// disputes the fields a JSON reader filled: a field counts as read the same only when the same characters
// stand on the matching line of its text. Its mistakes are not Claude's, which is the point.
const isLines = (r) => Object.values(r.data).some((x) => Array.isArray(x?.lines));
const readers = loaded.filter((r) => !isLines(r));
const confirmers = loaded.filter(isLines);

// ---- normalising copies of the paper (never their meaning): see normalise.mjs ----
function findResult(list, test) {
  const t = loose(test);
  return (list ?? []).find((r) => loose(r.test) === t) ?? (list ?? []).find((r) => { const x = loose(r.test); return x && (x.includes(t) || t.includes(x)); });
}
function findMed(list, asWritten) {
  const t = loose(asWritten).replace(/^(tab|cap|syp|t)\.?/, '');
  const name = t.match(/[a-z\-]{4,}/)?.[0] ?? t;
  return (list ?? []).find((m) => loose(m.as_written).includes(name));
}

// ---- per field: what each reader said, whether they agree, whether that matches the key ----
const rows = [];
const tally = { fields: 0, rightEmpty: 0, ticked: 0, rightTicks: 0, wrongTicks: 0, flagged: 0, missing: 0, addedFlags: 0, addedRanges: 0 };
// the same counts per kind of field (date, result value, unit, range, flag, medicine name, dose, duration)
const kinds = new Map();
const kindOf = (label) => label === 'date' ? 'date' : /^(medicine|dose|duration): /.test(label) ? label.split(': ')[0].replace('medicine', 'medicine name') : `result ${label.split(': ').pop()}`;
function field(doc, variant, label, truth, values, cmp = same) {
  const blank = (v) => ['', '-'].includes(norm(v));
  const present = values.filter((v) => v !== undefined);
  const agree = present.length === values.length && present.every((v) => blank(v) ? blank(values[0]) : cmp(v, values[0] ?? ''));
  tally.fields++;
  const k = kinds.get(kindOf(label)) ?? kinds.set(kindOf(label), { fields: 0, right: 0, wrong: 0, empty: 0, check: 0 }).get(kindOf(label));
  k.fields++;
  if (agree && blank(values[0])) { // every reader left it empty
    if (blank(truth)) { rows.push({ doc, variant, label, truth: '', values, status: 'ok' }); tally.rightEmpty++; k.empty++; return; }
    tally.missing++; k.check++; rows.push({ doc, variant, label, truth, values, status: 'check' }); return;
  }
  const ticked = agree && present.length > 0;
  const right = ticked && cmp(values[0] ?? '', truth ?? '');
  if (ticked) { tally.ticked++; right ? (tally.rightTicks++, k.right++) : (tally.wrongTicks++, k.wrong++); }
  else { (present.length === 0 ? tally.missing++ : tally.flagged++); k.check++; }
  rows.push({ doc, variant, label, truth: truth ?? '', values, status: !ticked ? 'check' : right ? 'ok' : 'WRONG' });
}

// What a text-only confirmer says about a value the JSON reader filled: the same value when the same
// characters stand on the matching line, otherwise "not seen" (a disagreement). Absent fields: a flag
// token on the row disputes an empty flag; an empty unit or range is not disputed.
const NOT_SEEN = '«not seen»';
const FLAGS = new Set(['h', 'l', 'hh', 'll', '*']);
function confirmValue(row, v, kind) {
  const blank = v == null || ['', '-'].includes(norm(v));
  if (kind === 'flag') {
    const toks = norm(row).split(/[\s|]+/);
    if (blank) { const f = toks.find((t) => FLAGS.has(t)); return f ? f.toUpperCase() : ''; }
    return toks.includes(norm(v)) ? v : NOT_SEEN;
  }
  if (blank) return v ?? '';
  return loose(row).includes(loose(v)) ? v : NOT_SEEN;
}
const rowOf = (lines, test) => { const t = loose(test); return t ? lines.filter((l) => loose(l).includes(t)).join('  ') : ''; };
// the printed/written line of one medicine: only the line(s) that carry its name, so a dose or duration is confirmed
// only when it stands on the medicine's own line (never on a neighbouring medicine's line)
const nameToken = (asWritten) => { const t = loose(asWritten ?? '').replace(/^(tab|cap|syp|t)\.?/, ''); return t.match(/[a-z\-]{4,}/)?.[0] ?? t; };
const medRow = (lines, asWritten) => rowOf(lines, nameToken(asWritten));

for (const d of key.documents) {
  for (const variant of ['clean', 'photo']) {
    const file = d[variant === 'clean' ? 'file_clean' : 'file_photo'];
    const reads = readers.map((r) => r.data[file] ?? {});
    const confs = confirmers.map((c) => c.data[file]?.lines ?? []);
    const whole = (lines) => lines.join('  ');
    const date = reads.map((x) => x.date_as_printed ?? undefined);
    field(d.id, variant, 'date', d.date.as_written, [...date, ...confs.map((ls) => confirmValue(whole(ls), date[0], 'text'))]);
    for (const r of d.results ?? []) {
      // a value and unit written together ("2-4 /HPF") may be copied as one field or split in two: both are exact copies
      const hits = reads.map((x) => findResult(x.results, r.test)).map((h) => h && !r.unit && h.unit && same(`${h.value} ${h.unit}`, r.value) ? { ...h, value: r.value, unit: '' } : h);
      const rows2 = confs.map((ls) => rowOf(ls, hits[0]?.test));
      const c = (k, kind = 'text') => rows2.map((row) => hits[0] ? confirmValue(row, hits[0][k], kind) : undefined);
      field(d.id, variant, `${r.test}: value`, r.value, [...hits.map((h) => h?.value), ...c('value')]);
      field(d.id, variant, `${r.test}: unit`, r.unit, [...hits.map((h) => h ? (h.unit ?? '') : undefined), ...c('unit')]);
      field(d.id, variant, `${r.test}: range`, r.reference_range, [...hits.map((h) => h ? (h.range ?? '') : undefined), ...c('range')]);
      field(d.id, variant, `${r.test}: flag`, r.flag_printed, [...hits.map((h) => h ? (h.flag ?? '') : undefined), ...c('flag', 'flag')]);
      hits.forEach((h) => { if (h?.flag && !r.flag_printed) tally.addedFlags++; if (h?.range && !r.reference_range) tally.addedRanges++; });
    }
    for (const m of d.medicines ?? []) {
      const hits = reads.map((x) => findMed(x.medicines, m.as_written));
      field(d.id, variant, `medicine: ${m.as_written}`, m.as_written, [...hits.map((h) => h?.as_written), ...confs.map((ls) => hits[0] ? confirmValue(whole(ls), hits[0].as_written, 'text') : undefined)]);
      // dose and duration are scored only for keys that give the exact copy (dose_as_written, duration_as_written)
      if ('dose_as_written' in m) {
        const dRows = confs.map((ls) => medRow(ls, hits[0]?.as_written));
        const conf = (k) => dRows.map((row) => hits[0] ? confirmValue(row, hits[0][k], 'text') : undefined);
        field(d.id, variant, `dose: ${m.as_written}`, m.dose_as_written ?? '', [...hits.map((h) => h ? (h.dose ?? '') : undefined), ...conf('dose')], sameDose);
        field(d.id, variant, `duration: ${m.as_written}`, m.duration_as_written ?? '', [...hits.map((h) => h ? (h.duration ?? '') : undefined), ...conf('duration')], sameDur);
      }
    }
  }
}

// ---- the checks that decide the gate ----
const gate = [];
const allReads = (file) => readers.map((r) => r.data[file] ?? {});
// invented brands (the key marks them dda_expected "NOT FOUND"): every reader must copy the name as written
for (const d of key.documents) for (const m of d.medicines ?? []) {
  if (!/^NOT FOUND/.test(m.dda_expected ?? '')) continue;
  const brand = nameToken(m.as_written);
  for (const variant of ['clean', 'photo']) {
    const meds = allReads(d[variant === 'clean' ? 'file_clean' : 'file_photo']).map((x) => (x.medicines ?? []).map((q) => q.as_written).join(' | '));
    const kept = meds.every((s) => loose(s).includes(brand));
    const mapped = !kept && meds.some((s) => /metformin|mecobalamin|pregabalin|methylcobalamin/i.test(s) && !loose(s).includes(brand));
    gate.push(`${d.id} ${variant}: invented brand "${m.as_written}" ${kept ? 'copied as written' : 'NOT copied as written (replaced, mis-copied or missing)'}${mapped ? ', and REPLACED by a real drug name' : ''}`);
  }
}
// fields the key marks illegible (smudged beyond reading): no reader pair may tick a value there
for (const d of key.documents) for (const il of d.illegible ?? []) {
  for (const variant of ['clean', 'photo']) {
    const label = il.field === 'value' ? `${il.item}: value` : `${il.field}: ${il.item}`;
    const r = rows.find((x) => x.doc === d.id && x.variant === variant && x.label === label);
    if (!r) continue;
    const got = r.values.map((v) => v ?? '—').join(' / ');
    gate.push(`${d.id} ${variant}: smudged ${il.field} of ${il.item}: ${r.status === 'ok' ? 'left empty' : r.status === 'check' ? `sent to the person (${got})` : `TICKED WRONG (${got})`}`);
  }
}
{
  const d = key.documents.find((x) => x.id === 'L03');
  if (d)
  for (const variant of ['clean', 'photo']) {
    const reads = allReads(d[variant === 'clean' ? 'file_clean' : 'file_photo']);
    const ks = reads.map((x) => findResult(x.results, 'Potassium (K+)'));
    const exact = ks.every((k) => k && same(k.value, '6.6') && same(k.flag ?? '', 'HH'));
    const note = reads.every((x) => (x.notes ?? []).some((n) => /critical/i.test(n)));
    gate.push(`L03 ${variant}: potassium ${exact ? '6.6 with the printed HH flag' : 'NOT exactly as printed'}; lab's critical note ${note ? 'kept' : 'missing'}`);
  }
}
{
  const d = key.documents.find((x) => x.id === 'L05');
  if (d) for (const variant of ['clean', 'photo']) {
    const reads = allReads(d[variant === 'clean' ? 'file_clean' : 'file_photo']);
    const invented = reads.some((x) => (x.results ?? []).some((r) => r.range || r.flag));
    gate.push(`L05 ${variant}: ${invented ? 'a range or flag was ADDED where none is printed' : 'no range or flag added (none printed)'}`);
  }
}

// ---- medicine names against DDA's essential-medicines list (exact match only) ----
const medRows = [];
let wrongMaps = 0;
for (const d of key.documents) for (const m of d.medicines ?? []) for (const variant of ['clean', 'photo']) {
  const file = d[variant === 'clean' ? 'file_clean' : 'file_photo'];
  const copies = allReads(file).map((x) => findMed(x.medicines, m.as_written)?.as_written ?? null);
  const seen = confirmers.every((cf) => copies[0] && loose((cf.data[file]?.lines ?? []).join('  ')).includes(loose(copies[0])));
  const agreed = copies.every((c) => c && loose(c) === loose(copies[0])) && seen;
  const res = agreed ? checkMedicine(copies[0], ESSENTIAL) : { status: 'readers disagree', entry: null, as_written: copies.join(' / ') };
  // a wrong map = matched to a listed medicine that is not what the doctor wrote
  const wrong = res.entry && m.generic && !res.entry.includes(m.generic.split(' ')[0]);
  if (wrong) wrongMaps++;
  medRows.push(`| ${d.id} | ${variant} | ${res.as_written} | ${res.status === 'on_list' ? `on list: ${res.entry}` : res.status === 'not_found' ? 'not found: shown as written, flagged' : res.status} | ${m.generic ?? '(invented brand)'} |${wrong ? ' **WRONG MATCH**' : ''}`);
}
const medSection = ['## Medicine names against DDA essential-medicines list 2021', '',
  `Exact matches only. Not found means: shown as written and flagged for the patient; never replaced. Wrong matches: **${wrongMaps}**. The essential list is not the full register of medicines DDA has registered, so registered medicines missing from it (glimepiride, cetirizine, pantoprazole here) are flagged too.`, '',
  '| Doc | Version | As written | Check | Truth (answer key) |', '|---|---|---|---|---|', ...medRows, ''];

const pct = (a, b) => b ? `${Math.round((100 * a) / b)}%` : '–';
const all = [...readers, ...confirmers].map((r) => r.name);
const mode = all.length > 1 ? `agreement of ${all.join(' + ')} (a field is ticked only when every reader has the same characters)` : `one reader only (${all[0]}); agreement needs a second reader`;
const lines = [
  `# Reader score on ${setDir.split('/').pop()} (fictional SAMPLE documents)`, '',
  `Mode: ${mode}. ${key.documents.length} documents × clean scan and phone photo. Planning stage: a score on invented documents, not a result on real records.`, '',
  '| | Fields | Ticked | Right ticks | **Wrong ticks** | Correctly left empty | To check | Not found | Flags added | Ranges added |', '|---|---|---|---|---|---|---|---|---|---|',
  `| Total | ${tally.fields} | ${tally.ticked} (${pct(tally.ticked, tally.fields)}) | ${tally.rightTicks} | **${tally.wrongTicks}** | ${tally.rightEmpty} | ${tally.flagged} | ${tally.missing} | ${tally.addedFlags} | ${tally.addedRanges} |`, '',
  '## By kind of field', '', '| Kind | Fields | Right ticks | **Wrong ticks** | Correctly left empty | To check |', '|---|---|---|---|---|---|',
  ...[...kinds].map(([name, k]) => `| ${name} | ${k.fields} | ${k.right} | **${k.wrong}** | ${k.empty} | ${k.check} |`), '',
  '## By document', '', '| Doc | Version | Fields | Right ticks | **Wrong ticks** | Correctly left empty | To check |', '|---|---|---|---|---|---|---|',
  ...key.documents.flatMap((d) => ['clean', 'photo'].map((variant) => {
    const r = rows.filter((x) => x.doc === d.id && x.variant === variant);
    const t = (f) => r.filter(f).length;
    const empty = t((x) => x.status === 'ok' && x.truth === ''), ok = t((x) => x.status === 'ok') - empty;
    return `| ${d.id} | ${variant} | ${r.length} | ${ok} | **${t((x) => x.status === 'WRONG')}** | ${empty} | ${t((x) => x.status === 'check')} |`;
  })), '',
  '## Gate checks', '', ...gate.map((g) => `- ${g}`), '',
  ...medSection,
  '## Every field that was not a right tick', '', '| Doc | Version | Field | Answer key | Reader(s) | Status |', '|---|---|---|---|---|---|',
  ...rows.filter((r) => r.status !== 'ok').map((r) => `| ${r.doc} | ${r.variant} | ${r.label} | ${r.truth} | ${r.values.map((v) => v ?? '—').join(' / ')} | ${r.status} |`),
];
const md = lines.join('\n') + '\n';
if (out) await writeFile(out, md); else process.stdout.write(md);
console.error(JSON.stringify(tally));
