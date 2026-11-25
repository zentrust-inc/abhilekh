import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server.mjs';

import { memorySender } from '../sms.mjs';

const PIN = '482915';
async function start(opts = {}) {
  let t = Date.parse('2026-11-21T10:00:00Z');
  const clock = { now: () => t, advance: min => { t += min * 60000; } };
  const sms = memorySender();
  const { num = '9841000001', empty = false, ...rest } = opts;
  const app = createApp({ now: clock.now, sms, secureCookies: false, ...rest });
  const srv = http.createServer(app.handler);
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  // a "phone": its own cookie jar
  const phone = () => {
    const jar = {};
    const call = async (p, method = 'GET', body, headers = {}) => {
      const h = { ...headers };
      if (body !== undefined) h['content-type'] = h['content-type'] || 'application/json';
      const ck = Object.entries(jar).filter(([, v]) => v).map(([k, v]) => k + '=' + v).join('; ');
      if (ck) h.cookie = ck;
      const r = await fetch(base + p, { method, headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
      for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
      return { status: r.status, json: await r.json().catch(() => null), headers: r.headers };
    };
    return { call, jar };
  };
  const lastCode = num => sms.sent.filter(m => m.to === num).at(-1).text.match(/\d{6}/)[0];
  // full SMS sign-up (or recovery) on a phone
  const signUp = async (ph, num = '9841000001', pin = PIN) => {
    assert.equal((await ph.call('/api/auth/code', 'POST', { phone: num })).status, 200);
    const v = await ph.call('/api/auth/verify', 'POST', { phone: num, code: lastCode(num) });
    assert.equal(v.status, 200);
    const p = await ph.call('/api/auth/pin', 'POST', { ticket: v.json.ticket, pin });
    assert.equal(p.status, 200, JSON.stringify(p.json));
    return v.json;
  };
  const me = phone();
  await signUp(me, num);
  if (!empty) assert.equal((await me.call('/api/record/sample', 'POST', {})).status, 200); // most tests want the SAMPLE papers in this account's record
  // the old tests' call(): signed in, PIN added to every share action
  const call = (p, method = 'GET', body) => me.call(p, method, method === 'POST' && p.startsWith('/api/shares') ? { pin: PIN, ...(body || {}) } : body);
  const anon = async (p, method = 'GET', body) => { const r = await fetch(base + p, { method }); return { status: r.status, json: await r.json().catch(() => null) }; };
  return { call, anon, clock, close: () => { srv.closeAllConnections(); srv.close(); }, app, sms, phone, signUp, lastCode, me };
}

test('live share shows the record and logs the open', async () => {
  const s = await start();
  const c = await s.call('/api/shares', 'POST', { docs: ['L21'], who: 'Dr. Namuna', minutes: 15 });
  assert.equal(c.status, 201);
  const r = await s.anon('/api/s/' + c.json.id);
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.docs.map(d => d.id), ['L21']); // only the chosen report
  const list = await s.call('/api/shares');
  assert.match(list.json.shares[0].log.at(-1).t, /Opened/);
  s.close();
});

test('after the time runs out the server refuses, shows nothing, and logs the attempt', async () => {
  const s = await start();
  const c = await s.call('/api/shares', 'POST', { docs: ['L21', 'L22'], minutes: 15 });
  s.clock.advance(14);
  assert.equal((await s.anon('/api/s/' + c.json.id)).status, 200);
  s.clock.advance(2);
  const r = await s.anon('/api/s/' + c.json.id);
  assert.equal(r.status, 410);
  assert.deepEqual(r.json, { state: 'expired' }); // no record in the refusal
  const sh = (await s.call('/api/shares')).json.shares[0];
  assert.equal(sh.state, 'expired');
  assert.match(sh.log.at(-1).t, /out of time\. Nothing was shown/);
  s.close();
});

test('stop sharing works at once, is logged, and later opens are refused and logged', async () => {
  const s = await start();
  const c = await s.call('/api/shares', 'POST', { docs: ['L22'], minutes: 15 });
  const st = await s.call('/api/shares/' + c.json.id + '/stop', 'POST');
  assert.equal(st.json.state, 'revoked');
  const r = await s.anon('/api/s/' + c.json.id);
  assert.equal(r.status, 410);
  assert.deepEqual(r.json, { state: 'revoked' });
  const log = (await s.call('/api/shares')).json.shares[0].log.map(e => e.t);
  assert.ok(log.some(t => /You stopped this share/.test(t)));
  assert.match(log.at(-1), /stopped\. Nothing was shown/);
  s.close();
});

test('stopping an already-expired share does not rewrite its history', async () => {
  const s = await start();
  const c = await s.call('/api/shares', 'POST', { docs: ['L21'], minutes: 15 });
  s.clock.advance(16);
  const st = await s.call('/api/shares/' + c.json.id + '/stop', 'POST');
  assert.equal(st.json.state, 'expired');
  assert.equal(st.json.revokedAt, null);
  s.close();
});

test('a share lasts 15 minutes (PRD v2.1); never longer, never forever; nothing without a report', async () => {
  const s = await start();
  for (const minutes of [0, -5, 1, 30, 60, 1440, 10080, 100000, 'forever', null]) {
    assert.equal((await s.call('/api/shares', 'POST', { docs: ['L21'], minutes })).status, 400, 'minutes=' + minutes);
  }
  assert.equal((await s.call('/api/shares', 'POST', { docs: [], minutes: 15 })).status, 400);
  assert.equal((await s.call('/api/shares', 'POST', { docs: ['nope'], minutes: 15 })).status, 400);
  for (const minutes of [15]) assert.equal((await s.call('/api/shares', 'POST', { docs: ['L21'], minutes })).status, 201);
  s.close();
});

test('test mode allows a 1-minute share, normal mode does not', async () => {
  const s = await start({ testMode: true });
  assert.equal((await s.call('/api/shares', 'POST', { docs: ['L21'], minutes: 1 })).status, 201);
  s.close();
});

test('unknown links are 404 and logged nowhere; guessing is slowed down', async () => {
  const s = await start();
  assert.equal((await s.anon('/api/s/aaaaaaaaaaaaaa')).status, 404);
  let last;
  for (let i = 0; i < 40; i++) last = (await s.anon('/api/s/zzzzzzzzzzzz' + i)).status;
  assert.equal(last, 429);
  s.close();
});

test('shares survive a restart (file store)', async () => {
  const storePath = join(mkdtempSync(join(tmpdir(), 'abh-')), 'store.json');
  const a = await start({ storePath });
  const c = await a.call('/api/shares', 'POST', { docs: ['L21'], minutes: 15 });
  a.close();
  const b = await start({ storePath, num: '9841000002' });
  assert.equal((await b.anon('/api/s/' + c.json.id)).status, 200);
  b.close();
});

test('the doctor response carries only printed values (no advice fields)', async () => {
  const s = await start();
  const c = await s.call('/api/shares', 'POST', { docs: ['L22'], minutes: 15 });
  const r = await s.anon('/api/s/' + c.json.id);
  const keys = new Set(r.json.docs.flatMap(d => d.results.flatMap(x => Object.keys(x))));
  assert.deepEqual([...keys].sort(), ['flag', 'img', 'range', 'test', 'unit', 'value']);
  s.close();
});

test('records are per account: new accounts start empty, SAMPLE papers go only to the account that asks, and shares only use the owner\'s papers', async () => {
  const s = await start({ empty: true });
  const empty = await s.call('/api/record');
  assert.deepEqual(empty.json.docs, []);
  // sharing with nothing in the record is refused
  assert.equal((await s.call('/api/shares', 'POST', { docs: ['L21'], minutes: 15 })).status, 400);
  const a = await s.call('/api/record/sample', 'POST', {});
  assert.equal(a.status, 200);
  const n = a.json.docs.length;
  assert.ok(n > 0 && a.json.docs.every(d => d.origin === 'sample'));
  assert.equal((await s.call('/api/record/sample', 'POST', {})).json.docs.length, n); // asking twice adds nothing
  // a second person
  const other = s.phone();
  await s.signUp(other, '9841000002');
  assert.deepEqual((await other.call('/api/record')).json.docs, []); // sees none of the first account's papers
  assert.equal((await other.call('/api/shares', 'POST', { docs: ['L21'], minutes: 15, pin: PIN })).status, 400); // cannot share what is not in own record
  // label: trimmed, capped at 40, only for its owner
  const l = await s.call('/api/record/label', 'POST', { label: '  Aama   Maya  ' + 'x'.repeat(60) });
  assert.equal(l.json.label.length, 40);
  assert.equal(l.json.label.startsWith('Aama Maya x'), true);
  assert.equal((await other.call('/api/record')).json.label, '');
  // the owner's share opens and shows only the owner's chosen paper
  const c = await s.call('/api/shares', 'POST', { docs: [a.json.docs[0].id], minutes: 15 });
  assert.equal(c.status, 201);
  const r = await s.anon('/api/s/' + c.json.id);
  assert.deepEqual(r.json.docs.map(d => d.id), [a.json.docs[0].id]);
  // signed out: no record
  assert.equal((await s.anon('/api/record')).status, 401);
  s.close();
});
