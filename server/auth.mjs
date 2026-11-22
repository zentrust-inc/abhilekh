// Abhilekh sign-in (prototype, SAMPLE data only). Zero dependencies.
//
// Design (status log 2026-11-21, PRD rev. 3.3 "Security and consent"):
//   - Sign up with a Nepal mobile number (ONE SMS code) or with an email address (ONE code by email), then the patient
//     sets a 6-digit PIN. One account per sign-in method: a phone account and an email account are separate accounts.
//   - Afterwards: PIN on the same phone. The phone is remembered by a device cookie, so a PIN alone from another
//     phone is not enough.
//   - A code (SMS or email, the same channel as the account) again only for recovery: a new phone, a forgotten PIN, or a lockout. Recovery ends every other session and
//     device, and pauses NEW shares for 24 hours (PRD: "a 24-hour hold on sensitive actions after recovery").
//     Stopping a share is never paused.
//   - The PIN is asked again to create or stop a share.
//   - Passkeys (rpId abhilekh.org) are a later step, not in this file.
// Stored: phone number or email address, scrypt hash of the PIN, SHA-256 hashes of codes, sessions and device tokens. Never a plain
// code, PIN or token.
import { randomBytes, randomInt, scryptSync, createHash, timingSafeEqual } from 'node:crypto';
import { noMail } from './mail.mjs';

const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;
export const LIMITS = {
  codeMinutes: 10, codeTries: 5,
  phoneCooldownMs: MIN, phonePerHour: 3, phonePerDay: 5, ipPerHour: 10, dailyCap: 200, emailDailyCap: 1000,
  pinSoftLock: 5, pinSoftLockMs: 15 * MIN, pinHardLock: 10,
  sessionMs: 30 * DAY, deviceMs: 400 * DAY, ticketMs: 10 * MIN, recoveryHoldMs: DAY,
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

export function createAuth({ store, save, now = () => Date.now(), sms, mail = noMail(), testMode = false, secureCookies = true, limits = {} }) {
  const L = { ...LIMITS, ...limits };
  for (const k of ['accounts', 'sessions', 'codes', 'smsLog']) if (!Array.isArray(store[k])) store[k] = [];
  // Accounts, codes and the send log made before email existed are keyed by phone: give them the new key.
  for (const a of store.accounts) if (!a.key) { a.key = 'phone:' + a.phone; a.kind = 'phone'; }
  for (const x of [...store.codes, ...store.smsLog]) if (!x.key && x.phone) { x.key = 'phone:' + x.phone; x.kind = 'phone'; }
  const tickets = new Map(); // short-lived, in memory: a restart only means asking for a new code

  const prune = () => {
    const t = now();
    store.sessions = store.sessions.filter(s => s.expires > t);
    store.codes = store.codes.filter(c => c.expires > t && !c.used);
    store.smsLog = store.smsLog.filter(x => t - x.at < DAY);
    for (const [k, v] of tickets) if (v.expires <= t) tickets.delete(k);
  };

  const cookies = req => Object.fromEntries((req.headers.cookie || '').split(';').map(s => s.trim().split('=')).filter(a => a.length === 2));
  const cookie = (name, value, maxMs) => `${name}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(maxMs / 1000)}${secureCookies ? '; Secure' : ''}`;

  function current(req) {
    const c = cookies(req);
    if (!c.abh_s) return null;
    const s = store.sessions.find(x => x.hash === sha(c.abh_s) && x.expires > now());
    if (!s) return null;
    const account = store.accounts.find(a => a.id === s.accountId);
    return account ? { account, session: s } : null;
  }

  const holdUntil = a => (a.recoveredAt && now() < a.recoveredAt + L.recoveryHoldMs ? a.recoveredAt + L.recoveryHoldMs : null);
  const label = a => (a.kind === 'email' ? maskEmail(a.email) : maskPhone(a.phone));
  const channel = a => (a.kind === 'email' ? 'email' : 'SMS');
  const me = a => ({ ...(a.kind === 'email' ? { email: maskEmail(a.email) } : { phone: maskPhone(a.phone) }), label: label(a), kind: a.kind, created: new Date(a.created).toISOString(), sharesPausedUntil: holdUntil(a) ? new Date(holdUntil(a)).toISOString() : null });

  // PIN check shared by sign-in and by re-entry before a share is created or stopped.
  function checkPin(a, pin) {
    const t = now();
    if (a.hardLocked) return { status: 423, error: 'Too many wrong PINs. Get a code by ' + channel(a) + ' to set a new PIN.', needCode: true };
    if (a.lockedUntil && t < a.lockedUntil) return { status: 423, error: 'Too many wrong PINs. Try again after ' + new Date(a.lockedUntil).toISOString() + ', or get a code by ' + channel(a) + '.', lockedUntil: new Date(a.lockedUntil).toISOString() };
    if (!/^\d{6}$/.test(String(pin || ''))) return { status: 400, error: 'Enter your 6-digit PIN.' }; // a typo in length is not counted as a try
    const ok = same(hashPin(String(pin), a.pinSalt).hash, a.pinHash);
    if (ok) { a.pinFails = 0; a.lockedUntil = null; save(); return { ok: true }; }
    a.pinFails = (a.pinFails || 0) + 1;
    if (a.pinFails >= L.pinHardLock) { a.hardLocked = true; save(); return { status: 423, error: 'Too many wrong PINs. Get a code by ' + channel(a) + ' to set a new PIN.', needCode: true }; }
    if (a.pinFails % L.pinSoftLock === 0) { a.lockedUntil = t + L.pinSoftLockMs; save(); return { status: 423, error: 'Too many wrong PINs. Wait 15 minutes, or get a code by ' + channel(a) + '.', lockedUntil: new Date(a.lockedUntil).toISOString() }; }
    save();
    return { status: 401, error: 'Wrong PIN. ' + (L.pinSoftLock - (a.pinFails % L.pinSoftLock)) + ' tries left before a 15-minute wait.' };
  }

  function startSession(res, a, deviceToken) {
    const s = tok();
    store.sessions.push({ hash: sha(s), accountId: a.id, created: now(), expires: now() + L.sessionMs });
    const set = [cookie('abh_s', s, L.sessionMs)];
    if (deviceToken) set.push(cookie('abh_d', deviceToken, L.deviceMs));
    res.setHeader('set-cookie', set);
  }

  // Returns true if it handled the request.
  async function route(req, res, path, { ip, send, readJson }) {
    if (!path.startsWith('/api/auth/') && path !== '/api/me') return false;
    if (req.method === 'GET' && path === '/api/me') {
      const cur = current(req);
      return send(res, cur ? 200 : 401, cur ? me(cur.account) : { error: 'Not signed in.' }), true;
    }
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
        Object.assign(a, { pinSalt: salt, pinHash: hash, pinFails: 0, lockedUntil: null, hardLocked: false, recoveredAt: t, devices: [] });
      } else {
        a = { id: tok(), key: tk.key, kind: tk.kind, [tk.kind === 'email' ? 'email' : 'phone']: tk.value, created: t, pinSalt: salt, pinHash: hash, pinFails: 0, lockedUntil: null, hardLocked: false, recoveredAt: null, devices: [] };
        store.accounts.push(a);
      }
      const device = tok();
      a.devices.push({ hash: sha(device), created: t });
      startSession(res, a, device);
      save();
      return send(res, 200, me(a)), true;
    }

    if (path === '/api/auth/login') {
      const who = identify(b);
      const dev = cookies(req).abh_d;
      const a = !who.error && store.accounts.find(x => x.key === who.key);
      // Same answer for an unknown number or address and an unknown phone, so their existence is not revealed.
      if (!a || !dev || !a.devices.some(d => d.hash === sha(dev))) return send(res, 403, { error: 'This device is new for this ' + (who.kind === 'email' ? 'address. Get a code by email' : 'number. Get a code by SMS') + ' to continue.', needCode: true }), true;
      const r = checkPin(a, b.pin);
      if (!r.ok) return send(res, r.status, r), true;
      startSession(res, a, null);
      save();
      return send(res, 200, me(a)), true;
    }

    if (path === '/api/auth/logout') {
      const s = cookies(req).abh_s;
      if (s) { store.sessions = store.sessions.filter(x => x.hash !== sha(s)); save(); }
      res.setHeader('set-cookie', cookie('abh_s', '', 0));
      return send(res, 200, { ok: true }), true;
    }
    return send(res, 404, { error: 'not found' }), true;
  }

  return { route, current, checkPin, holdUntil, tickets };
}
