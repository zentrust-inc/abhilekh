// Abhilekh sign-in. Zero dependencies.
//
// Design (status log 2026-11-21, PRD rev. 3.3 "Security and consent"):
//   - Sign up with a Nepal mobile number (ONE SMS code) or with an email address (ONE code by email), then the patient
//     sets a 6-digit PIN. One account per sign-in method: a phone account and an email account are separate accounts.
//   - Or "Continue with Google" (OAuth code flow, scope openid email): Google proves who the person is, so there is no
//     code. A new Google account sets a PIN once; after that Google signs the person in on any device. The PIN is still
//     asked to create or stop a share. A forgotten PIN is reset by signing in with Google again (same hold as recovery).
//     The Google account is keyed by Google's permanent id (sub), not by the email address, which can change.
//   - Afterwards: PIN on the same phone. The phone is remembered by a device cookie, so a PIN alone from another
//     phone is not enough.
//   - A code (SMS or email, the same channel as the account) again only for recovery: a new phone, a forgotten PIN, or a lockout. Recovery ends every other session and
//     device, and pauses NEW shares for 24 hours (PRD: "a 24-hour hold on sensitive actions after recovery").
//     Stopping a share is never paused.
//   - The PIN is asked again to create or stop a share.
//   - Passkeys (fingerprint, face or screen lock; passkey.mjs): optional, next to the PIN, never instead of it. Signed in, the
//     patient turns it on for a phone (the PIN is asked, so a stolen session cannot add a way in that outlives sign-out).
//     After that one tap signs in, on any device the passkey reaches, and the same tap confirms creating or stopping a share
//     in place of the PIN (confirm(): the PIN still works too).
//     Recovery (a code or Google after a lost phone or forgotten PIN) removes every passkey, like it ends every device.
// Stored: phone number or email address, scrypt hash of the PIN, SHA-256 hashes of codes, sessions and device tokens. Never a plain
// code, PIN or token.
import { randomBytes, randomInt, scryptSync, createHash, timingSafeEqual } from 'node:crypto';
import { noMail } from './mail.mjs';
import { verifyRegistration, verifyAssertion, ALGS } from './passkey.mjs';

const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;
export const LIMITS = {
  codeMinutes: 10, codeTries: 5,
  phoneCooldownMs: MIN, phonePerHour: 3, phonePerDay: 5, ipPerHour: 10, dailyCap: 200, emailDailyCap: 1000,
  pinSoftLock: 5, pinSoftLockMs: 15 * MIN, pinHardLock: 10,
  sessionMs: 30 * DAY, challengeMs: 5 * MIN, passkeysPerAccount: 5, deviceMs: 400 * DAY, ticketMs: 10 * MIN, recoveryHoldMs: DAY,
};

const sha = s => createHash('sha256').update(s).digest('hex');
const tok = () => randomBytes(24).toString('base64url');
const same = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

// Nepal mobile numbers: 10 digits starting 96, 97 or 98; +977 / 977 prefix, spaces and dashes allowed.
export function normalisePhone(raw) {
  let p = String(raw || '').replace(/[\s\-().]/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  if (p.length === 13 && p.startsWith('977')) p = p.slice(3);
  return /^9[678]\d{8}$/.test(p) ? p : null;
}
export const maskPhone = p => p.slice(0, 3) + '****' + p.slice(-3);

// Email: one @, no spaces, a dot in the domain. Lower-cased; dots and +tags are NOT rewritten (they may matter).
export function normaliseEmail(raw) {
  const e = String(raw || '').trim().toLowerCase();
  if (e.length > 254 || !/^[^\s@]{1,64}@[^\s@.]+(\.[^\s@.]+)+$/.test(e)) return null;
  return e;
}
export const maskEmail = e => { const [l, d] = e.split('@'); return l.slice(0, 1) + '***@' + d; };

// One field on the sign-in page: an "@" means email, anything else is read as a Nepal mobile number.
// Older callers send { phone }; { email } works too.
export function identify(b) {
  const raw = String(b.id ?? b.email ?? b.phone ?? '').trim();
  if (raw.includes('@')) {
    const e = normaliseEmail(raw);
    return e ? { key: 'email:' + e, kind: 'email', value: e } : { error: 'Enter a valid email address.' };
  }
  const p = normalisePhone(raw);
  return p ? { key: 'phone:' + p, kind: 'phone', value: p } : { error: 'Enter a Nepal mobile number (10 digits starting with 98, 97 or 96) or an email address.' };
}

// 6 digits, and not one that everyone guesses first.
export function pinProblem(pin) {
  if (!/^\d{6}$/.test(String(pin || ''))) return 'The PIN must be 6 digits.';
  const d = [...pin].map(Number);
  if (d.every(x => x === d[0])) return 'Choose a PIN that is not one digit repeated.';
  if (d.every((x, i) => i === 0 || x === (d[i - 1] + 1) % 10) || d.every((x, i) => i === 0 || x === (d[i - 1] + 9) % 10)) return 'Choose a PIN that is not a run like 123456.';
  if (pin.slice(0, 3) === pin.slice(3)) return 'Choose a PIN that is not one half repeated.';
  return null;
}
const hashPin = (pin, salt = randomBytes(16).toString('hex')) => ({ salt, hash: scryptSync(pin, salt, 32).toString('hex') });

export function createAuth({ store, save, now = () => Date.now(), sms, mail = noMail(), google = null, rp = null, testMode = false, secureCookies = true, limits = {} }) {
  const L = { ...LIMITS, ...limits };
  for (const k of ['accounts', 'sessions', 'codes', 'smsLog']) if (!Array.isArray(store[k])) store[k] = [];
  // Accounts, codes and the send log made before email existed are keyed by phone: give them the new key.
  for (const a of store.accounts) if (!a.key) { a.key = 'phone:' + a.phone; a.kind = 'phone'; }
  for (const x of [...store.codes, ...store.smsLog]) if (!x.key && x.phone) { x.key = 'phone:' + x.phone; x.kind = 'phone'; }
  const challenges = new Map(); // passkey one-time challenges, in memory
  const pkStarts = new Map(); // ip -> start times
  const tickets = new Map(); // short-lived, in memory: a restart only means asking for a new code

  const prune = () => {
    const t = now();
    store.sessions = store.sessions.filter(s => s.expires > t);
    store.codes = store.codes.filter(c => c.expires > t && !c.used);
    store.smsLog = store.smsLog.filter(x => t - x.at < DAY);
    for (const [k, v] of tickets) if (v.expires <= t) tickets.delete(k);
    for (const [k, v] of challenges) if (v.expires <= t) challenges.delete(k);
  };

  const cookies = req => Object.fromEntries((req.headers.cookie || '').split(';').map(s => s.trim().split('=')).filter(a => a.length === 2));
  const cookie = (name, value, maxMs, site = 'Strict') => `${name}=${value}; Path=/; HttpOnly; SameSite=${site}; Max-Age=${Math.floor(maxMs / 1000)}${secureCookies ? '; Secure' : ''}`;

  function current(req) {
    const c = cookies(req);
    if (!c.abh_s) return null;
    const s = store.sessions.find(x => x.hash === sha(c.abh_s) && x.expires > now());
    if (!s) return null;
    const account = store.accounts.find(a => a.id === s.accountId);
    return account ? { account, session: s } : null;
  }

  const holdUntil = a => (a.recoveredAt && now() < a.recoveredAt + L.recoveryHoldMs ? a.recoveredAt + L.recoveryHoldMs : null);
  const label = a => (a.kind === 'phone' ? maskPhone(a.phone) : maskEmail(a.email));
  const recoverHow = a => (a.kind === 'email' ? 'get a code by email' : a.kind === 'google' ? 'sign in with Google again' : 'get a code by SMS');
  const Cap = x => x[0].toUpperCase() + x.slice(1);
  const me = a => ({ ...(a.kind === 'phone' ? { phone: maskPhone(a.phone) } : { email: maskEmail(a.email) }), label: label(a), kind: a.kind, passkeys: (a.passkeys || []).length, created: new Date(a.created).toISOString(), sharesPausedUntil: holdUntil(a) ? new Date(holdUntil(a)).toISOString() : null });

  // PIN check shared by sign-in and by re-entry before a share is created or stopped.
  function checkPin(a, pin) {
    const t = now();
    if (a.hardLocked) return { status: 423, error: 'Too many wrong PINs. ' + Cap(recoverHow(a)) + ' to set a new PIN.', needCode: true };
    if (a.lockedUntil && t < a.lockedUntil) return { status: 423, error: 'Too many wrong PINs. Try again after ' + new Date(a.lockedUntil).toISOString() + ', or ' + recoverHow(a) + '.', lockedUntil: new Date(a.lockedUntil).toISOString() };
    if (!/^\d{6}$/.test(String(pin || ''))) return { status: 400, error: 'Enter your 6-digit PIN.' }; // a typo in length is not counted as a try
    const ok = same(hashPin(String(pin), a.pinSalt).hash, a.pinHash);
    if (ok) { a.pinFails = 0; a.lockedUntil = null; save(); return { ok: true }; }
    a.pinFails = (a.pinFails || 0) + 1;
    if (a.pinFails >= L.pinHardLock) { a.hardLocked = true; save(); return { status: 423, error: 'Too many wrong PINs. ' + Cap(recoverHow(a)) + ' to set a new PIN.', needCode: true }; }
    if (a.pinFails % L.pinSoftLock === 0) { a.lockedUntil = t + L.pinSoftLockMs; save(); return { status: 423, error: 'Too many wrong PINs. Wait 15 minutes, or ' + recoverHow(a) + '.', lockedUntil: new Date(a.lockedUntil).toISOString() }; }
    save();
    return { status: 401, error: 'Wrong PIN. ' + (L.pinSoftLock - (a.pinFails % L.pinSoftLock)) + ' tries left before a 15-minute wait.' };
  }

  // Proof that it is the patient, for creating or stopping a share: the PIN, or a fingerprint/face check on a phone already
  // set up on this account. A passkey answer is bound to a one-time challenge for this account and cannot be guessed, so it
  // does not count towards the PIN lockout.
  function confirm(a, b) {
    const k = b && !b.pin && b.passkey;
    if (!k) return checkPin(a, b && b.pin);
    const bad = { status: 401, error: 'Fingerprint or face did not work. Type your PIN instead.' };
    const t = now(), ck = sha(String(k.challenge || '')), rec = challenges.get(ck);
    challenges.delete(ck); // one use
    const pk = (a.passkeys || []).find(p => p.id === String(k.id || ''));
    if (!rp || !rec || rec.purpose !== 'confirm' || rec.accountId !== a.id || rec.expires <= t || !pk) return bad;
    try {
      const r = verifyAssertion(k, pk, { challenge: String(k.challenge), origin: rp.origin, rpId: rp.id });
      pk.signCount = r.signCount; pk.lastUsed = t; save();
      return { ok: true };
    } catch (e) { console.error('Passkey confirm refused:', e.message); return bad; }
  }

  function startSession(res, a, deviceToken) {
    const s = tok();
    store.sessions.push({ hash: sha(s), accountId: a.id, created: now(), expires: now() + L.sessionMs });
    const set = [cookie('abh_s', s, L.sessionMs)];
    if (deviceToken) set.push(cookie('abh_d', deviceToken, L.deviceMs));
    res.setHeader('set-cookie', set);
  }

  // ---- Google sign-in (authorization code flow, server side) ----
  const oauth = new Map(); // state hash -> { nonce, intent, expires }; a restart only means signing in again
  const starts = new Map(); // ip -> start times, to slow down hammering
  const back = (res, query, extra = []) => { res.statusCode = 302; res.setHeader('location', '/' + query); res.setHeader('cache-control', 'no-store'); if (extra.length) res.setHeader('set-cookie', extra); res.end(); };
  const clearState = () => cookie('abh_gs', '', 0, 'Lax');

  function googleStart(req, res, ip, send) {
    if (!google) return send(res, 503, { error: 'Google sign-in is not switched on yet.' });
    const t = now();
    const a = (starts.get(ip) || []).filter(x => t - x < 10 * MIN); a.push(t); starts.set(ip, a);
    if (a.length > 20) return send(res, 429, { error: 'Too many tries. Wait a few minutes.' });
    for (const [k, v] of oauth) if (v.expires <= t) oauth.delete(k);
    const intent = new URL(req.url, 'http://x').searchParams.get('intent') === 'reset' ? 'reset' : 'login';
    const state = tok(), nonce = tok();
    oauth.set(sha(state), { nonce, intent, expires: t + 10 * MIN });
    const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    for (const [k, v] of Object.entries({ client_id: google.clientId, redirect_uri: google.redirectUri, response_type: 'code', scope: 'openid email', state, nonce, prompt: 'select_account' })) u.searchParams.set(k, v);
    res.statusCode = 302; res.setHeader('location', u.toString()); res.setHeader('cache-control', 'no-store');
    // Lax, not Strict: Google sends the browser back with a cross-site navigation, which Strict cookies would miss.
    res.setHeader('set-cookie', cookie('abh_gs', state, 10 * MIN, 'Lax'));
    res.end();
  }

  async function googleCallback(req, res, ip) {
    const q = new URL(req.url, 'http://x').searchParams, t = now();
    const state = q.get('state') || '';
    const rec = oauth.get(sha(state));
    oauth.delete(sha(state)); // one use
    // The state must be ours, unused, unexpired, and the same one this browser was given (against login CSRF).
    if (!rec || rec.expires <= t || cookies(req).abh_gs !== state) return back(res, '?gerr=expired', [clearState()]);
    if (q.get('error')) return back(res, '?gerr=cancelled', [clearState()]);
    let claims;
    try {
      const r = await google.fetchImpl('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: q.get('code') || '', client_id: google.clientId, client_secret: google.clientSecret, redirect_uri: google.redirectUri, grant_type: 'authorization_code' }).toString(), redirect: 'error', signal: AbortSignal.timeout(15000) });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j || !j.id_token) throw new Error('token endpoint: HTTP ' + r.status);
      // The id_token came straight from Google's token endpoint over TLS, so its signature need not be checked again;
      // what it says about who, for whom, from whom and until when is checked here.
      claims = JSON.parse(Buffer.from(String(j.id_token).split('.')[1] || '', 'base64url').toString());
    } catch (e) { console.error('Google sign-in failed:', e.message); return back(res, '?gerr=failed', [clearState()]); }
    const okIss = claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com';
    if (!okIss || claims.aud !== google.clientId || !(claims.exp * 1000 > t) || claims.nonce !== rec.nonce || !claims.sub) return back(res, '?gerr=failed', [clearState()]);
    const email = normaliseEmail(claims.email);
    if (!email || claims.email_verified !== true) return back(res, '?gerr=unverified', [clearState()]);
    const key = 'google:' + claims.sub;
    const a = store.accounts.find(x => x.key === key);
    if (a && rec.intent !== 'reset') { // an existing Google account just signs in; the PIN is asked for shares
      a.email = email; startSession(res, a, null); save();
      res.setHeader('set-cookie', [...[].concat(res.getHeader('set-cookie') || []), clearState()]);
      return back(res, '');
    }
    if (!a && rec.intent === 'reset') return back(res, '?gerr=noaccount', [clearState()]);
    const ticket = tok();
    tickets.set(sha(ticket), { key, kind: 'google', value: email, isNew: !a, expires: t + L.ticketMs });
    return back(res, '?g=1', [clearState(), cookie('abh_gt', ticket, L.ticketMs, 'Lax')]);
  }

  // Returns true if it handled the request.
  async function route(req, res, path, { ip, send, readJson }) {
    if (!path.startsWith('/api/auth/') && path !== '/api/me') return false;
    if (req.method === 'GET' && path === '/api/me') {
      const cur = current(req);
      return send(res, cur ? 200 : 401, cur ? me(cur.account) : { error: 'Not signed in.' }), true;
    }
    if (req.method === 'GET' && path === '/api/auth/hello') { // a returning browser is greeted; only a masked label is ever returned
      const dev = cookies(req).abh_d;
      const a = dev && store.accounts.find(x => (x.devices || []).some(d => d.hash === sha(dev)));
      return send(res, 200, a && a.pinHash ? { known: true, label: label(a), kind: a.kind, passkeys: (a.passkeys || []).length } : { known: false }), true;
    }
    if (req.method === 'GET' && path === '/api/auth/options') return send(res, 200, { sms: sms.name !== 'none', email: mail.name !== 'none', google: !!google, passkey: !!rp }), true;
    if (req.method === 'GET' && path === '/api/auth/google/start') return googleStart(req, res, ip, send), true;
    if (req.method === 'GET' && path === '/api/auth/google/callback') return await googleCallback(req, res, ip), true;
    if (req.method !== 'POST') return send(res, 404, { error: 'not found' }), true;
    prune();
    const b = await readJson(req);
    const t = now();

    if (path === '/api/auth/code') {
      const who = identify(b);
      if (who.error) return send(res, 400, { error: who.error }), true;
      const viaMail = who.kind === 'email';
      if ((viaMail ? mail : sms).name === 'none') return send(res, 503, { error: viaMail ? 'Codes by email are not switched on yet, so new sign-ups and new devices cannot be added by email. Try again later.' : 'Codes by SMS are not switched on yet, so new sign-ups and new phones cannot be added. Try again later.' }), true;
      const mine = store.smsLog.filter(x => x.key === who.key);
      const last = mine.reduce((m, x) => Math.max(m, x.at), 0);
      if (t - last < L.phoneCooldownMs) return send(res, 429, { error: 'A code was just sent. Wait a minute before asking again.' }), true;
      if (mine.filter(x => t - x.at < HOUR).length >= L.phonePerHour || mine.length >= L.phonePerDay) return send(res, 429, { error: 'Too many codes for this ' + (viaMail ? 'address' : 'number') + '. Try again later.' }), true;
      if (store.smsLog.filter(x => x.ip === ip && t - x.at < HOUR).length >= L.ipPerHour) return send(res, 429, { error: 'Too many codes from this connection. Try again later.' }), true;
      if (store.smsLog.filter(x => x.kind === who.kind).length >= (viaMail ? L.emailDailyCap : L.dailyCap)) return send(res, 503, { error: 'Sign-up is paused for today. Try again tomorrow.' }), true;
      const code = String(randomInt(0, 1e6)).padStart(6, '0');
      store.smsLog.push({ key: who.key, kind: who.kind, ip, at: t });
      store.codes = store.codes.filter(c => c.key !== who.key); // only the newest code works
      store.codes.push({ key: who.key, hash: sha(who.key + ':' + code), created: t, expires: t + L.codeMinutes * MIN, tries: 0, used: false });
      save();
      const r = viaMail
        ? await mail.send(who.value, 'Your Abhilekh sign-in code', `Abhilekh code: ${code}\n\nIt works for ${L.codeMinutes} minutes. Do not share it with anyone.\nIf you did not ask for this, ignore this email.`)
        : await sms.send(who.value, `Abhilekh code: ${code}. It works for ${L.codeMinutes} minutes. Do not share it with anyone.`);
      if (!r.ok) { console.error((viaMail ? 'Email' : 'SMS') + ' send failed:', r.reason); return send(res, 502, { error: viaMail ? 'The email could not be sent. Try again in a few minutes.' : 'The SMS could not be sent. Try again in a few minutes.' }), true; }
      const out = { sent: true, minutes: L.codeMinutes, via: who.kind };
      if (testMode && (viaMail ? mail : sms).name === 'memory') out.testCode = code; // demo only: never with a real sender
      return send(res, 200, out), true;
    }

    if (path === '/api/auth/verify') {
      const who = identify(b);
      const c = !who.error && store.codes.find(x => x.key === who.key && !x.used && x.expires > t);
      if (!c) return send(res, 400, { error: 'This code has ended. Ask for a new one.' }), true;
      c.tries++;
      if (!same(sha(who.key + ':' + String(b.code || '').trim()), c.hash)) {
        if (c.tries >= L.codeTries) c.used = true;
        save();
        return send(res, 400, { error: c.used ? 'Too many wrong codes. Ask for a new one.' : 'That code is not right. ' + (L.codeTries - c.tries) + ' tries left.' }), true;
      }
      c.used = true; save();
      const ticket = tok();
      const exists = store.accounts.some(a => a.key === who.key);
      tickets.set(sha(ticket), { key: who.key, kind: who.kind, value: who.value, expires: t + L.ticketMs });
      return send(res, 200, { ticket, isNew: !exists }), true;
    }

    if (path === '/api/auth/pin') {
      const tk = tickets.get(sha(String(b.ticket || '')));
      if (!tk || tk.expires <= t) return send(res, 400, { error: 'This step has timed out. Ask for a new code.' }), true;
      const problem = pinProblem(String(b.pin || ''));
      if (problem) return send(res, 400, { error: problem }), true;
      tickets.delete(sha(String(b.ticket)));
      const { salt, hash } = hashPin(String(b.pin));
      let a = store.accounts.find(x => x.key === tk.key);
      if (a) { // recovery: new phone, forgotten PIN or lockout
        store.sessions = store.sessions.filter(s => s.accountId !== a.id);
        Object.assign(a, { pinSalt: salt, pinHash: hash, pinFails: 0, lockedUntil: null, hardLocked: false, recoveredAt: t, devices: [], passkeys: [] });
      } else {
        a = { id: tok(), key: tk.key, kind: tk.kind, [tk.kind === 'phone' ? 'phone' : 'email']: tk.value, created: t, pinSalt: salt, pinHash: hash, pinFails: 0, lockedUntil: null, hardLocked: false, recoveredAt: null, devices: [], passkeys: [] };
        store.accounts.push(a);
      }
      const device = tok();
      a.devices.push({ hash: sha(device), created: t });
      startSession(res, a, device);
      save();
      return send(res, 200, me(a)), true;
    }

    if (path === '/api/auth/login') {
      const dev = cookies(req).abh_d;
      const byDevice = !b.id && dev ? store.accounts.find(x => (x.devices || []).some(d => d.hash === sha(dev))) : null; // returning phone: no need to type the number again
      const who = byDevice ? { kind: byDevice.kind, key: byDevice.key } : identify(b);
      const a = byDevice || (!who.error && store.accounts.find(x => x.key === who.key));
      // Same answer for an unknown number or address and an unknown phone, so their existence is not revealed.
      if (!a || !dev || !a.devices.some(d => d.hash === sha(dev))) return send(res, 403, { error: 'This device is new for this ' + (who.kind === 'email' ? 'address. Get a code by email' : 'number. Get a code by SMS') + ' to continue.', needCode: true }), true;
      const r = checkPin(a, b.pin);
      if (!r.ok) return send(res, r.status, r), true;
      startSession(res, a, null);
      save();
      return send(res, 200, me(a)), true;
    }

    if (path === '/api/auth/pin/change' && req.method === 'POST') {
      // Change the PIN while signed in: the current PIN is required (and counted like any wrong try). Other devices stay signed in and
      // sharing is not paused: that is for recovery with a code, which is a different situation.
      const cur = current(req);
      if (!cur) return send(res, 401, { error: 'Sign in first.' }), true;
      const a = cur.account;
      const r = checkPin(a, b.pin);
      if (!r.ok) return send(res, r.status, r), true;
      const problem = pinProblem(String(b.newPin || ''));
      if (problem) return send(res, 400, { error: problem }), true;
      if (String(b.newPin) === String(b.pin)) return send(res, 400, { error: 'Choose a PIN different from the current one.' }), true;
      const { salt, hash } = hashPin(String(b.newPin));
      Object.assign(a, { pinSalt: salt, pinHash: hash, pinFails: 0, lockedUntil: null });
      save();
      return send(res, 200, { ok: true }), true;
    }

    if (path === '/api/auth/google/ticket') {
      // The browser comes back from Google with the ticket in an HttpOnly cookie; the page trades it for the PIN step.
      const g = cookies(req).abh_gt;
      const tk = g && tickets.get(sha(g));
      res.setHeader('set-cookie', cookie('abh_gt', '', 0, 'Lax'));
      if (!tk || tk.expires <= t) return send(res, 400, { error: 'This step has timed out. Sign in with Google again.' }), true;
      return send(res, 200, { ticket: g, isNew: tk.isNew }), true;
    }

    // ---- Passkeys ----
    if (path.startsWith('/api/auth/passkey/')) {
      if (!rp) return send(res, 503, { error: 'Fingerprint or face sign-in is not switched on.' }), true;
      const sorry = () => send(res, 401, { error: 'Fingerprint or face sign-in did not work. Use your PIN or a code.' });
      const take = (c, purpose) => { // one use, unexpired, the right purpose
        const k = sha(String(c || '')), rec = challenges.get(k);
        challenges.delete(k);
        return rec && rec.purpose === purpose && rec.expires > t ? rec : null;
      };

      if (path === '/api/auth/passkey/begin') {
        const purpose = ['register', 'confirm'].includes(b.purpose) ? b.purpose : 'login';
        const cur = purpose === 'login' ? null : current(req);
        if (purpose !== 'login' && !cur) return send(res, 401, { error: 'Not signed in.' }), true;
        if (purpose === 'confirm') {
          if (!(cur.account.passkeys || []).length) return send(res, 400, { error: 'No fingerprint or face sign-in is set up. Use your PIN.' }), true;
        } else if (purpose === 'register') {
          const r = checkPin(cur.account, b.pin); // the PIN, so a stolen session cannot add a way back in
          if (!r.ok) return send(res, r.status, r), true;
          if ((cur.account.passkeys || []).length >= L.passkeysPerAccount) return send(res, 400, { error: 'This account already has ' + L.passkeysPerAccount + ' fingerprint or face sign-ins. Remove them first.' }), true;
        }
        if (purpose !== 'register') {
          const a = (pkStarts.get(ip) || []).filter(x => t - x < 10 * MIN); a.push(t); pkStarts.set(ip, a);
          if (a.length > 60) return send(res, 429, { error: 'Too many tries. Wait a few minutes.' }), true;
        }
        if (challenges.size > 5000) return send(res, 503, { error: 'Busy. Try again in a few minutes.' }), true;
        const challenge = tok();
        challenges.set(sha(challenge), { purpose, accountId: cur ? cur.account.id : null, expires: t + L.challengeMs });
        const out = { challenge, rpId: rp.id };
        if (purpose === 'confirm') out.allow = cur.account.passkeys.map(k => k.id);
        if (purpose === 'register') Object.assign(out, { user: { id: Buffer.from(cur.account.id).toString('base64url'), name: label(cur.account) }, exclude: (cur.account.passkeys || []).map(k => k.id), algs: ALGS });
        return send(res, 200, out), true;
      }

      if (path === '/api/auth/passkey/register') {
        const cur = current(req);
        const rec = take(b.challenge, 'register');
        if (!cur || !rec || rec.accountId !== cur.account.id) return send(res, 400, { error: 'This step has timed out. Try again.' }), true;
        let k;
        try { k = verifyRegistration(b, { challenge: String(b.challenge), origin: rp.origin, rpId: rp.id }); } catch (e) { console.error('Passkey registration refused:', e.message); return send(res, 400, { error: 'This device could not be set up for fingerprint or face sign-in.' }), true; }
        if (store.accounts.some(x => (x.passkeys || []).some(p => p.id === k.id))) return send(res, 400, { error: 'This device is already set up.' }), true;
        const a = cur.account;
        if (!Array.isArray(a.passkeys)) a.passkeys = [];
        if (a.passkeys.length >= L.passkeysPerAccount) return send(res, 400, { error: 'This account already has ' + L.passkeysPerAccount + ' fingerprint or face sign-ins. Remove them first.' }), true;
        a.passkeys.push({ id: k.id, publicKey: k.publicKey, alg: k.alg, signCount: k.signCount, created: t, lastUsed: null });
        save();
        return send(res, 200, me(a)), true;
      }

      if (path === '/api/auth/passkey/login') {
        const rec = take(b.challenge, 'login');
        const a = rec && store.accounts.find(x => (x.passkeys || []).some(p => p.id === String(b.id || '')));
        const pk = a && a.passkeys.find(p => p.id === String(b.id));
        if (!pk) return sorry(), true;
        let r;
        try { r = verifyAssertion(b, pk, { challenge: String(b.challenge), origin: rp.origin, rpId: rp.id }); } catch (e) { console.error('Passkey sign-in refused:', e.message); return sorry(), true; }
        pk.signCount = r.signCount; pk.lastUsed = t;
        startSession(res, a, null);
        save();
        return send(res, 200, me(a)), true;
      }

      if (path === '/api/auth/passkey/remove') { // signed in is enough: stopping access is never made harder
        const cur = current(req);
        if (!cur) return send(res, 401, { error: 'Not signed in.' }), true;
        cur.account.passkeys = [];
        save();
        return send(res, 200, me(cur.account)), true;
      }
      return send(res, 404, { error: 'not found' }), true;
    }

    if (path === '/api/auth/logout') {
      const s = cookies(req).abh_s;
      if (s) { store.sessions = store.sessions.filter(x => x.hash !== sha(s)); save(); }
      res.setHeader('set-cookie', cookie('abh_s', '', 0));
      return send(res, 200, { ok: true }), true;
    }
    return send(res, 404, { error: 'not found' }), true;
  }

  return { route, current, checkPin, confirm, holdUntil, tickets };
}
