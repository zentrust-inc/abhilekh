import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server.mjs';
import { memorySender, akashSender } from '../sms.mjs';
import { normalisePhone, pinProblem } from '../auth.mjs';

const PIN = '482915';
async function start(opts = {}) {
  let t = Date.parse('2026-11-21T10:00:00Z');
  const clock = { now: () => t, advance: min => { t += min * 60000; } };
  const sms = opts.sms || memorySender();
  const app = createApp({ now: clock.now, sms, secureCookies: false, ...opts });
  const srv = http.createServer(app.handler);
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const phone = () => {
    const jar = {};
    const call = async (p, method = 'GET', body, headers = {}) => {
      const h = { ...headers };
      if (body !== undefined && !h['content-type']) h['content-type'] = 'application/json';
      const ck = Object.entries(jar).filter(([, v]) => v).map(([k, v]) => k + '=' + v).join('; ');
      if (ck) h.cookie = ck;
      const r = await fetch(base + p, { method, headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
      for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
      return { status: r.status, json: await r.json().catch(() => null), cookies: r.headers.getSetCookie() };
    };
    return { call, jar };
  };
  const lastCode = num => sms.sent.filter(m => m.to === num).at(-1).text.match(/\d{6}/)[0];
  const signUp = async (ph, num, pin = PIN) => {
    const c = await ph.call('/api/auth/code', 'POST', { phone: num });
    assert.equal(c.status, 200, JSON.stringify(c.json));
    const v = await ph.call('/api/auth/verify', 'POST', { phone: num, code: lastCode(num) });
    assert.equal(v.status, 200);
    const p = await ph.call('/api/auth/pin', 'POST', { ticket: v.json.ticket, pin });
    assert.equal(p.status, 200, JSON.stringify(p.json));
    return { verify: v.json, me: p.json };
  };
  return { clock, sms, phone, signUp, lastCode, close: () => { srv.closeAllConnections(); srv.close(); } };
}

test('phone numbers: Nepal mobiles only, in the usual ways of writing them', () => {
  for (const ok of ['9841234567', '+977 984-123-4567', '977 9712345678', '9612345678']) assert.ok(normalisePhone(ok), ok);
  for (const bad of ['', '984123456', '98412345678', '0141234567', '+91 9841234567', 'abc']) assert.equal(normalisePhone(bad), null, bad);
});

test('PINs: 6 digits, and not the ones everyone tries first', () => {
  for (const bad of ['12345', '1234567', 'abcdef', '111111', '123456', '654321', '890123', '123123']) assert.ok(pinProblem(bad), bad);
  for (const ok of ['482915', '190375']) assert.equal(pinProblem(ok), null, ok);
});

test('signed out: no record and no shares; the doctor link needs no account', async () => {
  const s = await start();
  const anon = s.phone();
  assert.equal((await anon.call('/api/record')).status, 401);
  assert.equal((await anon.call('/api/shares')).status, 401);
  assert.equal((await anon.call('/api/shares', 'POST', { docs: ['L21'], minutes: 60, pin: PIN })).status, 401);
  const me = s.phone();
  await s.signUp(me, '9841000001');
  const c = await me.call('/api/shares', 'POST', { docs: ['L21'], minutes: 60, pin: PIN });
  assert.equal(c.status, 201);
  assert.equal((await s.phone().call('/api/s/' + c.json.id)).status, 200);
  s.close();
});

test('sign-up sends one SMS, the code works once, and the session cookie is HttpOnly and SameSite=Strict', async () => {
  const s = await start();
  const me = s.phone();
  const r = await s.signUp(me, '9841000001');
  assert.equal(r.verify.isNew, true);
  assert.equal(s.sms.sent.length, 1);
  assert.doesNotMatch(s.sms.sent[0].text, /result|report|test|blood|sugar/i); // no health content in the SMS
  assert.equal((await me.call('/api/me')).json.phone, '984****001');
  const again = await me.call('/api/auth/verify', 'POST', { phone: '9841000001', code: s.lastCode('9841000001') });
  assert.equal(again.status, 400);
  s.close();
  // cookie flags, on a server with secure cookies (the default)
  const t = await start({ secureCookies: true });
  const ph = t.phone();
  await ph.call('/api/auth/code', 'POST', { phone: '9841000009' });
  const v = await ph.call('/api/auth/verify', 'POST', { phone: '9841000009', code: t.lastCode('9841000009') });
  const p = await ph.call('/api/auth/pin', 'POST', { ticket: v.json.ticket, pin: PIN });
  for (const c of p.cookies) { assert.match(c, /HttpOnly/); assert.match(c, /SameSite=Strict/); assert.match(c, /Secure/); }
  t.close();
});

test('a wrong code: 5 tries, then the code is dead; a code ends after 10 minutes', async () => {
  const s = await start();
  const me = s.phone();
  await me.call('/api/auth/code', 'POST', { phone: '9841000001' });
  const real = s.lastCode('9841000001');
  const wrong = real === '000000' ? '000001' : '000000';
  for (let i = 0; i < 5; i++) assert.equal((await me.call('/api/auth/verify', 'POST', { phone: '9841000001', code: wrong })).status, 400);
  assert.equal((await me.call('/api/auth/verify', 'POST', { phone: '9841000001', code: real })).status, 400);
  s.clock.advance(2);
  await me.call('/api/auth/code', 'POST', { phone: '9841000001' });
  s.clock.advance(11);
  assert.equal((await me.call('/api/auth/verify', 'POST', { phone: '9841000001', code: s.lastCode('9841000001') })).status, 400);
  s.close();
});

test('SMS limits: one a minute, 3 an hour, 5 a day per number; 10 an hour per connection; a daily cap', async () => {
  const s = await start({ authLimits: { dailyCap: 12 } });
  const ph = s.phone();
  const ask = num => ph.call('/api/auth/code', 'POST', { phone: num });
  assert.equal((await ask('9841000001')).status, 200);
  assert.equal((await ask('9841000001')).status, 429); // cooldown
  s.clock.advance(2); assert.equal((await ask('9841000001')).status, 200);
  s.clock.advance(2); assert.equal((await ask('9841000001')).status, 200);
  s.clock.advance(2); assert.equal((await ask('9841000001')).status, 429); // 3 an hour
  s.clock.advance(61); assert.equal((await ask('9841000001')).status, 200);
  s.clock.advance(2); assert.equal((await ask('9841000001')).status, 200);
  s.clock.advance(61); assert.equal((await ask('9841000001')).status, 429); // 5 a day
  assert.equal(s.sms.sent.length, 5);
  for (let i = 0; i < 10; i++) assert.equal((await ask('98420000' + String(i).padStart(2, '0'))).status, i < 7 ? 200 : 503); // daily cap of 12
  s.close();
  const t = await start();
  const p2 = t.phone();
  for (let i = 0; i < 10; i++) assert.equal((await p2.call('/api/auth/code', 'POST', { phone: '98430000' + String(i).padStart(2, '0') })).status, 200);
  assert.equal((await p2.call('/api/auth/code', 'POST', { phone: '9843000099' })).status, 429); // 10 an hour from one connection
  t.close();
});

test('weak PIN refused at sign-up; PIN sign-in works on the same phone, not on another', async () => {
  const s = await start();
  const me = s.phone();
  await me.call('/api/auth/code', 'POST', { phone: '9841000001' });
  const v = await me.call('/api/auth/verify', 'POST', { phone: '9841000001', code: s.lastCode('9841000001') });
  assert.equal((await me.call('/api/auth/pin', 'POST', { ticket: v.json.ticket, pin: '123456' })).status, 400);
  assert.equal((await me.call('/api/auth/pin', 'POST', { ticket: v.json.ticket, pin: PIN })).status, 200);
  assert.equal((await me.call('/api/auth/logout', 'POST', {})).status, 200);
  assert.equal((await me.call('/api/me')).status, 401);
  assert.equal((await me.call('/api/auth/login', 'POST', { phone: '9841000001', pin: PIN })).status, 200);
  assert.equal((await me.call('/api/me')).status, 200);
  const other = s.phone();
  const r = await other.call('/api/auth/login', 'POST', { phone: '9841000001', pin: PIN });
  assert.equal(r.status, 403); assert.equal(r.json.needCode, true);
  const unknown = await other.call('/api/auth/login', 'POST', { phone: '9800000000', pin: PIN });
  assert.deepEqual(unknown, { ...unknown, status: 403, json: r.json }); // same answer: the number's existence is not revealed
  assert.equal(s.sms.sent.length, 1); // no SMS for ordinary sign-in
  s.close();
});

test('wrong PINs: 5 means a 15-minute wait, 10 means a code by SMS', async () => {
  const s = await start();
  const me = s.phone();
  await s.signUp(me, '9841000001');
  await me.call('/api/auth/logout', 'POST', {});
  const login = pin => me.call('/api/auth/login', 'POST', { phone: '9841000001', pin });
  for (let i = 0; i < 4; i++) assert.equal((await login('000001')).status, 401);
  assert.equal((await login('000001')).status, 423);
  assert.equal((await login(PIN)).status, 423); // even the right PIN waits
  s.clock.advance(16);
  for (let i = 0; i < 4; i++) assert.equal((await login('000001')).status, 401);
  const hard = await login('000001');
  assert.equal(hard.status, 423); assert.equal(hard.json.needCode, true);
  s.clock.advance(60 * 24);
  assert.equal((await login(PIN)).status, 423); // time does not unlock it
  const r = await s.signUp(me, '9841000001', '590284'); // SMS recovery sets a new PIN
  assert.equal(r.verify.isNew, false);
  assert.equal((await me.call('/api/me')).status, 200);
  s.close();
});

test('PIN is asked again to create and to stop a share', async () => {
  const s = await start();
  const me = s.phone();
  await s.signUp(me, '9841000001');
  assert.equal((await me.call('/api/shares', 'POST', { docs: ['L21'], minutes: 60 })).status, 400);
  assert.equal((await me.call('/api/shares', 'POST', { docs: ['L21'], minutes: 60, pin: '000001' })).status, 401);
  const c = await me.call('/api/shares', 'POST', { docs: ['L21'], minutes: 60, pin: PIN });
  assert.equal(c.status, 201);
  assert.equal((await me.call('/api/shares/' + c.json.id + '/stop', 'POST', {})).status, 400);
  assert.equal((await me.call('/api/shares/' + c.json.id + '/stop', 'POST', { pin: '000001' })).status, 401);
  assert.equal((await me.call('/api/shares/' + c.json.id + '/stop', 'POST', { pin: PIN })).json.state, 'revoked');
  s.close();
});

test('each account sees and stops only its own shares', async () => {
  const s = await start();
  const a = s.phone(), b = s.phone();
  await s.signUp(a, '9841000001');
  await s.signUp(b, '9841000002');
  const c = await a.call('/api/shares', 'POST', { docs: ['L21'], minutes: 60, pin: PIN });
  assert.equal((await b.call('/api/shares')).json.shares.length, 0);
  assert.equal((await b.call('/api/shares/' + c.json.id + '/stop', 'POST', { pin: PIN })).status, 404);
  assert.equal((await a.call('/api/shares')).json.shares.length, 1);
  s.close();
});

test('recovery on a new phone: old phone signed out, new shares paused 24 hours, stopping still works', async () => {
  const s = await start();
  const oldPh = s.phone(), newPh = s.phone();
  await s.signUp(oldPh, '9841000001');
  const c = await oldPh.call('/api/shares', 'POST', { docs: ['L21'], minutes: 10080, pin: PIN });
  s.clock.advance(5);
  const r = await s.signUp(newPh, '9841000001', '590284');
  assert.equal(r.verify.isNew, false);
  assert.ok(r.me.sharesPausedUntil);
  assert.equal((await oldPh.call('/api/me')).status, 401); // old session ended
  assert.equal((await oldPh.call('/api/auth/login', 'POST', { phone: '9841000001', pin: '590284' })).status, 403); // old phone forgotten
  assert.equal((await newPh.call('/api/shares', 'POST', { docs: ['L21'], minutes: 60, pin: '590284' })).status, 403);
  assert.equal((await newPh.call('/api/shares/' + c.json.id + '/stop', 'POST', { pin: '590284' })).json.state, 'revoked');
  s.clock.advance(24 * 60 + 1);
  assert.equal((await newPh.call('/api/shares', 'POST', { docs: ['L21'], minutes: 60, pin: '590284' })).status, 201);
  s.close();
});

test('nothing secret is stored in plain text', async () => {
  const storePath = join(mkdtempSync(join(tmpdir(), 'abh-')), 'store.json');
  const s = await start({ storePath });
  const me = s.phone();
  await me.call('/api/auth/code', 'POST', { phone: '9841000001' });
  const code = s.lastCode('9841000001');
  const v = await me.call('/api/auth/verify', 'POST', { phone: '9841000001', code });
  await me.call('/api/auth/pin', 'POST', { ticket: v.json.ticket, pin: PIN });
  const raw = readFileSync(storePath, 'utf8');
  for (const secret of [code, PIN, v.json.ticket, me.jar.abh_s, me.jar.abh_d]) assert.ok(!raw.includes(secret), 'found ' + secret);
  s.close();
});

test('POSTs must be JSON (no cross-site form posts)', async () => {
  const s = await start();
  const me = s.phone();
  assert.equal((await me.call('/api/auth/code', 'POST', 'phone=9841000001', { 'content-type': 'application/x-www-form-urlencoded' })).status, 415);
  s.close();
});

test('the code is shown on screen only in test mode with no real SMS sender', async () => {
  const a = await start();
  assert.equal((await a.phone().call('/api/auth/code', 'POST', { phone: '9841000001' })).json.testCode, undefined);
  a.close();
  const b = await start({ testMode: true });
  assert.match((await b.phone().call('/api/auth/code', 'POST', { phone: '9841000001' })).json.testCode, /^\d{6}$/);
  b.close();
  const fake = { name: 'akash', sent: [], async send(to, text) { this.sent.push({ to, text }); return { ok: true }; } };
  const c = await start({ testMode: true, sms: fake });
  assert.equal((await c.phone().call('/api/auth/code', 'POST', { phone: '9841000001' })).json.testCode, undefined);
  c.close();
});

test('Akash sender: posts auth_token, to and text as a form; reports an error reply as a failure', async () => {
  const calls = [];
  const ok = akashSender({ token: 'T', fetchImpl: async (url, o) => { calls.push({ url, o }); return { ok: true, status: 200, json: async () => ({ error: false, message: '1 messages has been queued for delivery.', data: { valid: [{ id: 1, mobile: '9779841000001', credit: 1, network: 'ntc', status: 'queued' }], invalid: [] } }) }; } });
  assert.deepEqual(await ok.send('9841000001', 'hi'), { ok: true, credit: 1, network: 'ntc' });
  assert.equal(calls[0].url, 'https://sms.aakashsms.com/sms/v3/send/');
  assert.equal(calls[0].o.method, 'POST');
  assert.deepEqual(Object.fromEntries(new URLSearchParams(calls[0].o.body)), { auth_token: 'T', to: '9841000001', text: 'hi' });
  const bad = akashSender({ token: 'T', fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ error: true, message: 'The provided Auth Token is not valid.', data: [] }) }) });
  const r = await bad.send('9841000001', 'hi');
  assert.equal(r.ok, false); assert.match(r.reason, /Auth Token/); assert.doesNotMatch(r.reason, /\bT\b/);
  const aborted = akashSender({ token: 'T', fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ error: false, message: '0 messages', data: { valid: [], invalid: [{ mobile: '984100', credit: 0, network: 'N/A', status: 'aborted' }] } }) }) });
  assert.equal((await aborted.send('9841000001', 'hi')).ok, false); // error:false but nothing queued is a failure
  assert.throws(() => akashSender({ token: '' }));
});

test('a failed SMS is a plain error, not a crash', async () => {
  const s = await start({ sms: { name: 'akash', async send() { return { ok: false, reason: 'akash: no credit' }; } } });
  const r = await s.phone().call('/api/auth/code', 'POST', { phone: '9841000001' });
  assert.equal(r.status, 502);
  s.close();
});
