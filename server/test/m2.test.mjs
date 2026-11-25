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
// SAMPLE pages only in tests (invented content). Claude's copy (fields) and Vision's lines of the same page.
const A = { kind: 'lab_report', date_as_printed: '2083-08-09', facility: 'Namuna Lab (SAMPLE)', clinician: null,
  results: [{ test: 'TSH', value: '6.8', unit: 'µIU/mL', range: '0.4 - 4.0', flag: 'H' }, { test: 'Hemoglobin', value: '13', unit: 'g/dL', range: '12-16', flag: null },
    { test: 'ESR', value: '18', unit: 'mm/hr', range: null, flag: null }, { test: 'Creatinine', value: '0.9', unit: 'mg/dL', range: '0.6-1.2', flag: null }],
  medicines: [{ as_written: 'Tab Metformin 500 mg', dose: '1-0-1', duration: '30 days' }, { as_written: 'Tab Glucofix 2', dose: '1-0-0', duration: null }], notes: [] };
const V = { words: [], lines: ['Namuna Lab (SAMPLE)', 'Date: 2083-08-09', 'TSH  6.8  µIU/mL  0.4-4.0  H', 'Hemoglobin  18  g/dL  12-16', 'Creatinine  0.9  mg/dL  0.6-1.2  H',
  'Tab Metformin 500 mg  1-01  x 30 days', 'Tab Glucofix 2  1-0-0'] };
const claude = async () => ({ data: A, usd: 0.03, model: 'claude' }), vision = async () => ({ data: V, usd: 0.0015, model: 'vision' });

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

test('Claude copies, Vision confirms: agreed, the patient confirms, or Unresolved; never guessed', async () => {
  const { app, paper, done } = await setup({ claude, vision });
  app.reading.resume(); await done();
  assert.equal(paper.status, 'ready');
  const r = paper.reading;
  assert.equal(r.date.state, 'confirm');                                 // a date is always confirmed (typed) by the patient
  assert.equal(r.facility.state, 'agreed');
  assert.equal(r.clinician.state, 'empty');
  const row = t => r.results.find(x => (x.test.text || x.test.a) === t);
  assert.equal(row('TSH').value.state, 'confirm');                        // decimal point: the patient confirms, even though Vision saw it
  assert.equal(row('TSH').range.state, 'agreed');                         // "0.4 - 4.0" = "0.4-4.0" as characters
  assert.equal(row('TSH').flag.text, 'H');                                // the printed flag, copied, not judged
  assert.equal(row('Hemoglobin').value.state, 'unresolved');              // Claude 13, Vision's line says 18: never picked
  assert.equal(row('Hemoglobin').value.text, '');
  assert.equal(row('ESR').test.state, 'unresolved');                      // no such line in Vision's text
  assert.equal(row('Creatinine').flag.state, 'unresolved');               // Vision sees an H that Claude did not copy
  assert.equal(row('Creatinine').flag.b, 'H');
  const met = r.medicines.find(m => /metformin/i.test(m.as_written.text));
  assert.equal(met.as_written.state, 'agreed');
  assert.equal(met.dose.state, 'agreed');                                 // OCR lost a dash ("1-01"): same digits in order
  assert.equal(met.duration.state, 'agreed');
  assert.equal(met.dda, 'on_list');
  assert.equal(r.medicines.find(m => /glucofix/i.test(m.as_written.text)).dda, 'not_found'); // a brand: shown as written, flagged
  assert.equal(app.store().reading.spend[new Date().toISOString().slice(0, 7)].toFixed(4), '0.0315');
  assert.ok(r.summary.unresolved >= 3 && r.summary.confirm >= 2 && r.summary.agreed >= 5);
});

test('Vision failed: nothing is agreed; Claude failed: the photo is marked failed and stays kept', async () => {
  const one = await setup({ claude, vision: async () => { throw new Error('HTTP 503'); } });
  one.app.reading.resume(); await one.done();
  assert.equal(one.paper.status, 'ready');
  assert.equal(one.paper.reading.oneReader, true);
  assert.equal(one.paper.reading.summary.agreed, 0);
  const none = await setup({ claude: async () => { throw new Error('no key'); }, vision });
  none.app.reading.resume(); await none.done();
  assert.equal(none.paper.status, 'failed');
  assert.match(none.paper.error, /Claude reader failed/);
});

test('the monthly limit pauses reading; nothing is spent past it', async () => {
  let calls = 0;
  const { app, paper, done } = await setup({ claude: async () => { calls++; return { data: A, usd: 0.05 }; }, vision: async () => { calls++; return { data: V, usd: 0.0015 }; } }, { monthCapUsd: 0.05 });
  app.reading.resume(); await done();
  assert.equal(paper.status, 'paused');
  assert.equal(calls, 0);
});

test('a photo whose original no longer matches its SHA-256 is not read', async () => {
  const { app, paper, done } = await setup({ claude, vision });
  paper.sha256 = 'f'.repeat(64);
  app.reading.resume(); await done();
  assert.equal(paper.status, 'failed');
  assert.match(paper.error, /SHA-256/);
});

test('Vision reader: sends the image with the key, returns word boxes and lines', async () => {
  const { readVisionBytes } = await import('../../reader/vision.mjs');
  process.env.VISION_API_KEY = 'test-key';
  let sent;
  const fake = async (url, o) => { sent = { url, o }; return { ok: true, json: async () => ({ responses: [{ fullTextAnnotation: { pages: [{ blocks: [{ paragraphs: [{ words: [
    { symbols: [{ text: 'T' }, { text: 'S' }, { text: 'H' }], boundingBox: { vertices: [{ x: 10, y: 10 }, { x: 50, y: 10 }, { x: 50, y: 30 }, { x: 10, y: 30 }] } },
    { symbols: [{ text: '6' }, { text: '.' }, { text: '8' }], boundingBox: { vertices: [{ x: 200, y: 11 }, { x: 240, y: 11 }, { x: 240, y: 31 }, { x: 200, y: 31 }] } }] }] }] }] } }] }) }; };
  const r = await readVisionBytes(Buffer.from('img'), fake);
  delete process.env.VISION_API_KEY;
  assert.equal(sent.o.headers['x-goog-api-key'], 'test-key');
  assert.equal(JSON.parse(sent.o.body).requests[0].features[0].type, 'DOCUMENT_TEXT_DETECTION');
  assert.equal(r.data.words.length, 2);
  assert.deepEqual(r.data.lines, ['TSH  6.8']);
});
