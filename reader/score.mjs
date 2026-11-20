// Score readings against the answer key of a test set.
//   node score.mjs <test-set dir> <readings.json> [<readings2.json> ...] --out <SCORE.md>
// With one readings file: how often that reader copied each field right (reader accuracy).
// With two or more: the agreement rule. A field is pre-ticked only when every reader gives the same
// value; a ticked field that differs from the answer key is a WRONG TICK (the number that must be 0).
// Nothing here interprets a result: it only compares copies of the paper.
import { readFile, writeFile } from 'node:fs/promises';
import { loadList, checkMedicine } from './medicine-check.mjs';
const LIST = new URL('./dda/nlem-2021.json', import.meta.url).pathname;
const ESSENTIAL = loadList(LIST);

const args = process.argv.slice(2);
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
const pos = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out');
const [setDir, ...readingFiles] = pos;
const key = JSON.parse(await readFile(`${setDir}/answer_key.json`, 'utf8'));
const readers = await Promise.all(readingFiles.map(async (f) => ({ name: f.split('/').pop().replace('.json', ''), data: JSON.parse(await readFile(f, 'utf8')) })));

// ---- normalising copies of the paper (never their meaning) ----
const DEV = '०१२३४५६७८९';
const ascii = (s) => s.replace(/[०-९]/g, (c) => String(DEV.indexOf(c)));
const norm = (s) => s == null ? '' : ascii(String(s)).normalize('NFKC').toLowerCase()
  .replace(/[–—−]/g, '-').replace(/μ/g, 'µ').replace(/\s+/g, ' ').replace(/\s*-\s*/g, '-').replace(/\s*([<>])\s*/g, '$1').replace(/^—$/, '').trim();
const loose = (s) => norm(s).replace(/[^\p{L}\p{N}%µ<>.\-]/gu, '');
const num = (s) => { const t = norm(s).replace(/,/g, ''); return /^-?\d+(\.\d+)?$/.test(t) ? +t : null; };
const same = (a, b) => { const na = num(a), nb = num(b); return na !== null && nb !== null ? na === nb : loose(a) === loose(b); };

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
function field(doc, variant, label, truth, values) {
  const blank = (v) => ['', '-'].includes(norm(v));
  const present = values.filter((v) => v !== undefined);
  const agree = present.length === values.length && present.every((v) => blank(v) ? blank(values[0]) : same(v, values[0] ?? ''));
  tally.fields++;
  if (agree && blank(values[0])) { // every reader left it empty
    if (blank(truth)) { rows.push({ doc, variant, label, truth: '', values, status: 'ok' }); tally.rightEmpty++; return; }
    tally.missing++; rows.push({ doc, variant, label, truth, values, status: 'check' }); return;
  }
  const ticked = agree && present.length > 0;
  const right = ticked && same(values[0] ?? '', truth ?? '');
  if (ticked) { tally.ticked++; right ? tally.rightTicks++ : tally.wrongTicks++; }
  else if (present.length === 0) tally.missing++; else tally.flagged++;
  rows.push({ doc, variant, label, truth: truth ?? '', values, status: !ticked ? 'check' : right ? 'ok' : 'WRONG' });
}

for (const d of key.documents) {
  for (const variant of ['clean', 'photo']) {
    const file = d[variant === 'clean' ? 'file_clean' : 'file_photo'];
    const reads = readers.map((r) => r.data[file] ?? {});
    field(d.id, variant, 'date', d.date.as_written, reads.map((x) => x.date_as_printed ?? undefined));
    for (const r of d.results ?? []) {
      // a value and unit written together ("2-4 /HPF") may be copied as one field or split in two: both are exact copies
      const hits = reads.map((x) => findResult(x.results, r.test)).map((h) => h && !r.unit && h.unit && same(`${h.value} ${h.unit}`, r.value) ? { ...h, value: r.value, unit: '' } : h);
      field(d.id, variant, `${r.test}: value`, r.value, hits.map((h) => h?.value));
      field(d.id, variant, `${r.test}: unit`, r.unit, hits.map((h) => h ? (h.unit ?? '') : undefined));
      field(d.id, variant, `${r.test}: range`, r.reference_range, hits.map((h) => h ? (h.range ?? '') : undefined));
      field(d.id, variant, `${r.test}: flag`, r.flag_printed, hits.map((h) => h ? (h.flag ?? '') : undefined));
      hits.forEach((h) => { if (h?.flag && !r.flag_printed) tally.addedFlags++; if (h?.range && !r.reference_range) tally.addedRanges++; });
    }
    for (const m of d.medicines ?? []) {
      const hits = reads.map((x) => findMed(x.medicines, m.as_written));
      field(d.id, variant, `medicine: ${m.as_written}`, m.as_written, hits.map((h) => h?.as_written));
    }
  }
}

// ---- the checks that decide the gate ----
const gate = [];
const allReads = (file) => readers.map((r) => r.data[file] ?? {});
for (const [docId, brand] of [['P03', 'glucozen'], ['P05', 'neurozen']]) {
  const d = key.documents.find((x) => x.id === docId);
  for (const variant of ['clean', 'photo']) {
    const meds = allReads(d[variant === 'clean' ? 'file_clean' : 'file_photo']).map((x) => (x.medicines ?? []).map((m) => m.as_written).join(' | '));
    const kept = meds.every((s) => loose(s).includes(brand));
    const mapped = meds.some((s) => /metformin|mecobalamin|pregabalin|methylcobalamin/i.test(s) && !loose(s).includes(brand));
    gate.push(`${docId} ${variant}: invented brand ${kept ? 'copied as written' : 'NOT copied as written'}${mapped ? ', and REPLACED by a real drug name' : ''}`);
  }
}
{
  const d = key.documents.find((x) => x.id === 'L03');
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
  for (const variant of ['clean', 'photo']) {
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
  const agreed = copies.every((c) => c && loose(c) === loose(copies[0]));
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
const mode = readers.length > 1 ? `agreement of ${readers.map((r) => r.name).join(' + ')}` : `one reader only (${readers[0].name}); agreement needs a second reader`;
const lines = [
  `# Reader score on ${setDir.split('/').pop()} (fictional SAMPLE documents)`, '',
  `Mode: ${mode}. ${key.documents.length} documents × clean scan and phone photo. Planning stage: a score on invented documents, not a result on real records.`, '',
  '| | Fields | Ticked | Right ticks | **Wrong ticks** | Correctly left empty | To check | Not found | Flags added | Ranges added |', '|---|---|---|---|---|---|---|---|---|---|',
  `| Total | ${tally.fields} | ${tally.ticked} (${pct(tally.ticked, tally.fields)}) | ${tally.rightTicks} | **${tally.wrongTicks}** | ${tally.rightEmpty} | ${tally.flagged} | ${tally.missing} | ${tally.addedFlags} | ${tally.addedRanges} |`, '',
  '## Gate checks', '', ...gate.map((g) => `- ${g}`), '',
  ...medSection,
  '## Every field that was not a right tick', '', '| Doc | Version | Field | Answer key | Reader(s) | Status |', '|---|---|---|---|---|---|',
  ...rows.filter((r) => r.status !== 'ok').map((r) => `| ${r.doc} | ${r.variant} | ${r.label} | ${r.truth} | ${r.values.map((v) => v ?? '—').join(' / ')} | ${r.status} |`),
];
const md = lines.join('\n') + '\n';
if (out) await writeFile(out, md); else process.stdout.write(md);
console.error(JSON.stringify(tally));
