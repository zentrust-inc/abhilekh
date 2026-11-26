// Deleting (decided 26 Nov 2026): a paper, an entry, or the whole account, confirmed with the PIN. SAMPLE content only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, readdirSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import jpeg from 'jpeg-js';
import { createApp } from '../server.mjs';
import { memorySender } from '../sms.mjs';

const PIN = '482915';
const photoOf = shade => Buffer.from(jpeg.encode({ data: Buffer.alloc(120 * 80 * 4, shade), width: 120, height: 80 }, 90).data);

async function start() {
  const sms = memorySender();
  const dir = mkdtempSync(join(tmpdir(), 'abk-del-'));
  const app = createApp({ sms, secureCookies: false, storePath: join(dir, 'store.json'), photos: true });
  const srv = http.createServer(app.handler);
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const signUp = async num => {
    const jar = {};
    const call = async (p, method = 'GET', body, headers = {}) => {
      const h = { ...headers }; if (body !== undefined && !h['content-type']) h['content-type'] = 'application/json';
      const ck = Object.entries(jar).filter(([, v]) => v).map(([k, v]) => k + '=' + v).join('; '); if (ck) h.cookie = ck;
      const r = await fetch(base + p, { method, headers: h, body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body) });
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
  const photo = (call, shade) => call('/api/papers', 'POST', photoOf(shade), { 'content-type': 'image/jpeg', 'x-abhilekh-upload': '1' });
  const originals = () => readdirSync(join(dir, 'originals'));
  return { app, dir, signUp, photo, originals, close: () => { srv.closeAllConnections(); srv.close(); } };
}

test('a paper is deleted only with the PIN; its photo goes, other papers stay', async () => {
  const s = await start();
  try {
    const me = await s.signUp('9841000101');
    await s.photo(me, 120); const r = await s.photo(me, 200);
    assert.equal(s.originals().length, 2);
    const [keep, drop] = r.json.papers;               // newest first
    assert.equal((await me(`/api/papers/${drop.id}/delete`, 'POST', { pin: '000000' })).status, 401);
    assert.equal((await me(`/api/papers/${drop.id}/delete`, 'POST', {})).status, 400);
    assert.equal(s.originals().length, 2);            // nothing happened
    const d = await me(`/api/papers/${drop.id}/delete`, 'POST', { pin: PIN });
    assert.equal(d.status, 200);
    assert.equal(d.json.photo, 'deleted');
    assert.deepEqual(d.json.papers.map(p => p.id), [keep.id]);
    assert.equal(s.originals().length, 1);
    assert.equal((await me(`/api/papers/${drop.id}/original`)).status, 404);
    assert.equal((await me(`/api/papers/${keep.id}/original`)).status, 200);
  } finally { s.close(); }
});

test('deleting an entry takes it out of every share; a share left empty goes', async () => {
  const s = await start();
  try {
    const me = await s.signUp('9841000102');
    await me('/api/record/sample', 'POST', {});
    const one = await me('/api/shares', 'POST', { docs: ['L21'], minutes: 15, pin: PIN });
    const two = await me('/api/shares', 'POST', { docs: ['L21', 'L22'], minutes: 15, pin: PIN });
    assert.equal(one.status, 201); assert.equal(two.status, 201);
    const d = await me('/api/docs/L21/delete', 'POST', { pin: PIN });
    assert.equal(d.status, 200);
    assert.deepEqual(d.json.docs.map(x => x.id), ['L22']);
    const shares = (await me('/api/shares')).json.shares;
    assert.equal(shares.length, 1);                   // the share that held only L21 is gone
    assert.deepEqual(shares[0].docs, ['L22']);
  } finally { s.close(); }
});

test('deleting the account removes everything of it and signs out; another account is untouched', async () => {
  const s = await start();
  try {
    const me = await s.signUp('9841000103');
    const other = await s.signUp('9841000104');
    await s.photo(me, 90); await s.photo(other, 60);
    await me('/api/record/sample', 'POST', {});
    await me('/api/shares', 'POST', { docs: ['L21'], minutes: 15, pin: PIN });
    assert.equal((await me('/api/account/delete', 'POST', { pin: PIN })).status, 400);              // must type DELETE
    assert.equal((await me('/api/account/delete', 'POST', { pin: '111222', confirm: 'DELETE' })).status, 401);
    const d = await me('/api/account/delete', 'POST', { pin: PIN, confirm: 'DELETE' });
    assert.equal(d.status, 200);
    assert.deepEqual(d.json.photos, { deleted: 1, trashed: 0, failed: 0, kept: 0 });
    assert.equal((await me('/api/record')).status, 401);                                         // signed out
    const st = JSON.parse(readFileSync(join(s.dir, 'store.json'), 'utf8'));
    assert.equal(st.accounts.length, 1);
    assert.equal(Object.keys(st.records).length, 1);
    assert.equal(st.shares.length, 0);
    assert.ok(!JSON.stringify(st).includes('9841000103'));                                        // not even the number
    assert.equal(s.originals().length, 1);
    assert.equal((await other('/api/record')).json.papers.length, 1);                            // the other account is untouched
  } finally { s.close(); }
});
