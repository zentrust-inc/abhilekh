// Abhilekh share server. Live test with real papers from 25 Nov 2026 (patients have consented); the invented SAMPLE papers remain as a demo.
// Zero dependencies: node:http + a JSON file. Expiry and revocation are enforced HERE, not in the page.
//
// What it does: stores shares of confirmed records, serves the doctor's view only while a share is live,
// logs every open and every refused open, lets the patient stop a share.
// Sign-in (auth.mjs): Nepal mobile number (one SMS code), email address (one code by email) or Google, then a 6-digit PIN; the PIN is asked again to create or stop a
// share. Every share belongs to the account that made it.
// Family (build plan M1): one account can hold several people ("Me", "Aama"). Each person has their own papers; the person in
// view is kept per session, and changing it needs the PIN (or fingerprint/face), so a shared phone does not open someone else's papers.
// Photos (M1): "Add a paper" keeps the photo exactly as taken (SHA-256, never changed or overwritten) in the originals store.
// A photo is not read yet and cannot be shared: only papers the patient has confirmed reach a doctor.
import http from 'node:http';
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { randomBytes, createHash } from 'node:crypto';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAuth } from './auth.mjs';
import { akashSender, memorySender, noSender } from './sms.mjs';
import { acsMailSender, memoryMail, noMail } from './mail.mjs';
import { createBackup, googleDriveUploader } from './backup.mjs';
import { createDrive } from './drive.mjs';
import { localOriginals, driveOriginals, EXT } from './originals.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, 'public');
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // 31 letters/digits, no look-alikes
const ALLOWED_MINUTES = [15]; // PRD v2.1 FR-064A: a share lasts 15 minutes. Never "forever". (TEST_MODE also allows 1 minute.)
const MAX_PEOPLE = 6;
const MAX_PHOTO = 15 * 1024 * 1024; // 15 MB: a phone photo, with room to spare
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

export function createApp({ storePath, recordPath = join(HERE, 'data', 'sample-record.json'), testMode = false, seedSample = false, photos = false, originals = null, now = () => Date.now(), sms = memorySender(), mail = memoryMail(), google = null, rp = null, secureCookies = true, authLimits } = {}) {
  const record = JSON.parse(readFileSync(recordPath, 'utf8'));
  let store = { shares: [] };
  if (storePath) {
    mkdirSync(dirname(storePath), { recursive: true });
    if (existsSync(storePath)) store = JSON.parse(readFileSync(storePath, 'utf8'));
  }
  store.records = store.records || {}; // one record per account: { people: [{ id, name, docs, papers }] }. Nobody else's papers are ever visible.
  const pid = () => 'p' + randomBytes(6).toString('hex');
  // Records made before M1 were { label, docs }: they become the account's first person, papers and name kept.
  for (const [k, r] of Object.entries(store.records)) if (!Array.isArray(r.people)) store.records[k] = { people: [{ id: pid(), name: r.label || '', docs: r.docs || [], papers: [] }] };
  const keep = originals || localOriginals(join(storePath ? dirname(storePath) : join(HERE, 'data'), 'originals'));
  const save = () => {
    if (!storePath) return;
    const tmp = storePath + '.tmp';
    writeFileSync(tmp, JSON.stringify(store));
    renameSync(tmp, storePath); // atomic: never a half-written file
  };
  const auth = createAuth({ store, save, now, sms, mail, google, rp, testMode, secureCookies, limits: authLimits });
  const token = () => Array.from(randomBytes(14), b => ALPHABET[b % 31]).join('');
  const stateOf = s => (s.revokedAt ? 'revoked' : now() >= Date.parse(s.expires) ? 'expired' : 'live');
  const log = (s, t) => { s.log.push({ at: new Date(now()).toISOString(), t }); };
  const publicShare = s => ({ id: s.id, docs: s.docs, who: s.who, created: s.created, expires: s.expires, minutes: s.minutes, revokedAt: s.revokedAt || null, state: stateOf(s), log: s.log });

  // refused guesses of unknown tokens: slow down anyone trying to find a live link
  const misses = new Map();
  const tooManyMisses = ip => { const t = now(), a = (misses.get(ip) || []).filter(x => t - x < 60000); a.push(t); misses.set(ip, a); return a.length > 30; };

  const send = (res, code, body, type = 'application/json; charset=utf-8') => {
    res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY' });
    res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  };
  const readRaw = (req, max) => new Promise((resolve, reject) => {
    let n = 0, over = false; const chunks = [];
    req.on('data', c => { n += c.length; if (n > max) over = true; else chunks.push(c); });
    req.on('end', () => resolve(over ? null : Buffer.concat(chunks)));
    req.on('error', reject);
  });
  const readJson = req => new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', c => { n += c.length; if (n > 20000) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch (e) { reject(e); } });
    req.on('error', reject);
  });
  const file = (res, name) => {
    const p = join(PUBLIC, name);
    if (!existsSync(p)) return send(res, 404, { error: 'not found' });
    send(res, 200, readFileSync(p), TYPES[extname(p)] || 'application/octet-stream');
  };

  const handler = async (req, res) => {
    try {
      const url = new URL(req.url, 'http://x');
      const path = url.pathname;
      // Azure App Service puts the caller's address first in x-forwarded-for (with a :port).
      const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim().replace(/:\d+$/, '');
      // Every POST must be JSON: a plain cross-site form cannot send it (with SameSite=Strict cookies, against CSRF).
      // The photo upload is the one exception: raw image bytes, and it must carry the X-Abhilekh-Upload header (a cross-site form cannot).
      if (req.method === 'POST' && !String(req.headers['content-type'] || '').startsWith('application/json') && path !== '/api/papers') return send(res, 415, { error: 'Send JSON.' });
      if (req.method === 'GET' && path === '/healthz') return send(res, 200, { ok: true });
      if (req.method === 'GET' && path === '/') return file(res, 'patient.html');
      if (req.method === 'GET' && (path === '/style.css' || path === '/qrcode.js' || path === '/doctor.js' || path === '/patient.js' || path === '/i18n.js')) return file(res, path.slice(1));
      if (req.method === 'GET' && /^\/s\/[a-z0-9]+$/.test(path)) return file(res, 'doctor.html'); // the shell shows nothing; data comes from /api/s/:id

      if (await auth.route(req, res, path, { ip, send, readJson })) return;

      // --- patient side: signed in only. Each account sees only its own people and papers. ---
      const cur = path.startsWith('/api/') && !path.startsWith('/api/s/') ? auth.current(req) : null;
      if (path.startsWith('/api/') && !path.startsWith('/api/s/') && !cur) return send(res, 401, { error: 'Sign in first.' });
      const mineOnly = s => s.ownerId === cur.account.id;
      const sampleDocs = () => record.docs.map(d => ({ ...JSON.parse(JSON.stringify(d)), origin: 'sample' }));
      const acct = () => (store.records[cur.account.id] = store.records[cur.account.id] || { people: [{ id: pid(), name: '', docs: seedSample ? sampleDocs() : [], papers: [] }] }); // seedSample: tests only
      const mine = () => { const r = acct(); return r.people.find(p => p.id === cur.session.personId) || r.people[0]; }; // the person in view on this session
      const forPerson = s => mineOnly(s) && (s.personId ? s.personId === mine().id : mine() === acct().people[0]); // shares made before M1 belong to the first person
      const paperOut = p => ({ id: p.id, sha256: p.sha256, mime: p.mime, bytes: p.bytes, added: p.added, status: p.status });
      const summary = () => { const r = mine(); return { label: r.name, person: r.id, people: acct().people.map(p => ({ id: p.id, name: p.name, papers: p.docs.length + p.papers.length })), docs: r.docs.map(d => ({ id: d.id, title: d.title, facility: d.facility, date: d.date_as_written, origin: d.origin || 'sample', results: d.results.map(({ img, ...r }) => r) })), papers: r.papers.map(paperOut).reverse(), photos: photos || testMode, testMode, minutes: ALLOWED_MINUTES }; };
      if (req.method === 'GET' && path === '/api/record') return send(res, 200, summary());
      if (req.method === 'POST' && path === '/api/record/sample') { // copy the invented SAMPLE papers into THIS account only; asking twice adds nothing
        const r = mine();
        for (const d of record.docs) if (!r.docs.some(x => x.id === d.id)) r.docs.push({ ...JSON.parse(JSON.stringify(d)), origin: 'sample' });
        save(); return send(res, 200, summary());
      }
      if (req.method === 'POST' && path === '/api/record/label') {
        const b = await readJson(req);
        mine().name = String(b.label || '').replace(/\s+/g, ' ').trim().slice(0, 40);
        save(); return send(res, 200, summary());
      }
      // --- family: one account, several people. Adding needs no PIN (a new record is empty); changing who is in view does. ---
      if (req.method === 'POST' && path === '/api/people') {
        const b = await readJson(req);
        const name = String(b.name || '').replace(/\s+/g, ' ').trim().slice(0, 40);
        if (!name) return send(res, 400, { error: 'Type a name for this person.' });
        if (acct().people.length >= MAX_PEOPLE) return send(res, 400, { error: 'One account can hold up to 6 people.' });
        const p = { id: pid(), name, docs: [], papers: [] };
        acct().people.push(p); cur.session.personId = p.id; save();
        return send(res, 201, summary());
      }
      if (req.method === 'POST' && path === '/api/people/switch') {
        const b = await readJson(req);
        const p = acct().people.find(x => x.id === b.person);
        if (!p) return send(res, 404, { error: 'No such person.' });
        if (p === mine()) return send(res, 200, summary());
        const pin = auth.confirm(cur.account, b);
        if (!pin.ok) return send(res, pin.status, pin);
        cur.session.personId = p.id; save();
        return send(res, 200, summary());
      }
      // --- photos: the original is kept exactly as sent; nothing is read or shared yet ---
      if (req.method === 'POST' && path === '/api/papers') {
        if (!(photos || testMode)) return send(res, 403, { error: 'Adding photos is not switched on yet.' });
        if (req.headers['x-abhilekh-upload'] !== '1') return send(res, 400, { error: 'Bad request.' }); // a cross-site form cannot set this header
        const mime = String(req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
        if (!EXT[mime]) return send(res, 415, { error: 'Send a photo (JPEG, PNG, WebP or HEIC).' });
        const buf = await readRaw(req, MAX_PHOTO);
        if (!buf) return send(res, 413, { error: 'This photo is larger than 15 MB.' });
        if (buf.length < 100) return send(res, 400, { error: 'This photo is empty.' });
        const sha256 = createHash('sha256').update(buf).digest('hex');
        const r = mine();
        if (r.papers.some(x => x.sha256 === sha256)) return send(res, 200, { ...summary(), already: true }); // the same photo twice: kept once
        let ref;
        try { ref = await keep.put(sha256, mime, buf); } catch (e) { console.error('Original not kept: ' + e.message); return send(res, 503, { error: 'The photo could not be kept just now. Nothing was added. Try again in a minute.' }); }
        r.papers.push({ id: pid(), sha256, mime, bytes: buf.length, ref, added: new Date(now()).toISOString(), status: 'waiting' });
        save(); return send(res, 201, summary());
      }
      let mp = path.match(/^\/api\/papers\/(p[0-9a-f]+)\/original$/);
      if (req.method === 'GET' && mp) {
        const p = mine().papers.find(x => x.id === mp[1]); // only the person in view, on their own account
        if (!p) return send(res, 404, { error: 'No such paper.' });
        let buf;
        try { buf = await keep.get(p.ref); } catch (e) { console.error('Original not read: ' + e.message); return send(res, 503, { error: 'The original could not be fetched just now.' }); }
        if (createHash('sha256').update(buf).digest('hex') !== p.sha256) { console.error('Original changed: ' + p.id); return send(res, 500, { error: 'This original does not match what was kept.' }); }
        res.writeHead(200, { 'content-type': p.mime, 'content-length': buf.length, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'content-disposition': 'inline', 'referrer-policy': 'no-referrer' });
        return res.end(buf);
      }
      if (req.method === 'GET' && path === '/api/shares') return send(res, 200, { shares: store.shares.filter(forPerson).map(publicShare).reverse() });
      if (req.method === 'POST' && path === '/api/shares') {
        const b = await readJson(req);
        const pin = auth.confirm(cur.account, b);
        if (!pin.ok) return send(res, pin.status, pin);
        const hold = auth.holdUntil(cur.account);
        if (hold) return send(res, 403, { error: 'New shares are paused until ' + new Date(hold).toISOString() + ', 24 hours after your PIN was reset with a new code. You can still stop shares.', sharesPausedUntil: new Date(hold).toISOString() });
        const docs = Array.isArray(b.docs) ? [...new Set(b.docs)].filter(id => mine().docs.some(d => d.id === id)) : [];
        if (!docs.length) return send(res, 400, { error: 'Choose at least one report to share.' });
        const minutes = Number(b.minutes);
        if (!(ALLOWED_MINUTES.includes(minutes) || (testMode && minutes === 1))) return send(res, 400, { error: 'A share lasts 15 minutes.' });
        const who = String(b.who || '').slice(0, 80);
        const t = now();
        const s = { id: token(), ownerId: cur.account.id, personId: mine().id, docs, who, created: new Date(t).toISOString(), expires: new Date(t + minutes * 60000).toISOString(), minutes, revokedAt: null, log: [] };
        log(s, 'You created this share' + (who ? ' for ' + who : '') + '.');
        store.shares.push(s); save();
        return send(res, 201, publicShare(s));
      }
      let m = path.match(/^\/api\/shares\/([a-z0-9]+)\/stop$/);
      if (req.method === 'POST' && m) {
        const s = store.shares.find(x => x.id === m[1] && mineOnly(x));
        if (!s) return send(res, 404, { error: 'No such share.' });
        // Stopping needs no PIN: it only removes access, so it must be easy, even in a hurry. (Creating a share still asks.)
        if (stateOf(s) === 'live') { s.revokedAt = new Date(now()).toISOString(); log(s, 'You stopped this share.'); save(); }
        return send(res, 200, publicShare(s));
      }

      // --- doctor side: the ONLY place a record leaves, and only while the share is live ---
      m = path.match(/^\/api\/s\/([a-z0-9]+)$/);
      if (req.method === 'GET' && m) {
        const s = store.shares.find(x => x.id === m[1]);
        if (!s) { if (tooManyMisses(ip)) return send(res, 429, { error: 'Too many tries.' }); return send(res, 404, { error: 'This link is not valid.' }); }
        const st = stateOf(s);
        if (st !== 'live') {
          log(s, 'Someone tried to open it, but it was ' + (st === 'revoked' ? 'stopped' : 'out of time') + '. Nothing was shown.'); save();
          return send(res, 410, { state: st });
        }
        log(s, 'Opened on a doctor\'s phone.'); save();
        // The papers of the person it was made for. (Shares made before M1 have no person: any of the owner's people;
        // shares made before records were per patient point at the same ids in the shared SAMPLE file.)
        const ppl = (store.records[s.ownerId] || { people: [] }).people;
        const own = (s.personId ? ppl.filter(p => p.id === s.personId) : ppl).flatMap(p => p.docs);
        const docs = s.docs.map(id => own.find(d => d.id === id) || record.docs.find(d => d.id === id)).filter(Boolean);
        return send(res, 200, { state: 'live', expires: s.expires, docs });
      }
      send(res, 404, { error: 'not found' });
    } catch (e) {
      send(res, 400, { error: 'Bad request.' });
    }
  };
  return { handler, store: () => store };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dataDir = process.env.DATA_DIR || join(HERE, 'data');
  const testMode = process.env.TEST_MODE === '1';
  // Real SMS only when the Akash token is set (Azure app settings). Without it: in TEST_MODE the code is shown on
  // screen; otherwise the server says plainly that codes are not switched on (never "sent" when nothing was sent).
  const sms = process.env.AKASH_SMS_TOKEN ? akashSender({ token: process.env.AKASH_SMS_TOKEN }) : testMode ? memorySender() : noSender();
  // Same for email: real mail only when the connection string is set (Azure app settings).
  const mail = process.env.ACS_EMAIL_CONNECTION_STRING ? acsMailSender({ connectionString: process.env.ACS_EMAIL_CONNECTION_STRING, from: process.env.MAIL_FROM || 'DoNotReply@abhilekh.org' }) : testMode ? memoryMail() : noMail();
  // Google sign-in only when both settings exist (Azure app settings). The client secret never goes in the repository.
  const publicUrl = (process.env.PUBLIC_URL || 'https://app.abhilekh.org').replace(/\/$/, '');
  const google = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET, redirectUri: publicUrl + '/api/auth/google/callback', fetchImpl: fetch } : null;
  const rp = { id: new URL(publicUrl).hostname, origin: new URL(publicUrl).origin }; // passkeys belong to this site only
  console.log('SMS sender: ' + sms.name + '; mail sender: ' + mail.name + '; Google sign-in: ' + (google ? 'on' : 'off') + '; passkeys: ' + rp.id);
  // Originals (paper photos): the Google shared drive when the Google settings are set, else the app's own disk.
  // Adding photos is on only with PHOTOS_ENABLED=1 (on in production since 25 Nov 2026, live test with real papers).
  let originals = null;
  if (process.env.GOOGLE_BACKUP_SA_JSON && process.env.GOOGLE_BACKUP_FOLDER_ID) {
    try { originals = driveOriginals(createDrive({ credentials: JSON.parse(process.env.GOOGLE_BACKUP_SA_JSON) }), process.env.GOOGLE_BACKUP_FOLDER_ID); }
    catch (e) { console.error('Originals: Google Drive settings are not usable: ' + e.message); }
  }
  const photos = process.env.PHOTOS_ENABLED === '1';
  console.log('Photos: ' + (photos || testMode ? 'on' : 'off (PHOTOS_ENABLED)') + '; originals kept in ' + (originals ? 'Google Drive' : join(dataDir, 'originals')));
  const app = createApp({ storePath: join(dataDir, 'store.json'), testMode, photos, originals, sms, mail, google, rp, secureCookies: process.env.INSECURE_COOKIES !== '1' });
  // Daily backup of store.json: local copies in DATA_DIR/backups, plus Google Drive when both Google settings are set.
  let uploader = null;
  if (process.env.GOOGLE_BACKUP_SA_JSON && process.env.GOOGLE_BACKUP_FOLDER_ID) {
    try { uploader = googleDriveUploader({ credentials: JSON.parse(process.env.GOOGLE_BACKUP_SA_JSON), folderId: process.env.GOOGLE_BACKUP_FOLDER_ID }); }
    catch (e) { console.error('Backups: Google Drive settings are not usable: ' + e.message); }
  }
  console.log('Backups: daily to ' + join(dataDir, 'backups') + (uploader ? ' and Google Drive' : '; no second place set (GOOGLE_BACKUP_SA_JSON, GOOGLE_BACKUP_FOLDER_ID)'));
  createBackup({ storePath: join(dataDir, 'store.json'), dir: join(dataDir, 'backups'), uploader }).start();
  const port = Number(process.env.PORT || 8080);
  http.createServer(app.handler).listen(port, () => console.log('Abhilekh server on port ' + port));
}
