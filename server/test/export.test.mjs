// Download my record (decided 26 Nov 2026). SAMPLE content only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server.mjs';
import { memorySender } from '../sms.mjs';

const PIN = '482915';
async function start() {
  const sms = memorySender();
  const app = createApp({ sms, secureCookies: false, storePath: join(mkdtempSync(join(tmpdir(), 'abk-exp-')), 'store.json') });
  const srv = http.createServer(app.handler);
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const signUp = async num => {
    const jar = {};
    const call = async (p, method = 'GET', body) => {
      const h = {}; if (body !== undefined) h['content-type'] = 'application/json';
      const ck = Object.entries(jar).filter(([, v]) => v).map(([k, v]) => k + '=' + v).join('; '); if (ck) h.cookie = ck;
      const r = await fetch(base + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
      for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
      let json = null; try { json = await r.json(); } catch {}
      return { status: r.status, json };
    };
    await call('/api/auth/code', 'POST', { phone: num });
    const code = sms.sent.filter(m => m.to === num).at(-1).text.match(/\d{6}/)[0];
    const v = await call('/api/auth/verify', 'POST', { phone: num, code });
    await call('/api/auth/pin', 'POST', { ticket: v.json.ticket, pin: PIN });
    return call;
  };
  const anon = async p => { const r = await fetch(base + p); return { status: r.status, json: await r.json().catch(() => null) }; };
  return { base, signUp, anon, close: () => { srv.closeAllConnections(); srv.close(); } };
}

test('download needs the PIN and holds exactly what the record holds, labelled, with no photos inside', async () => {
  const s = await start();
  try {
    const me = await s.signUp('9800000001');
    assert.notEqual((await me('/api/record/export', 'POST', {})).status, 200);
    const bad = await me('/api/record/export', 'POST', { pin: '000000' });
    assert.notEqual(bad.status, 200);
    await me('/api/stated/allergies', 'POST', { substance: 'Penicillin', reaction: 'Rash' });
    const r = await me('/api/record/export', 'POST', { pin: PIN });
    assert.equal(r.status, 200);
    const x = r.json;
    assert.equal(x.format, 'abhilekh.export.v1');
    assert.match(x.stamp, /^Copy made by the patient on \d{4}-\d{2}-\d{2} · from Abhilekh · Not institution-verified$/);
    assert.deepEqual(x.allergies_told.map(a => [a.substance, a.reaction, a.source]), [['Penicillin', 'Rash', 'Told by the patient · not from a paper']]);
    const sum = (await me('/api/record')).json;
    assert.equal(x.papers.filter(p => p.kind !== 'not_checked').length, sum.docs.length);
    for (const p of x.papers.filter(p => p.kind !== 'not_checked')) for (const v of p.results) assert.deepEqual(Object.keys(v), ['test', 'value', 'unit', 'range', 'flag']);
    const txt = JSON.stringify(x);
    assert.ok(!/base64|data:image|"img"/.test(txt), 'no photo or crop is embedded');
  } finally { s.close(); }
});

test('download without signing in is refused', async () => {
  const s = await start();
  try {
    const r = await fetch(s.base + '/api/record/export', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"pin":"482915"}' });
    assert.notEqual(r.status, 200);
  } finally { s.close(); }
});
