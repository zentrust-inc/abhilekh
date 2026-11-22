import { test, after as afterAll } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server.mjs';
import { memorySender, akashSender, noSender } from '../sms.mjs';
import { memoryMail, noMail } from '../mail.mjs';
import { normalisePhone, normaliseEmail, maskEmail, identify, pinProblem } from '../auth.mjs';

const PIN = '482915';
async function start(opts = {}) {
  let t = Date.parse('2026-11-21T10:00:00Z');
  const clock = { now: () => t, advance: min => { t += min * 60000; } };
  const sms = opts.sms || memorySender();
  const app = createApp({ now: clock.now, sms, secureCookies: false, seedSample: true, ...opts });
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
      const r = await fetch(base + p, { method, headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)), redirect: 'manual' });
      for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
      return { status: r.status, json: await r.json().catch(() => null), cookies: r.headers.getSetCookie(), location: r.headers.get('location') };
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

test('PIN is asked again to create a share; stopping needs none', async () => {
  const s = await start();
  const me = s.phone();
  await s.signUp(me, '9841000001');
  assert.equal((await me.call('/api/shares', 'POST', { docs: ['L21'], minutes: 60 })).status, 400);
  assert.equal((await me.call('/api/shares', 'POST', { docs: ['L21'], minutes: 60, pin: '000001' })).status, 401);
  const c = await me.call('/api/shares', 'POST', { docs: ['L21'], minutes: 60, pin: PIN });
  assert.equal(c.status, 201);
  assert.equal((await me.call('/api/shares/' + c.json.id + '/stop', 'POST', {})).json.state, 'revoked'); // stopping only removes access: no PIN
  assert.equal((await s.phone().call('/api/shares/' + c.json.id + '/stop', 'POST', {})).status, 401); // but still only for a signed-in account
  s.close();
});

test('a returning phone is greeted (masked), signs in with the PIN alone; a new phone is not greeted', async () => {
  const s = await start();
  const me = s.phone();
  await s.signUp(me, '9841000001');
  const h = await me.call('/api/auth/hello');
  assert.deepEqual(h.json, { known: true, label: '984****001', kind: 'phone', passkeys: 0 });
  await me.call('/api/auth/logout', 'POST', {});
  assert.equal((await me.call('/api/me')).status, 401);
  assert.equal((await me.call('/api/auth/hello')).json.known, true); // signed out, but the phone is still recognised
  assert.equal((await me.call('/api/auth/login', 'POST', { pin: '000001' })).status, 401); // wrong PIN, no number needed
  assert.equal((await me.call('/api/auth/login', 'POST', { pin: PIN })).status, 200);
  assert.equal((await me.call('/api/me')).status, 200);
  const stranger = s.phone();
  assert.deepEqual((await stranger.call('/api/auth/hello')).json, { known: false });
  assert.equal((await stranger.call('/api/auth/login', 'POST', { pin: PIN })).status, 403); // no device, no PIN-only login
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

test('with no SMS service set up, asking for a code says so and nothing is counted', async () => {
  const s = await start({ sms: noSender() });
  const r = await s.phone().call('/api/auth/code', 'POST', { phone: '9841000001' });
  assert.equal(r.status, 503);
  assert.match(r.json.error, /not switched on/);
  s.close();
});

test('a failed SMS is a plain error, not a crash', async () => {
  const s = await start({ sms: { name: 'akash', async send() { return { ok: false, reason: 'akash: no credit' }; } } });
  const r = await s.phone().call('/api/auth/code', 'POST', { phone: '9841000001' });
  assert.equal(r.status, 502);
  s.close();
});

const toClose = [];
const after = s => toClose.push(s);
afterAll(() => toClose.forEach(s => s.close()));

// ---------- email sign-in (one account per sign-in method) ----------
const mailCode = (mail, addr) => mail.sent.filter(m => m.to === addr).at(-1).text.match(/\d{6}/)[0];
async function emailSignUp(t, mail, ph, addr, pin = PIN) {
  const c = await ph.call('/api/auth/code', 'POST', { id: addr });
  assert.equal(c.status, 200, JSON.stringify(c.json));
  const v = await ph.call('/api/auth/verify', 'POST', { id: addr, code: mailCode(mail, addr.trim().toLowerCase()) });
  assert.equal(v.status, 200, JSON.stringify(v.json));
  const p = await ph.call('/api/auth/pin', 'POST', { ticket: v.json.ticket, pin });
  assert.equal(p.status, 200, JSON.stringify(p.json));
  return { verify: v.json, me: p.json };
}

test('email addresses: lower-cased, one @, a dot in the domain; dots and +tags are kept; masked for display', () => {
  assert.equal(normaliseEmail('  Asha.K+abh@Example.COM '), 'asha.k+abh@example.com');
  for (const bad of ['', 'asha', 'asha@', '@example.com', 'a b@example.com', 'a@b', 'a@@b.com', 'a@b..com', 'a@.com', 'x'.repeat(65) + '@example.com']) assert.equal(normaliseEmail(bad), null, bad);
  assert.equal(maskEmail('asha@example.com'), 'a***@example.com');
  assert.deepEqual(identify({ id: 'Asha@Example.com' }), { key: 'email:asha@example.com', kind: 'email', value: 'asha@example.com' });
  assert.deepEqual(identify({ id: '+977 984-1000001' }), { key: 'phone:9841000001', kind: 'phone', value: '9841000001' });
  assert.deepEqual(identify({ phone: '9841000001' }), { key: 'phone:9841000001', kind: 'phone', value: '9841000001' }); // older callers
  assert.ok(identify({ id: '12345' }).error);
  assert.ok(identify({ id: 'asha@' }).error);
});

test('email sign-up: one code by mail, then a PIN; no SMS is sent; the mail has no health content', async () => {
  const mail = memoryMail(), s = await start({ mail }); after(s);
  const me = s.phone();
  const r = await emailSignUp(s, mail, me, 'Asha@Example.com');
  assert.equal(r.verify.isNew, true);
  assert.equal(r.me.email, 'a***@example.com');
  assert.equal(r.me.label, 'a***@example.com');
  assert.equal(r.me.kind, 'email');
  assert.equal(r.me.phone, undefined);
  assert.equal(mail.sent.length, 1);
  assert.equal(s.sms.sent.length, 0);
  assert.equal(mail.sent[0].subject, 'Your Abhilekh sign-in code');
  assert.doesNotMatch(mail.sent[0].text + mail.sent[0].subject, /result|report|test|blood|sugar|patient|record/i);
  assert.equal((await me.call('/api/me')).json.email, 'a***@example.com');
  // the code works once
  const again = await me.call('/api/auth/verify', 'POST', { id: 'asha@example.com', code: mailCode(mail, 'asha@example.com') });
  assert.equal(again.status, 400);
});

test('email accounts: PIN on the same device, not on another; an unknown address looks the same as a new device', async () => {
  const mail = memoryMail(), s = await start({ mail }); after(s);
  const me = s.phone();
  await emailSignUp(s, mail, me, 'asha@example.com');
  assert.equal((await me.call('/api/auth/login', 'POST', { id: 'ASHA@example.com', pin: PIN })).status, 200);
  const other = s.phone();
  const r = await other.call('/api/auth/login', 'POST', { id: 'asha@example.com', pin: PIN });
  assert.equal(r.status, 403); assert.equal(r.json.needCode, true); assert.match(r.json.error, /email/);
  const unknown = await other.call('/api/auth/login', 'POST', { id: 'nobody@example.com', pin: PIN });
  assert.equal(unknown.status, 403); assert.equal(unknown.json.error, r.json.error);
  assert.equal(mail.sent.length, 1); // no mail for ordinary sign-in
});

test('one account per sign-in method: a phone account and an email account do not share shares or PINs', async () => {
  const mail = memoryMail(), s = await start({ mail }); after(s);
  const a = s.phone(), b = s.phone();
  await s.signUp(a, '9841000001');
  await emailSignUp(s, mail, b, 'asha@example.com', '590284');
  const made = await a.call('/api/shares', 'POST', { docs: ['L21'], minutes: 60, who: '', pin: PIN });
  assert.equal(made.status, 201);
  assert.equal((await b.call('/api/shares')).json.shares.length, 0); // the email account cannot see the phone account's share
  assert.equal((await b.call('/api/shares/' + made.json.id + '/stop', 'POST', { pin: '590284' })).status, 404);
  assert.equal((await a.call('/api/shares')).json.shares.length, 1);
});

test('email recovery: new device signs the old one out and pauses new shares 24 hours; the message says email, not SMS', async () => {
  const mail = memoryMail(), s = await start({ mail }); after(s);
  const oldDev = s.phone(), newDev = s.phone();
  await emailSignUp(s, mail, oldDev, 'asha@example.com');
  s.clock.advance(2);
  const r = await emailSignUp(s, mail, newDev, 'asha@example.com', '590284');
  assert.equal(r.verify.isNew, false);
  assert.notEqual(r.me.sharesPausedUntil, null);
  assert.equal((await oldDev.call('/api/me')).status, 401);
  assert.equal((await oldDev.call('/api/auth/login', 'POST', { id: 'asha@example.com', pin: '590284' })).status, 403);
  // wrong PINs point to email for recovery
  let last;
  for (let i = 0; i < 10; i++) { if (i === 5) s.clock.advance(16); last = await newDev.call('/api/auth/login', 'POST', { id: 'asha@example.com', pin: '111112' }); }
  assert.equal(last.status, 423); assert.match(last.json.error, /by email/);
});

test('email limits: one a minute, 3 an hour, 5 a day per address; the connection limit is shared with SMS; a separate daily cap', async () => {
  const mail = memoryMail(), s = await start({ mail }); after(s);
  const ph = s.phone();
  const ask = id => ph.call('/api/auth/code', 'POST', { id });
  assert.equal((await ask('a@example.com')).status, 200);
  assert.equal((await ask('A@example.com')).status, 429); // same address, any capitals
  s.clock.advance(1.1); assert.equal((await ask('a@example.com')).status, 200);
  s.clock.advance(1.1); assert.equal((await ask('a@example.com')).status, 200);
  s.clock.advance(1.1); assert.equal((await ask('a@example.com')).status, 429); // 3 an hour
  assert.equal(mail.sent.length, 3);
  const t = await start({ mail: memoryMail(), authLimits: { emailDailyCap: 2 } }); after(t);
  const p2 = t.phone();
  for (const n of ['x1', 'x2']) assert.equal((await p2.call('/api/auth/code', 'POST', { id: n + '@example.com' })).status, 200);
  assert.equal((await p2.call('/api/auth/code', 'POST', { id: 'x3@example.com' })).status, 503);
  // SMS still works when the email cap is used up
  assert.equal((await p2.call('/api/auth/code', 'POST', { id: '9841000001' })).status, 200);
});

test('wrong email codes: 5 tries then the code is dead', async () => {
  const mail = memoryMail(), s = await start({ mail }); after(s);
  const me = s.phone();
  await me.call('/api/auth/code', 'POST', { id: 'asha@example.com' });
  const real = mailCode(mail, 'asha@example.com'); const wrong = real === '000000' ? '000001' : '000000';
  for (let i = 0; i < 5; i++) assert.equal((await me.call('/api/auth/verify', 'POST', { id: 'asha@example.com', code: wrong })).status, 400);
  assert.equal((await me.call('/api/auth/verify', 'POST', { id: 'asha@example.com', code: real })).status, 400);
});

test('with no email service set up, asking for a code by email says so and nothing is counted; SMS is unaffected', async () => {
  const s = await start({ mail: noMail() }); after(s);
  const r = await s.phone().call('/api/auth/code', 'POST', { id: 'asha@example.com' });
  assert.equal(r.status, 503); assert.match(r.json.error, /email/);
  assert.equal(s.sms.sent.length, 0);
  assert.equal((await s.phone().call('/api/auth/code', 'POST', { id: '9841000001' })).status, 200);
});

test('a failed email is a plain error, not a crash', async () => {
  const bad = { name: 'acs', async send() { return { ok: false, reason: 'acs: HTTP 429' }; } };
  const s = await start({ mail: bad }); after(s);
  const r = await s.phone().call('/api/auth/code', 'POST', { id: 'asha@example.com' });
  assert.equal(r.status, 502); assert.match(r.json.error, /email could not be sent/);
});

test('the code is shown on screen only in test mode with the in-memory mail sender', async () => {
  const a = await start({ testMode: true, mail: memoryMail() }); after(a);
  assert.match((await a.phone().call('/api/auth/code', 'POST', { id: 'asha@example.com' })).json.testCode, /^\d{6}$/);
  const fake = { name: 'acs', async send() { return { ok: true }; } };
  const b = await start({ testMode: true, mail: fake }); after(b);
  assert.equal((await b.phone().call('/api/auth/code', 'POST', { id: 'asha@example.com' })).json.testCode, undefined);
  const c = await start({ mail: memoryMail() }); after(c);
  assert.equal((await c.phone().call('/api/auth/code', 'POST', { id: 'asha@example.com' })).json.testCode, undefined);
});

test('a store written before email existed (keyed by phone) still signs in', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'abh-'));
  const storePath = join(dir, 'store.json');
  const s1 = await start({ storePath }); 
  const me = s1.phone();
  await s1.signUp(me, '9841000001');
  const saved = JSON.parse(readFileSync(storePath, 'utf8'));
  s1.close();
  // rewrite the file the old way: no key, no kind
  for (const a of saved.accounts) { delete a.key; delete a.kind; }
  for (const x of saved.smsLog) { x.phone = x.key.slice(6); delete x.key; delete x.kind; }
  (await import('node:fs')).writeFileSync(storePath, JSON.stringify(saved));
  const s2 = await start({ storePath }); after(s2);
  const again = s2.phone(); again.jar.abh_d = me.jar.abh_d;
  assert.equal((await again.call('/api/auth/login', 'POST', { phone: '9841000001', pin: PIN })).status, 200);
  assert.equal((await again.call('/api/me')).json.phone, '984****001');
});

// ---------- Google sign-in ----------
const jwt = claims => 'e30.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.sig';
function fakeGoogle() {
  const g = { clientId: 'cid.apps.googleusercontent.com', clientSecret: 'secret-not-real', redirectUri: 'https://app.abhilekh.org/api/auth/google/callback', calls: [], next: null };
  g.fetchImpl = async (url, init) => {
    g.calls.push({ url, body: new URLSearchParams(init.body) });
    if (!g.next) return { ok: false, status: 400, json: async () => ({ error: 'invalid_grant' }) };
    return { ok: true, status: 200, json: async () => ({ id_token: jwt(g.next()) }) };
  };
  return g;
}
// Runs start, then the callback Google would send the browser to, for the claims given.
async function googleRound(s, g, br, claims = {}, { intent, code = 'abc', mutate } = {}) {
  const st = await br.call('/api/auth/google/start' + (intent ? '?intent=' + intent : ''));
  assert.equal(st.status, 302);
  const u = new URL(st.location);
  g.next = () => ({ iss: 'https://accounts.google.com', aud: g.clientId, sub: '1001', email: 'asha@gmail.com', email_verified: true, exp: Math.floor(s.clock.now() / 1000) + 3600, nonce: u.searchParams.get('nonce'), ...claims });
  if (mutate) mutate(u);
  return { start: st, url: u, cb: await br.call('/api/auth/google/callback?code=' + code + '&state=' + (u.searchParams.get('state'))) };
}

test('Google off: the options say so, and start answers plainly', async () => {
  const s = await start(); after(s);
  const br = s.phone();
  assert.deepEqual((await br.call('/api/auth/options')).json, { sms: true, email: true, google: false, passkey: false });
  assert.equal((await br.call('/api/auth/google/start')).status, 503);
  const n = await start({ sms: noSender(), mail: noMail() }); after(n);
  assert.deepEqual((await n.phone().call('/api/auth/options')).json, { sms: false, email: false, google: false, passkey: false });
});

test('Google start: redirects to Google with only openid email, a state and a nonce, and binds the state to this browser', async () => {
  const g = fakeGoogle(), s = await start({ google: g }); after(s);
  const br = s.phone();
  assert.equal((await br.call('/api/auth/options')).json.google, true);
  const st = await br.call('/api/auth/google/start');
  assert.equal(st.status, 302);
  const u = new URL(st.location);
  assert.equal(u.origin + u.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(u.searchParams.get('client_id'), g.clientId);
  assert.equal(u.searchParams.get('redirect_uri'), g.redirectUri);
  assert.equal(u.searchParams.get('response_type'), 'code');
  assert.equal(u.searchParams.get('scope'), 'openid email');
  assert.ok(u.searchParams.get('state').length >= 30 && u.searchParams.get('nonce').length >= 30);
  const ck = st.cookies.find(c => c.startsWith('abh_gs='));
  assert.match(ck, /HttpOnly/); assert.match(ck, /SameSite=Lax/);
  assert.ok(ck.includes(u.searchParams.get('state')));
  assert.ok(!st.location.includes(g.clientSecret));
});

test('Google sign-up: new account sets a PIN once, then shares need that PIN; the email shown is masked', async () => {
  const g = fakeGoogle(), s = await start({ google: g }); after(s);
  const br = s.phone();
  const r = await googleRound(s, g, br);
  assert.equal(r.cb.status, 302); assert.equal(r.cb.location, '/?g=1');
  assert.equal(g.calls.length, 1);
  assert.equal(g.calls[0].url, 'https://oauth2.googleapis.com/token');
  assert.equal(g.calls[0].body.get('grant_type'), 'authorization_code');
  assert.equal(g.calls[0].body.get('client_secret'), g.clientSecret);
  assert.equal((await br.call('/api/me')).status, 401); // not signed in until the PIN is set
  const gt = r.cb.cookies.find(c => c.startsWith('abh_gt='));
  assert.match(gt, /HttpOnly/);
  const t = await br.call('/api/auth/google/ticket', 'POST', {});
  assert.equal(t.status, 200); assert.equal(t.json.isNew, true);
  assert.equal((await br.call('/api/auth/google/ticket', 'POST', {})).status, 400); // the cookie is gone
  const p = await br.call('/api/auth/pin', 'POST', { ticket: t.json.ticket, pin: PIN });
  assert.equal(p.status, 200);
  assert.equal(p.json.email, 'a***@gmail.com'); assert.equal(p.json.kind, 'google'); assert.equal(p.json.phone, undefined);
  assert.equal((await br.call('/api/shares', 'POST', { docs: ['L21'], minutes: 60 })).status, 400); // no PIN, no share
  assert.equal((await br.call('/api/shares', 'POST', { docs: ['L21'], minutes: 60, pin: PIN })).status, 201);
});

test('Google sign-in on another device: no code and no PIN to get in; the PIN is still asked for a share', async () => {
  const g = fakeGoogle(), s = await start({ google: g }); after(s);
  const a = s.phone();
  await googleRound(s, g, a);
  const t = await a.call('/api/auth/google/ticket', 'POST', {});
  await a.call('/api/auth/pin', 'POST', { ticket: t.json.ticket, pin: PIN });
  const b = s.phone();
  const r = await googleRound(s, g, b);
  assert.equal(r.cb.status, 302); assert.equal(r.cb.location, '/');
  assert.equal((await b.call('/api/me')).status, 200);
  assert.equal((await b.call('/api/me')).json.kind, 'google');
  assert.equal((await b.call('/api/shares', 'POST', { docs: ['L21'], minutes: 60 })).status, 400);
  assert.equal((await b.call('/api/shares', 'POST', { docs: ['L21'], minutes: 60, pin: PIN })).status, 201);
  assert.equal(s.sms.sent.length, 0);
});

test('forgotten PIN on a Google account: sign in with Google again, set a new PIN, other devices out, new shares paused 24 hours', async () => {
  const g = fakeGoogle(), s = await start({ google: g }); after(s);
  const old = s.phone(), nw = s.phone();
  await googleRound(s, g, old);
  await old.call('/api/auth/pin', 'POST', { ticket: (await old.call('/api/auth/google/ticket', 'POST', {})).json.ticket, pin: PIN });
  const r = await googleRound(s, g, nw, {}, { intent: 'reset' });
  assert.equal(r.cb.location, '/?g=1');
  const t = await nw.call('/api/auth/google/ticket', 'POST', {});
  assert.equal(t.json.isNew, false);
  const p = await nw.call('/api/auth/pin', 'POST', { ticket: t.json.ticket, pin: '590284' });
  assert.equal(p.status, 200); assert.notEqual(p.json.sharesPausedUntil, null);
  assert.equal((await old.call('/api/me')).status, 401);
  assert.equal((await nw.call('/api/shares', 'POST', { docs: ['L21'], minutes: 60, pin: '590284' })).status, 403);
  // reset for a Google account that does not exist is refused, nothing is created
  const stranger = s.phone();
  const x = await googleRound(s, g, stranger, { sub: '999', email: 'nobody@gmail.com' }, { intent: 'reset' });
  assert.equal(x.cb.location, '/?gerr=noaccount');
});

test('wrong PINs on a Google account point back to Google, not to SMS', async () => {
  const g = fakeGoogle(), s = await start({ google: g }); after(s);
  const br = s.phone();
  await googleRound(s, g, br);
  await br.call('/api/auth/pin', 'POST', { ticket: (await br.call('/api/auth/google/ticket', 'POST', {})).json.ticket, pin: PIN });
  let last;
  for (let i = 0; i < 5; i++) last = await br.call('/api/shares', 'POST', { docs: ['L21'], minutes: 60, pin: '111112' });
  assert.equal(last.status, 423); assert.match(last.json.error, /sign in with Google again/i); assert.doesNotMatch(last.json.error, /SMS/);
});

test('Google callback refuses: wrong or reused state, no cookie, cancelled, bad token, wrong audience or issuer, old token, wrong nonce, unverified email', async () => {
  const g = fakeGoogle(), s = await start({ google: g }); after(s);
  const expectErr = async (label, claims, opts, err) => {
    const r = await googleRound(s, g, s.phone(), claims, opts);
    assert.equal(r.cb.location, '/?gerr=' + err, label);
    assert.equal(r.cb.cookies.some(c => c.startsWith('abh_gt=') && !/Max-Age=0/.test(c)), false, label);
  };
  await expectErr('wrong audience', { aud: 'someone-else' }, {}, 'failed');
  await expectErr('wrong issuer', { iss: 'https://evil.example.com' }, {}, 'failed');
  await expectErr('expired token', { exp: 1 }, {}, 'failed');
  await expectErr('wrong nonce', { nonce: 'x'.repeat(32) }, {}, 'failed');
  await expectErr('no subject', { sub: '' }, {}, 'failed');
  await expectErr('unverified email', { email_verified: false }, {}, 'unverified');
  await expectErr('no email', { email: undefined }, {}, 'unverified');
  // state from another browser: the cookie does not match
  const a = s.phone(), b = s.phone();
  const st = await a.call('/api/auth/google/start'); g.next = () => ({});
  const state = new URL(st.location).searchParams.get('state');
  await b.call('/api/auth/google/start');
  assert.equal((await b.call('/api/auth/google/callback?code=c&state=' + state)).location, '/?gerr=expired');
  // unknown state, and no state at all
  assert.equal((await s.phone().call('/api/auth/google/callback?code=c&state=nope')).location, '/?gerr=expired');
  assert.equal((await s.phone().call('/api/auth/google/callback?code=c')).location, '/?gerr=expired');
  // the user pressed Cancel at Google
  const c = s.phone(); const cs = await c.call('/api/auth/google/start');
  assert.equal((await c.call('/api/auth/google/callback?error=access_denied&state=' + new URL(cs.location).searchParams.get('state'))).location, '/?gerr=cancelled');
  // Google's token endpoint refuses the code
  g.next = null;
  const d = s.phone(); const ds = await d.call('/api/auth/google/start');
  assert.equal((await d.call('/api/auth/google/callback?code=bad&state=' + new URL(ds.location).searchParams.get('state'))).location, '/?gerr=failed');
});

test('a Google state works once: replaying the callback gives nothing', async () => {
  const g = fakeGoogle(), s = await start({ google: g }); after(s);
  const br = s.phone();
  const r = await googleRound(s, g, br);
  assert.equal(r.cb.location, '/?g=1');
  const again = await br.call('/api/auth/google/callback?code=abc&state=' + r.url.searchParams.get('state'));
  assert.equal(again.location, '/?gerr=expired');
  assert.equal(g.calls.length, 1); // Google was not asked a second time
});

test('a Google state ends after 10 minutes', async () => {
  const g = fakeGoogle(), s = await start({ google: g }); after(s);
  const br = s.phone();
  const st = await br.call('/api/auth/google/start');
  s.clock.advance(11);
  const r = await br.call('/api/auth/google/callback?code=abc&state=' + new URL(st.location).searchParams.get('state'));
  assert.equal(r.location, '/?gerr=expired');
  assert.equal(g.calls.length, 0);
});

test('one account per sign-in method: a Google account and an email account with the same address are separate; the Google id decides, not the address', async () => {
  const g = fakeGoogle(), mail = memoryMail(), s = await start({ google: g, mail }); after(s);
  const a = s.phone(), b = s.phone();
  await googleRound(s, g, a, { sub: '1001', email: 'asha@gmail.com' });
  await a.call('/api/auth/pin', 'POST', { ticket: (await a.call('/api/auth/google/ticket', 'POST', {})).json.ticket, pin: PIN });
  assert.equal((await a.call('/api/shares', 'POST', { docs: ['L21'], minutes: 60, pin: PIN })).status, 201);
  await emailSignUp(s, mail, b, 'asha@gmail.com', '590284');
  assert.equal((await b.call('/api/shares')).json.shares.length, 0);
  // the same person changes their Google address: still the same account, shares still there
  const c = s.phone();
  const r = await googleRound(s, g, c, { sub: '1001', email: 'asha.new@gmail.com' });
  assert.equal(r.cb.location, '/');
  assert.equal((await c.call('/api/shares')).json.shares.length, 1);
  assert.equal((await c.call('/api/me')).json.email, 'a***@gmail.com');
  // a different Google id with the same address is a different account
  const d = s.phone();
  const r2 = await googleRound(s, g, d, { sub: '2002', email: 'asha@gmail.com' });
  assert.equal(r2.cb.location, '/?g=1');
});

test('Google start is slowed down for one connection', async () => {
  const g = fakeGoogle(), s = await start({ google: g }); after(s);
  const br = s.phone();
  for (let i = 0; i < 20; i++) assert.equal((await br.call('/api/auth/google/start')).status, 302);
  assert.equal((await br.call('/api/auth/google/start')).status, 429);
});

test('change PIN while signed in: needs the current PIN, keeps other devices signed in, does not pause sharing', async () => {
  const s = await start();
  const me = s.phone();
  await s.signUp(me, '9841000001');
  const second = s.phone();
  assert.equal((await me.call('/api/auth/pin/change', 'POST', { pin: PIN, newPin: '590284' })).status, 200); // sanity: a good change works
  // old PIN no longer works, new PIN does (shares ask for it)
  assert.equal((await me.call('/api/shares', 'POST', { docs: ['L21'], minutes: 60, pin: PIN })).status, 401);
  assert.equal((await me.call('/api/shares', 'POST', { docs: ['L21'], minutes: 60, pin: '590284' })).status, 201);
  // wrong current PIN is refused and counted; a run or a repeat is refused; no session means no change
  assert.equal((await me.call('/api/auth/pin/change', 'POST', { pin: '000001', newPin: '735128' })).status, 401);
  assert.equal((await me.call('/api/auth/pin/change', 'POST', { pin: '590284', newPin: '123456' })).status, 400);
  assert.equal((await me.call('/api/auth/pin/change', 'POST', { pin: '590284', newPin: '590284' })).status, 400);
  assert.equal((await second.call('/api/auth/pin/change', 'POST', { pin: '590284', newPin: '735128' })).status, 401);
  // the phone stays signed in and is still recognised by PIN alone
  assert.equal((await me.call('/api/me')).status, 200);
  await me.call('/api/auth/logout', 'POST', {});
  assert.equal((await me.call('/api/auth/login', 'POST', { pin: '590284' })).status, 200);
  assert.ok(!(await me.call('/api/me')).json.sharesPausedUntil); // no 24-hour pause after a normal change
  s.close();
});
