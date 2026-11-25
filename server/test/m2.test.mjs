// Build plan M2: the two readers read each photo; fields are compared, never interpreted. Stand-in readers only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import jpeg from 'jpeg-js';
import { createApp } from '../server.mjs';
import { readingCopy } from '../reading.mjs';
import { localOriginals } from '../originals.mjs';

const sha = b => createHash('sha256').update(b).digest('hex');
const photo = (w = 3000, h = 4000) => { const d = Buffer.alloc(w * h * 4, 200); return Buffer.from(jpeg.encode({ data: d, width: w, height: h }, 90).data); };
// SAMPLE pages only in tests (invented content).
const A = { kind: 'lab_report', date_as_printed: '2083-08-09', facility: 'Namuna Lab (SAMPLE)', clinician: null,
  results: [{ test: 'TSH', value: '6.8', unit: 'µIU/mL', range: '0.4 - 4.0', flag: 'H' }, { test: 'Hemoglobin', value: '13', unit: 'g/dL', range: '12-16', flag: null }, { test: 'ESR', value: '18', unit: 'mm/hr', range: null, flag: null }],
  medicines: [{ as_written: 'Tab Metformin 500 mg', dose: '1-0-1', duration: '30 days' }, { as_written: 'Tab Glucofix 2', dose: '1-0-0', duration: null }], notes: [] };
const B = { ...A, facility: 'Namuna Lab (SAMPLE)', date_as_printed: '2083-08-09',
  results: [{ test: 'TSH', value: '6.8', unit: 'µIU/mL', range: '0.4-4.0', flag: 'H' }, { test: 'Haemoglobin', value: '18', unit: 'g/dL', range: '12-16', flag: null }, { test: 'Urea', value: '30', unit: 'mg/dL', range: null, flag: null }],
  medicines: [{ as_written: 'Tab Metformin 500mg', dose: '1 - 0 - 1', duration: '30 d' }, { as_written: 'Tab Glucofix 2', dose: '1-0-0', duration: null }] };

async function setup(readers, limits) {
  const dir = mkdtempSync(join(tmpdir(), 'abk-m2-'));
  const keep = localOriginals(join(dir, 'o'));
  const app = createApp({ storePath: join(dir, 'store.json'), photos: true, originals: keep, readers, readingLimits: { logger: { log() {}, error() {} }, ...limits } });
  const s = app.store();
  const buf = photo(200, 300);
  const ref = await keep.put(sha(buf), 'image/jpeg', buf);
  const paper = { id: 'p1', sha256: sha(buf), mime: 'image/jpeg', bytes: buf.length, ref, added: '', status: 'waiting' };
  s.records.acct = { people: [{ id: 'pa', name: '', docs: [], papers: [paper] }] };
  const done = async () => { for (let i = 0; i < 200 && !app.reading.idle(); i++) await new Promise(r => setTimeout(r, 5)); };
  return { app, paper, done };
}

test('the readers get a smaller copy of a large photo; the original stays as it was', () => {
  const big = photo();
  const c = readingCopy(big, 'image/jpeg');
  const d = jpeg.decode(c.buf);
  assert.equal(Math.max(d.width, d.height), 2000);
  assert.ok(c.buf.length < big.length);
  const small = photo(800, 600);
  assert.equal(readingCopy(small, 'image/jpeg').buf, small);           // small enough: sent as it is
  const png = Buffer.from('png');
  assert.equal(readingCopy(png, 'image/png').buf, png);                // other kinds: as they are
});

test('fields are compared, never guessed: agreed, the patient confirms, or Unresolved', async () => {
  const { app, paper, done } = await setup({ a: async () => ({ data: A, usd: 0.03, model: 'a' }), b: async () => ({ data: B, usd: 0.004, model: 'b' }) });
  app.reading.resume(); await done();
  assert.equal(paper.status, 'ready');
  const r = paper.reading;
  assert.equal(r.date.state, 'confirm');                                 // a date is always confirmed (typed) by the patient
  assert.equal(r.facility.state, 'agreed');
  const tsh = r.results.find(x => x.test.text === 'TSH');
  assert.equal(tsh.value.state, 'confirm');                               // decimal point: the patient confirms, even though both agree
  assert.equal(tsh.range.state, 'agreed');                                // "0.4 - 4.0" = "0.4-4.0" as characters
  assert.equal(tsh.flag.text, 'H');                                       // the printed flag, copied, not judged
  const hb = r.results.find(x => /h(a)?emoglobin/i.test(x.test.a || x.test.text || ''));
  assert.equal(hb.value.state, 'unresolved');                             // 13 vs 18: never picked
  assert.equal(hb.value.text, '');
  assert.ok(r.results.some(x => x.test.state === 'unresolved' && (x.test.a === 'ESR' || x.test.b === 'ESR')));  // seen by one reader only
  assert.ok(r.results.some(x => x.test.b === 'Urea' && x.value.state === 'unresolved'));
  const met = r.medicines.find(m => /metformin/i.test(m.as_written.text));
  assert.equal(met.as_written.state, 'agreed');
  assert.equal(met.dose.state, 'agreed');                                 // "1 - 0 - 1" = "1-0-1"
  assert.equal(met.dda, 'on_list');
  assert.equal(r.medicines.find(m => /glucofix/i.test(m.as_written.text)).dda, 'not_found'); // a brand: shown as written, flagged
  assert.equal(app.store().reading.spend[new Date().toISOString().slice(0, 7)].toFixed(3), '0.034');
  assert.ok(r.summary.unresolved >= 3 && r.summary.confirm >= 2);
});

test('one reader only: nothing is agreed; both fail: the photo is marked failed and stays kept', async () => {
  const one = await setup({ a: async () => ({ data: A, usd: 0.03, model: 'a' }), b: async () => { throw new Error('HTTP 503'); } });
  one.app.reading.resume(); await one.done();
  assert.equal(one.paper.status, 'ready');
  assert.equal(one.paper.reading.oneReader, true);
  assert.equal(one.paper.reading.summary.agreed, 0);
  const none = await setup({ a: async () => { throw new Error('no key'); }, b: async () => { throw new Error('no key'); } });
  none.app.reading.resume(); await none.done();
  assert.equal(none.paper.status, 'failed');
  assert.match(none.paper.error, /both readers failed/);
});

test('the monthly limit pauses reading; nothing is spent past it', async () => {
  let calls = 0;
  const { app, paper, done } = await setup({ a: async () => { calls++; return { data: A, usd: 0.05, model: 'a' }; }, b: async () => { calls++; return { data: B, usd: 0.05, model: 'b' }; } }, { monthCapUsd: 0.05 });
  app.reading.resume(); await done();
  assert.equal(paper.status, 'paused');
  assert.equal(calls, 0);
});

test('a photo whose original no longer matches its SHA-256 is not read', async () => {
  const { app, paper, done } = await setup({ a: async () => ({ data: A, usd: 0 }), b: async () => ({ data: B, usd: 0 }) });
  paper.sha256 = 'f'.repeat(64);
  app.reading.resume(); await done();
  assert.equal(paper.status, 'failed');
  assert.match(paper.error, /SHA-256/);
});
