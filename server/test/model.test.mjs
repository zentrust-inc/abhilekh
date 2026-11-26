// Spec v1.0 record model through the server: GET /api/papers/:id/model, POST /api/papers/:id/events. SAMPLE content only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import jpeg from 'jpeg-js';
import { createApp } from '../server.mjs';
import { memorySender } from '../sms.mjs';
import { SCHEMA } from '../../reader/copy.mjs';

const PIN = '482915';
const LEGACY = { kind: 'prescription', date_as_printed: '2083/08/09', facility: 'Namuna Clinic (SAMPLE)', clinician: 'Dr. Sample Doctor',
  results: [], medicines: [{ as_written: 'Namunapril 5 mg', dose: '1-0-1', duration: '30 days' }], notes: [] };
const FULL = { schema: SCHEMA, page: { document_type: 'prescription' }, issuer: { name: 'Namuna Clinic (SAMPLE)' },
  clinicians: [{ name: 'Dr. Sample Doctor' }], dates: [{ as_written: '2083/08/09', label_as_printed: 'Date:' }],
  encounters: [{ date_as_written: '2083/08/09', medicines: [{ name_as_written: 'Namunapril', strength_as_written: '5 mg', dose_as_written: '1-0-1', frequency_as_written: 'OD', duration_as_written: '30 days' }] }] };
const LINES = ['Namuna Clinic (SAMPLE)', 'Dr. Sample Doctor', 'Date: 2083/08/09', 'Namunapril 5 mg 1-0-1 OD 30 days'];
const PHOTO = Buffer.from(jpeg.encode({ data: Buffer.alloc(300 * 200 * 4, 170), width: 300, height: 200 }, 90).data);

async function start(phone = '9841000002') {
  const sms = memorySender();
  const dir = mkdtempSync(join(tmpdir(), 'abk-model-'));
  const storePath = join(dir, 'store.json');
  const app = createApp({ sms, secureCookies: false, storePath, photos: true,
    readers: { claude: async () => ({ data: LEGACY, full: FULL, usd: 0.03 }), vision: async () => ({ data: { words: [], lines: LINES }, usd: 0.0015 }) },
    readingLimits: { logger: { log() {}, error() {} } } });
  const srv = http.createServer(app.handler);
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const mkCall = () => { const jar = {}; return async (p, method = 'GET', body, headers = {}) => {
    const h = { ...headers }; if (body !== undefined && !h['content-type']) h['content-type'] = 'application/json';
    const ck = Object.entries(jar).map(([k, v]) => k + '=' + v).join('; '); if (ck) h.cookie = ck;
    const r = await fetch(base + p, { method, headers: h, body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body) });
    for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
    let json = null; try { json = await r.json(); } catch {}
    return { status: r.status, json };
  }; };
  const signIn = async (call, ph) => {
    await call('/api/auth/code', 'POST', { phone: ph });
    const code = sms.sent.at(-1).text.match(/\d{6}/)[0];
    const v = await call('/api/auth/verify', 'POST', { phone: ph, code });
    await call('/api/auth/pin', 'POST', { ticket: v.json.ticket, pin: PIN });
  };
  const call = mkCall(); await signIn(call, phone);
  const up = await call('/api/papers', 'POST', PHOTO, { 'content-type': 'image/jpeg', 'x-abhilekh-upload': '1' });
  const id = up.json.papers[0].id;
  for (let i = 0; i < 200 && !app.reading.idle(); i++) await new Promise(r => setTimeout(r, 5));
  const other = mkCall(); await signIn(other, '9841000003');
  return { call, other, id, storePath, close: () => { srv.closeAllConnections(); srv.close(); } };
}

const finishing = view => {
  const evs = [{ path: 'person.match', action: 'confirmed' }, { path: 'page.document_type', action: 'confirmed' }];
  for (const b of view.gate.blocking) {
    if (b.path.startsWith('count:')) continue;
    if (b.path === 'person.match' || b.path === 'page.document_type') continue;
    const f = view.fields.find(x => x.path === b.path);
    evs.push(f?.agreement === 'agreed' ? { path: b.path, action: 'confirmed' } : { path: b.path, action: 'marked_absent_on_paper' });
  }
  for (const b of view.gate.blocking.filter(x => x.path.startsWith('count:'))) evs.push({ path: b.path, action: 'count_confirmed', value: b.rows });
  return evs;
};

test('a read paper has a model: fields per path, a closed gate, no items yet; Vision lines kept', async () => {
  const s = await start();
  try {
  const r = await s.call(`/api/papers/${s.id}/model`);
  assert.equal(r.status, 200);
  assert.equal(r.json.model, 'abhilekh.record.v1');
  assert.equal(r.json.gate.ok, false);
  assert.equal(r.json.items, null);
  const name = r.json.fields.find(f => f.path === 'encounters.0.medicines.0.name_as_written');
  assert.deepEqual([name.agreement, name.prefill, name.state], ['agreed', 'Namunapril', 'pending']);
  const stored = JSON.parse(readFileSync(s.storePath, 'utf8'));
  const p = Object.values(stored.records).flatMap(x => x.people).flatMap(x => x.papers).find(x => x.id === s.id);
  assert.deepEqual(p.reading.vision_lines, LINES);
  } finally { s.close(); }
});

test('decisions are appended, all or none, and open the gate; the log is saved', async () => {
  const s = await start();
  try {
  const v0 = (await s.call(`/api/papers/${s.id}/model`)).json;
  const bad = await s.call(`/api/papers/${s.id}/events`, 'POST', { events: [{ path: 'person.match', action: 'confirmed' }, { path: 'dates.0.as_written', action: 'confirmed', bulk: true }] });
  assert.equal(bad.status, 400);
  assert.match(bad.json.error, /own tick/);
  assert.equal((await s.call(`/api/papers/${s.id}/model`)).json.log, 0);           // nothing added
  // counts are confirmed after the fields, from what the gate now says
  let v = (await s.call(`/api/papers/${s.id}/events`, 'POST', { events: finishing(v0).filter(e => !e.path.startsWith('count:')) })).json;
  const counts = v.gate.blocking.filter(b => b.path.startsWith('count:')).map(b => ({ path: b.path, action: 'count_confirmed', value: b.rows }));
  v = (await s.call(`/api/papers/${s.id}/events`, 'POST', { events: counts })).json;
  assert.deepEqual(v.gate.blocking, []);
  assert.equal(v.gate.ok, true);
  const med = v.items.find(i => i.kind === 'medicine');
  assert.deepEqual([med.name_as_written, med.strength_as_written, med.dose_as_written], ['Namunapril', '5 mg', '1-0-1']);
  const stored = JSON.parse(readFileSync(s.storePath, 'utf8'));
  const p = Object.values(stored.records).flatMap(x => x.people).flatMap(x => x.papers).find(x => x.id === s.id);
  assert.equal(p.log.length, v.log);
  assert.ok(p.log.every(e => e.actor.kind === 'patient' && e.copy_at));
  } finally { s.close(); }
});

test('another account cannot see or decide on this paper', async () => {
  const s = await start();
  try {
  assert.equal((await s.other(`/api/papers/${s.id}/model`)).status, 404);
  assert.equal((await s.other(`/api/papers/${s.id}/events`, 'POST', { events: [{ path: 'person.match', action: 'confirmed' }] })).status, 404);
  } finally { s.close(); }
});

test('the existing check screen is untouched', async () => {
  const s = await start();
  try {
  const r = await s.call('/api/record');
  assert.equal(r.json.papers[0].status, 'ready');
  assert.ok(r.json.papers[0].reading.medicines.length);
  } finally { s.close(); }
});
