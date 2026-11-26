// Allergies told by the patient (decided 26 Nov 2026). SAMPLE content only.
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
  const app = createApp({ sms, secureCookies: false, storePath: join(mkdtempSync(join(tmpdir(), 'abk-told-')), 'store.json') });
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
  return { signUp, anon, close: () => { srv.closeAllConnections(); srv.close(); } };
}

test('an allergy is kept exactly as typed, with nothing added; removing it needs the PIN', async () => {
  const s = await start();
  try {
    const me = await s.signUp('9841000301');
    assert.equal((await me('/api/stated/allergies', 'POST', { substance: '   ' })).status, 400);
    const r = await me('/api/stated/allergies', 'POST', { substance: '  Penicillin  (SAMPLE) ', reaction: 'Rash' });
    assert.equal(r.status, 201);
    const a = r.json.stated.allergies[0];
    assert.deepEqual(Object.keys(a).sort(), ['added', 'id', 'reaction', 'substance']);   // no severity, no code, no warning
    assert.equal(a.substance, 'Penicillin (SAMPLE)');
    assert.equal((await me(`/api/stated/allergies/${a.id}/delete`, 'POST', { pin: '000000' })).status, 401);
    const d = await me(`/api/stated/allergies/${a.id}/delete`, 'POST', { pin: PIN });
    assert.equal(d.status, 200);
    assert.deepEqual(d.json.stated.allergies, []);
  } finally { s.close(); }
});

test('the doctor sees allergies only when the patient included them, labelled as not from a paper', async () => {
  const s = await start();
  try {
    const me = await s.signUp('9841000302');
    await me('/api/record/sample', 'POST', {});
    await me('/api/stated/allergies', 'POST', { substance: 'Sulfa (SAMPLE)' });
    const without = await me('/api/shares', 'POST', { docs: ['L21'], minutes: 15, pin: PIN });
    const withA = await me('/api/shares', 'POST', { docs: ['L21'], stated: true, minutes: 15, pin: PIN });
    const only = await me('/api/shares', 'POST', { docs: [], stated: true, minutes: 15, pin: PIN });   // allergies alone may be shared
    assert.equal(only.status, 201);
    const list = (await me('/api/shares')).json.shares;
    const id = x => list.find(y => y.stated === x).id;
    assert.equal((await s.anon('/api/s/' + list.find(y => !y.stated).id)).json.stated, null);
    const seen = (await s.anon('/api/s/' + id(true))).json;
    assert.equal(seen.stated.label, 'Told by the patient · not from a paper');
    assert.deepEqual(seen.stated.allergies.map(a => a.substance), ['Sulfa (SAMPLE)']);
    assert.equal('id' in seen.stated.allergies[0], false);
    void without; void withA;
  } finally { s.close(); }
});

test('nothing to share at all is refused', async () => {
  const s = await start();
  try {
    const me = await s.signUp('9841000303');
    assert.equal((await me('/api/shares', 'POST', { docs: [], stated: true, minutes: 15, pin: PIN })).status, 400); // no allergies yet
  } finally { s.close(); }
});
