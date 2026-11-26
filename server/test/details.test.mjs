// My details (decided 26 Nov 2026): identity as typed; never a computed age. SAMPLE content only.
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
  const app = createApp({ sms, secureCookies: false, storePath: join(mkdtempSync(join(tmpdir(), 'abk-det-')), 'store.json') });
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

test('the date of birth is kept exactly as typed, with its calendar, and never turned into an age', async () => {
  const s = await start();
  try {
    const me = await s.signUp('9841000401');
    assert.equal((await me('/api/person/details', 'POST', { dob: '2041-04-12' })).status, 400);          // BS or AD must be said
    assert.equal((await me('/api/person/details', 'POST', { dob: 'baisakh', calendar: 'BS' })).status, 400); // needs its numbers
    const r = await me('/api/person/details', 'POST', { dob: '  २०४१  बैशाख १२ ', calendar: 'bs', age: '42', sex: 'female' }); // an age sent anyway is ignored
    assert.equal(r.status, 200);
    const d = r.json.details;
    assert.equal(d.dob, '२०४१ बैशाख १२');
    assert.equal(d.calendar, 'BS');
    assert.equal('age' in d, false);      // no age is ever kept
    assert.equal(d.sex, 'female');
    assert.ok(!/\b(years?|yrs|old)\b/i.test(JSON.stringify(r.json)), 'no age is computed anywhere');
  } finally { s.close(); }
});

test('a year alone is accepted; clearing removes everything', async () => {
  const s = await start();
  try {
    const me = await s.signUp('9841000402');
    const r = await me('/api/person/details', 'POST', { dob: '2010', calendar: 'BS' });
    assert.equal(r.json.details.dob, '2010');
    assert.equal((await me('/api/person/details', 'POST', { sex: 'unknown' })).status, 400);
    const c = await me('/api/person/details', 'POST', {});
    assert.deepEqual(c.json.details, { dob: null, calendar: null, sex: null, updated: null });
  } finally { s.close(); }
});

test('the doctor sees the details only when the patient included them, labelled as not from a paper', async () => {
  const s = await start();
  try {
    const me = await s.signUp('9841000403');
    await me('/api/record/sample', 'POST', {});
    assert.equal((await me('/api/shares', 'POST', { docs: [], details: true, minutes: 15, pin: PIN })).status, 400); // nothing typed yet
    await me('/api/person/details', 'POST', { dob: '1984-07-25', calendar: 'AD', sex: 'male' });
    await me('/api/shares', 'POST', { docs: ['L21'], minutes: 15, pin: PIN });
    const only = await me('/api/shares', 'POST', { docs: [], details: true, minutes: 15, pin: PIN });
    assert.equal(only.status, 201);
    const list = (await me('/api/shares')).json.shares;
    assert.equal((await s.anon('/api/s/' + list.find(y => !y.details).id)).json.details, null);
    const seen = (await s.anon('/api/s/' + list.find(y => y.details).id)).json.details;
    assert.deepEqual(seen, { label: 'Told by the patient · not from a paper', dob: '1984-07-25', calendar: 'AD', sex: 'male' });
  } finally { s.close(); }
});
