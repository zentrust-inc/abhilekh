import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { createApp } from '../server.mjs';
import { memorySender } from '../sms.mjs';

const PIN = '482915', RP = { id: 'app.abhilekh.test', origin: 'https://app.abhilekh.test' };
const sha = b => createHash('sha256').update(b).digest();
const b64u = b => Buffer.from(b).toString('base64url');

// A pretend phone: it holds a private key and answers the way a real authenticator does.
function fakeAuthenticator({ rpId = RP.id, origin = RP.origin } = {}) {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const credId = randomBytes(32);
  let counter = 0;
  const ad = (flags, withKey) => {
    const head = Buffer.concat([sha(rpId), Buffer.from([flags]), Buffer.alloc(4)]);
    head.writeUInt32BE(counter, 33);
    if (!withKey) return head;
    const len = Buffer.alloc(2); len.writeUInt16BE(credId.length);
    return Buffer.concat([head, Buffer.alloc(16), len, credId, Buffer.from([0xa5, 0x01, 0x02])]);
  };
  return {
    id: b64u(credId),
    create(challenge, { flags = 0x45, type = 'webauthn.create', o = origin } = {}) {
      const cd = Buffer.from(JSON.stringify({ type, challenge, origin: o }));
      return { id: b64u(credId), clientDataJSON: b64u(cd), authenticatorData: b64u(ad(flags, true)), publicKey: b64u(publicKey.export({ type: 'spki', format: 'der' })), publicKeyAlgorithm: -7 };
    },
    get(challenge, { flags = 0x05, bump = 1, key = privateKey, o = origin, type = 'webauthn.get' } = {}) {
      counter += bump;
      const cd = Buffer.from(JSON.stringify({ type, challenge, origin: o }));
      const a = ad(flags, false);
      return { id: b64u(credId), clientDataJSON: b64u(cd), authenticatorData: b64u(a), signature: b64u(sign('sha256', Buffer.concat([a, sha(cd)]), key)) };
    },
  };
}

async function start(opts = {}) {
  let t = Date.parse('2026-11-22T10:00:00Z');
  const sms = memorySender();
  const app = createApp({ now: () => t, sms, secureCookies: false, rp: RP, seedSample: true, ...opts });
  const srv = http.createServer(app.handler);
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const phone = () => {
    const jar = {};
    const call = async (p, method = 'GET', body) => {
      const h = {};
      if (body !== undefined) h['content-type'] = 'application/json';
      const ck = Object.entries(jar).filter(([, v]) => v).map(([k, v]) => k + '=' + v).join('; ');
      if (ck) h.cookie = ck;
      const r = await fetch(base + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
      for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
      return { status: r.status, json: await r.json().catch(() => null) };
    };
    return { call };
  };
  const signUp = async (ph, num, pin = PIN) => {
    assert.equal((await ph.call('/api/auth/code', 'POST', { phone: num })).status, 200);
    const code = sms.sent.filter(m => m.to === num).at(-1).text.match(/\d{6}/)[0];
    const v = await ph.call('/api/auth/verify', 'POST', { phone: num, code });
    const p = await ph.call('/api/auth/pin', 'POST', { ticket: v.json.ticket, pin });
    assert.equal(p.status, 200, JSON.stringify(p.json));
  };
  const turnOn = async (ph, auth, pin = PIN) => {
    const b = await ph.call('/api/auth/passkey/begin', 'POST', { purpose: 'register', pin });
    if (b.status !== 200) return { begin: b };
    return { begin: b, reg: await ph.call('/api/auth/passkey/register', 'POST', { challenge: b.json.challenge, ...auth.create(b.json.challenge) }) };
  };
  const signIn = async (ph, auth, opts) => {
    const b = await ph.call('/api/auth/passkey/begin', 'POST', { purpose: 'login' });
    assert.equal(b.status, 200);
    return ph.call('/api/auth/passkey/login', 'POST', { challenge: b.json.challenge, ...auth.get(b.json.challenge, opts) });
  };
  return { app, sms, advance: min => { t += min * 60000; }, phone, signUp, turnOn, signIn, close: () => { srv.closeAllConnections(); srv.close(); } };
}

test('passkey: turn it on with the PIN, then one touch signs in on a fresh browser', async () => {
  const s = await start();
  try {
    const mine = s.phone(); await s.signUp(mine, '9841111111');
    assert.equal((await mine.call('/api/me')).json.passkeys, 0);
    const auth = fakeAuthenticator();
    const r = await s.turnOn(mine, auth);
    assert.equal(r.reg.status, 200, JSON.stringify(r.reg.json));
    assert.equal(r.reg.json.passkeys, 1);
    const fresh = s.phone(); // no cookies, no device: only the passkey
    assert.equal((await fresh.call('/api/me')).status, 401);
    const li = await s.signIn(fresh, auth);
    assert.equal(li.status, 200, JSON.stringify(li.json));
    assert.equal((await fresh.call('/api/me')).status, 200);
    assert.equal((await fresh.call('/api/record')).status, 200);
    // The server keeps only the public key, never anything that could sign.
    const stored = JSON.stringify(s.app.store());
    assert.ok(!stored.includes('privateKey'));
  } finally { s.close(); }
});

test('passkey: switched off when the server has no site name; sign-in options say so', async () => {
  const s = await start({ rp: null });
  try {
    const ph = s.phone();
    assert.equal((await ph.call('/api/auth/options')).json.passkey, false);
    assert.equal((await ph.call('/api/auth/passkey/begin', 'POST', { purpose: 'login' })).status, 503);
  } finally { s.close(); }
});

test('passkey: turning it on needs sign-in and the right PIN', async () => {
  const s = await start();
  try {
    const anon = s.phone();
    assert.equal((await anon.call('/api/auth/passkey/begin', 'POST', { purpose: 'register', pin: PIN })).status, 401);
    const mine = s.phone(); await s.signUp(mine, '9841111112');
    const wrong = await mine.call('/api/auth/passkey/begin', 'POST', { purpose: 'register', pin: '190375' });
    assert.equal(wrong.status, 401);
    const nopin = await mine.call('/api/auth/passkey/begin', 'POST', { purpose: 'register' });
    assert.notEqual(nopin.status, 200);
    assert.equal((await mine.call('/api/me')).json.passkeys, 0);
  } finally { s.close(); }
});

test('passkey: a registration from the wrong site, with a wrong flag or replayed is refused', async () => {
  const s = await start();
  try {
    const mine = s.phone(); await s.signUp(mine, '9841111113');
    const go = async (make) => {
      const b = await mine.call('/api/auth/passkey/begin', 'POST', { purpose: 'register', pin: PIN });
      return mine.call('/api/auth/passkey/register', 'POST', { challenge: b.json.challenge, ...make(b.json.challenge) });
    };
    assert.equal((await go(c => fakeAuthenticator().create(c, { o: 'https://evil.example' }))).status, 400);
    assert.equal((await go(c => fakeAuthenticator({ rpId: 'evil.example' }).create(c))).status, 400);
    assert.equal((await go(c => fakeAuthenticator().create(c, { flags: 0x41 }))).status, 400); // no user verification
    assert.equal((await go(c => fakeAuthenticator().create(c, { type: 'webauthn.get' }))).status, 400);
    assert.equal((await go(() => fakeAuthenticator().create('not-the-challenge'))).status, 400);
    assert.equal((await mine.call('/api/me')).json.passkeys, 0);
    // A good one works once; its challenge cannot be used again.
    const auth = fakeAuthenticator();
    const b = await mine.call('/api/auth/passkey/begin', 'POST', { purpose: 'register', pin: PIN });
    const body = { challenge: b.json.challenge, ...auth.create(b.json.challenge) };
    assert.equal((await mine.call('/api/auth/passkey/register', 'POST', body)).status, 200);
    assert.equal((await mine.call('/api/auth/passkey/register', 'POST', body)).status, 400);
  } finally { s.close(); }
});

test('passkey: sign-in refused for a wrong key, wrong site, no verification, an old challenge or a counter that goes back', async () => {
  const s = await start();
  try {
    const mine = s.phone(); await s.signUp(mine, '9841111114');
    const auth = fakeAuthenticator();
    assert.equal((await s.turnOn(mine, auth)).reg.status, 200);
    const other = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey;
    const tries = {
      'wrong key': { key: other },
      'wrong site': { o: 'https://evil.example' },
      'no user verification': { flags: 0x01 },
      'wrong type': { type: 'webauthn.create' },
    };
    for (const [name, o] of Object.entries(tries)) assert.equal((await s.signIn(s.phone(), auth, o)).status, 401, name);
    // an unknown credential id
    const ph = s.phone();
    const b = await ph.call('/api/auth/passkey/begin', 'POST', { purpose: 'login' });
    assert.equal((await ph.call('/api/auth/passkey/login', 'POST', { challenge: b.json.challenge, ...fakeAuthenticator().get(b.json.challenge) })).status, 401);
    // a challenge works once, and not after 5 minutes
    const b2 = await ph.call('/api/auth/passkey/begin', 'POST', { purpose: 'login' });
    const ans = auth.get(b2.json.challenge);
    assert.equal((await ph.call('/api/auth/passkey/login', 'POST', { challenge: b2.json.challenge, ...ans })).status, 200);
    assert.equal((await ph.call('/api/auth/passkey/login', 'POST', { challenge: b2.json.challenge, ...ans })).status, 401);
    const b3 = await ph.call('/api/auth/passkey/begin', 'POST', { purpose: 'login' });
    s.advance(6);
    assert.equal((await ph.call('/api/auth/passkey/login', 'POST', { challenge: b3.json.challenge, ...auth.get(b3.json.challenge) })).status, 401);
    // a counter that does not go up looks like a copied key
    assert.equal((await s.signIn(s.phone(), auth, { bump: 1 })).status, 200); // counter moves up: fine
    assert.equal((await s.signIn(s.phone(), auth, { bump: 0 })).status, 401); // same number again: refused
    assert.equal((await s.signIn(s.phone(), auth, { bump: 1 })).status, 200);
  } finally { s.close(); }
});

test('passkey: a login challenge cannot be used to add a passkey, and the other way round', async () => {
  const s = await start();
  try {
    const mine = s.phone(); await s.signUp(mine, '9841111115');
    const auth = fakeAuthenticator();
    const lb = await mine.call('/api/auth/passkey/begin', 'POST', { purpose: 'login' });
    assert.equal((await mine.call('/api/auth/passkey/register', 'POST', { challenge: lb.json.challenge, ...auth.create(lb.json.challenge) })).status, 400);
    assert.equal((await mine.call('/api/me')).json.passkeys, 0);
  } finally { s.close(); }
});

test('passkey: turning it off works, and a recovery with a code removes every passkey', async () => {
  const s = await start();
  try {
    const mine = s.phone(); await s.signUp(mine, '9841111116');
    const auth = fakeAuthenticator();
    assert.equal((await s.turnOn(mine, auth)).reg.status, 200);
    assert.equal((await mine.call('/api/auth/passkey/remove', 'POST', {})).json.passkeys, 0);
    assert.equal((await s.signIn(s.phone(), auth)).status, 401);
    // on again, then a lost-phone recovery (new code, new PIN)
    assert.equal((await s.turnOn(mine, auth)).reg.status, 200);
    s.advance(2);
    const lost = s.phone();
    assert.equal((await lost.call('/api/auth/code', 'POST', { phone: '9841111116' })).status, 200);
    const code = s.sms.sent.filter(m => m.to === '9841111116').at(-1).text.match(/\d{6}/)[0];
    const v = await lost.call('/api/auth/verify', 'POST', { phone: '9841111116', code });
    assert.equal((await lost.call('/api/auth/pin', 'POST', { ticket: v.json.ticket, pin: '190375' })).status, 200);
    assert.equal((await lost.call('/api/me')).json.passkeys, 0);
    assert.equal((await s.signIn(s.phone(), auth)).status, 401);
  } finally { s.close(); }
});

test('passkey: at most five per account, and the same phone cannot be added twice', async () => {
  const s = await start();
  try {
    const mine = s.phone(); await s.signUp(mine, '9841111117');
    const first = fakeAuthenticator();
    assert.equal((await s.turnOn(mine, first)).reg.status, 200);
    assert.equal((await s.turnOn(mine, first)).reg.status, 400); // same credential again
    for (let i = 0; i < 4; i++) assert.equal((await s.turnOn(mine, fakeAuthenticator())).reg.status, 200);
    const sixth = await s.turnOn(mine, fakeAuthenticator());
    assert.equal(sixth.begin.status, 400);
  } finally { s.close(); }
});

// ---- fingerprint/face in place of the PIN for creating and stopping shares ----
const confirmBody = async (ph, auth, opts) => {
  const b = await ph.call('/api/auth/passkey/begin', 'POST', { purpose: 'confirm' });
  assert.equal(b.status, 200, JSON.stringify(b.json));
  return { passkey: { challenge: b.json.challenge, ...auth.get(b.json.challenge, opts) }, allow: b.json.allow };
};
const share = async (ph, proof, extra = {}) => {
  const rec = (await ph.call('/api/record')).json;
  return ph.call('/api/shares', 'POST', { docs: [rec.docs[0].id], minutes: 60, who: 'Dr. Namuna', ...proof, ...extra });
};

test('passkey confirms a share and its stop, with no PIN typed; the PIN still works too', async () => {
  const s = await start();
  try {
    const mine = s.phone(); await s.signUp(mine, '9841112221');
    const auth = fakeAuthenticator();
    assert.equal((await s.turnOn(mine, auth)).reg.status, 200);
    const proof = await confirmBody(mine, auth);
    assert.deepEqual(proof.allow, [auth.id]); // the phone is told which key to use
    const made = await share(mine, { passkey: proof.passkey });
    assert.equal(made.status, 201, JSON.stringify(made.json));
    const stopped = await mine.call('/api/shares/' + made.json.id + '/stop', 'POST', { passkey: (await confirmBody(mine, auth)).passkey });
    assert.equal(stopped.status, 200, JSON.stringify(stopped.json));
    assert.equal(stopped.json.state, 'revoked');
    assert.equal((await share(mine, { pin: PIN })).status, 201); // the PIN is still accepted
  } finally { s.close(); }
});

test('passkey confirm: refused for a wrong key, a replay, a login challenge, an old challenge or another account\'s phone; the PIN counter is untouched', async () => {
  const s = await start();
  try {
    const mine = s.phone(); await s.signUp(mine, '9841112222');
    const auth = fakeAuthenticator();
    assert.equal((await s.turnOn(mine, auth)).reg.status, 200);
    const other = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey;
    for (const [name, o] of Object.entries({ 'wrong key': { key: other }, 'wrong site': { o: 'https://evil.example' }, 'no verification': { flags: 0x01 } }))
      assert.equal((await share(mine, { passkey: (await confirmBody(mine, auth, o)).passkey })).status, 401, name);
    const good = await confirmBody(mine, auth);
    assert.equal((await share(mine, { passkey: good.passkey })).status, 201);
    assert.equal((await share(mine, { passkey: good.passkey })).status, 401); // replay
    // a challenge made for signing in is not good for confirming
    const lb = await mine.call('/api/auth/passkey/begin', 'POST', { purpose: 'login' });
    assert.equal((await share(mine, { passkey: { challenge: lb.json.challenge, ...auth.get(lb.json.challenge) } })).status, 401);
    // too old
    const old = await confirmBody(mine, auth); s.advance(6);
    assert.equal((await share(mine, { passkey: old.passkey })).status, 401);
    // another account's phone cannot confirm for me
    const theirs = s.phone(); await s.signUp(theirs, '9841112223');
    const theirAuth = fakeAuthenticator();
    assert.equal((await s.turnOn(theirs, theirAuth)).reg.status, 200);
    const mb = await mine.call('/api/auth/passkey/begin', 'POST', { purpose: 'confirm' });
    assert.equal((await share(mine, { passkey: { challenge: mb.json.challenge, ...theirAuth.get(mb.json.challenge) } })).status, 401);
    // none of that counted as a wrong PIN
    for (const a of s.app.store().accounts) assert.ok(!a.pinFails && !a.lockedUntil && !a.hardLocked);
  } finally { s.close(); }
});

test('passkey confirm: needs sign-in and an account that has one; nothing is created on a refusal', async () => {
  const s = await start();
  try {
    assert.equal((await s.phone().call('/api/auth/passkey/begin', 'POST', { purpose: 'confirm' })).status, 401);
    const mine = s.phone(); await s.signUp(mine, '9841112224');
    assert.equal((await mine.call('/api/auth/passkey/begin', 'POST', { purpose: 'confirm' })).status, 400); // none set up
    const stranger = fakeAuthenticator();
    const fake = { challenge: 'x', ...stranger.get('x') };
    assert.equal((await share(mine, { passkey: fake })).status, 401);
    assert.equal((await mine.call('/api/shares')).json.shares.length, 0);
    assert.equal((await share(mine, {})).status, 400); // neither PIN nor passkey: asks for the PIN
  } finally { s.close(); }
});
