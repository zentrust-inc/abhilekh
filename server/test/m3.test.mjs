// Build plan M3: the patient checks what the readers found against the paper, then adds it to the record. SAMPLE content only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import jpeg from 'jpeg-js';
import { createApp } from '../server.mjs';
import { memorySender } from '../sms.mjs';

const PIN = '482915';
const A = { kind: 'lab_report', date_as_printed: '2083-08-09', facility: 'Namuna Lab (SAMPLE)', clinician: null,
  results: [{ test: 'TSH', value: '6.8', unit: 'µIU/mL', range: '0.4-4.0', flag: 'H' }, { test: 'Hemoglobin', value: '13', unit: 'g/dL', range: '12-16', flag: null }],
  medicines: [{ as_written: 'Tab Metformin 500 mg', dose: '1-0-1', duration: '30 days' }], notes: [] };
const V = { words: [], lines: ['Namuna Lab (SAMPLE)', '2083-08-09', 'TSH 6.8 µIU/mL 0.4-4.0 H', 'Hemoglobin 18 g/dL 12-16', 'Tab Metformin 500 mg 1-0-1 30 days'] };
const PHOTO = Buffer.from(jpeg.encode({ data: Buffer.alloc(300 * 200 * 4, 180), width: 300, height: 200 }, 90).data);

async function start() {
  const sms = memorySender();
  const dir = mkdtempSync(join(tmpdir(), 'abk-m3-'));
  const app = createApp({ sms, secureCookies: false, storePath: join(dir, 'store.json'), photos: true,
    readers: { claude: async () => ({ data: A, usd: 0.03 }), vision: async () => ({ data: V, usd: 0.0015 }) }, readingLimits: { logger: { log() {}, error() {} } } });
  const srv = http.createServer(app.handler);
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const jar = {};
  const call = async (p, method = 'GET', body, headers = {}) => {
    const h = { ...headers }; if (body !== undefined && !h['content-type']) h['content-type'] = 'application/json';
    const ck = Object.entries(jar).map(([k, v]) => k + '=' + v).join('; '); if (ck) h.cookie = ck;
    const r = await fetch(base + p, { method, headers: h, body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body) });
    for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
    const buf = Buffer.from(await r.arrayBuffer()); let json = null; try { json = JSON.parse(buf.toString()); } catch {}
    return { status: r.status, json, buf };
  };
  await call('/api/auth/code', 'POST', { phone: '9841000001' });
  const code = sms.sent.at(-1).text.match(/\d{6}/)[0];
  const v = await call('/api/auth/verify', 'POST', { phone: '9841000001', code });
  await call('/api/auth/pin', 'POST', { ticket: v.json.ticket, pin: PIN });
  const up = await call('/api/papers', 'POST', PHOTO, { 'content-type': 'image/jpeg', 'x-abhilekh-upload': '1' });
  const id = up.json.papers[0].id;
  for (let i = 0; i < 200 && !app.reading.idle(); i++) await new Promise(r => setTimeout(r, 5));
  const anon = async p => { const r = await fetch(base + p); return { status: r.status, json: await r.json().catch(() => null) }; };
  return { call, anon, id, base, close: () => { srv.closeAllConnections(); srv.close(); } };
}
const f = (value, ok = false, unresolved = false) => ({ value, ok, unresolved });
const good = () => ({ date: f('2083-08-09', true), facility: 'Namuna Lab (SAMPLE)', clinician: '',
  results: [{ test: f('TSH', true), value: f('6.8', true), unit: f('µIU/mL', true), range: f('0.4-4.0', true), flag: f('H', true) },
            { test: f('Hemoglobin', true), value: f('', false, true), unit: f('g/dL', true), range: f('12-16', true), flag: f('') }],
  medicines: [{ as_written: f('Tab Metformin 500 mg', true), dose: f('1-0-1', true), duration: f('30 days', true) }] });

test('nothing can be shared until checked; the rules are enforced by the server, not only the page', async () => {
  const s = await start();
  assert.equal((await s.call('/api/record')).json.papers[0].status, 'ready');
  assert.equal((await s.call('/api/record')).json.docs.length, 0);
  let b = good(); b.date = f('', true);
  assert.equal((await s.call('/api/papers/' + s.id + '/confirm', 'POST', b)).status, 400);           // no date, no record
  b = good(); b.date = f('2083-08-09', false);
  assert.match((await s.call('/api/papers/' + s.id + '/confirm', 'POST', b)).json.error, /Check the date/); // both readers agreed: still her own tick
  b = good(); b.date = '2083-08-09';
  assert.match((await s.call('/api/papers/' + s.id + '/confirm', 'POST', b)).json.error, /Check the date/); // an old page sending a bare date
  b = good(); b.results[0].value = f('6.8', false);
  assert.match((await s.call('/api/papers/' + s.id + '/confirm', 'POST', b)).json.error, /Check the value of TSH/); // decimal: own tick
  b = good(); b.results[1].value = f('', false, false);
  assert.match((await s.call('/api/papers/' + s.id + '/confirm', 'POST', b)).json.error, /leave it Unresolved/);   // unresolved: type or leave
  b = good(); b.results.pop();
  assert.equal((await s.call('/api/papers/' + s.id + '/confirm', 'POST', b)).status, 400);           // every line answered
  s.close();
});

test('checked: the paper becomes a record entry with crops, can be shared, and the doctor can open the whole original only while live', async () => {
  const s = await start();
  const b = good(); b.results[1].removed = false; b.medicines[0].duration = { value: 'ignored', none: true }; // "Not written on the paper"
  const r = await s.call('/api/papers/' + s.id + '/confirm', 'POST', b);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.papers[0].status, 'confirmed');
  const d = r.json.docs[0];
  assert.equal(d.title, 'Lab report');
  assert.equal(d.date, '2083-08-09');
  assert.equal(d.origin, 'photo');
  assert.deepEqual(d.results.map(x => [x.test, x.value]), [['TSH', '6.8'], ['Hemoglobin', 'Unresolved. Original document available.']]);
  assert.equal(d.medicines[0].as_written, 'Tab Metformin 500 mg');
  assert.equal(d.medicines[0].dose, '1-0-1');
  assert.equal(d.medicines[0].duration, '');
  assert.equal((await s.call('/api/papers/' + s.id + '/confirm', 'POST', good())).status, 409);       // once
  const sh = await s.call('/api/shares', 'POST', { docs: [d.id], minutes: 15, pin: PIN });
  assert.equal(sh.status, 201);
  const view = await s.anon('/api/s/' + sh.json.id);
  assert.equal(view.json.docs[0].results[1].value, 'Unresolved. Original document available.');
  const o = await fetch(s.base + '/api/s/' + sh.json.id + '/original/' + d.id);
  assert.equal(o.status, 200);
  assert.ok(Buffer.from(await o.arrayBuffer()).equals(PHOTO));                                    // the original, unchanged
  assert.equal((await fetch(s.base + '/api/s/' + sh.json.id + '/original/d000000000000')).status, 410);    // only papers in this share
  await s.call('/api/shares/' + sh.json.id + '/stop', 'POST', {});
  assert.equal((await fetch(s.base + '/api/s/' + sh.json.id + '/original/' + d.id)).status, 410);  // stopped: nothing
  s.close();
});

test('a line the readers invented can be removed ("not on the paper")', async () => {
  const s = await start();
  const b = good(); b.results[1] = { removed: true };
  const r = await s.call('/api/papers/' + s.id + '/confirm', 'POST', b);
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.docs[0].results.map(x => x.test), ['TSH']);
  s.close();
});
