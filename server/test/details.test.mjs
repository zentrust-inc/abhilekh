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

test('the date of birth is kept exactly as picked, with its calendar, and never turned into an age', async () => {
  const s = await start();
  try {
    const me = await s.signUp('9841000401');
    assert.equal((await me('/api/person/details', 'POST', { dob: '2041-04-12' })).status, 400);              // BS or AD must be said
    assert.equal((await me('/api/person/details', 'POST', { dob: '2041 baisakh', calendar: 'BS' })).status, 400); // only a picked date
    assert.equal((await me('/api/person/details', 'POST', { dob: '2041-02-32', calendar: 'BS' })).status, 400); // Jestha 2041 has 31 days
    assert.equal((await me('/api/person/details', 'POST', { dob: '1982-12-30', calendar: 'BS' })).status, 400); // more than 100 years back
    assert.equal((await me('/api/person/details', 'POST', { dob: '2090-01-01', calendar: 'BS' })).status, 400); // in the future
    assert.equal((await me('/api/person/details', 'POST', { dob: '1985-02-29', calendar: 'AD' })).status, 400); // no such AD day
    assert.equal((await me('/api/person/details', 'POST', { dob: '1983-01-01', calendar: 'BS' })).status, 200); // 100 years back is fine
    assert.equal((await me('/api/person/details', 'POST', { dob: '1989-07-30', calendar: 'BS' })).status, 200); // a split year: the longer month is offered
    const r = await me('/api/person/details', 'POST', { dob: '2041-04-12', calendar: 'bs', age: '42', sex: 'female' }); // an age sent anyway is ignored
    assert.equal(r.status, 200);
    const d = r.json.details;
    assert.deepEqual([d.dob, d.calendar, d.sex], ['2041-04-12', 'BS', 'female']);
    assert.equal('age' in d, false);      // no age is ever kept
    assert.ok(!/\b(years?|yrs|old)\b/i.test(JSON.stringify(r.json)), 'no age is computed anywhere');
  } finally { s.close(); }
});

test('clearing removes everything', async () => {
  const s = await start();
  try {
    const me = await s.signUp('9841000402');
    await me('/api/person/details', 'POST', { dob: '1990-02-28', calendar: 'AD' });
    assert.equal((await me('/api/person/details', 'POST', { sex: 'unknown' })).status, 400);
    const c = await me('/api/person/details', 'POST', {});
    assert.deepEqual(c.json.details, { dob: null, calendar: null, sex: null, updated: null });
  } finally { s.close(); }
});

test('the picker table matches the pinned calendar, except the split years where it offers the longer month', async () => {
  const { readFileSync } = await import('node:fs');
  const t = JSON.parse(readFileSync(new URL('../public/bs-months.json', import.meta.url), 'utf8'));
  const csv = readFileSync(new URL('../../derived/calendar_bs.csv', import.meta.url), 'utf8').trim().split('\n').slice(1).map(l => l.split(',').map(Number));
  const pinned = Object.fromEntries(csv.map(([y, ...m]) => [y, m]));
  assert.deepEqual(Object.keys(t.months).map(Number), Array.from({ length: 108 }, (_, i) => 1983 + i));
  for (const [y, m] of Object.entries(t.months)) {
    if (t.split_years.includes(+y)) { assert.equal(m.every((d, i) => d >= pinned[y][i]), true); assert.equal(m.reduce((a, b) => a + b) - pinned[y].reduce((a, b) => a + b), 1); }
    else assert.deepEqual(m, pinned[y], 'BS ' + y);
  }
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
