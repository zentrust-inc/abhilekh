// Abhilekh share server (prototype, SAMPLE data only).
// Zero dependencies: node:http + a JSON file. Expiry and revocation are enforced HERE, not in the page.
//
// What it does: stores shares of confirmed SAMPLE records, serves the doctor's view only while a share is live,
// logs every open and every refused open, lets the patient stop a share.
// What it does not do yet: accounts. There is one sample patient and no sign-in, so anyone who can reach the
// patient page can create shares. That is acceptable ONLY because every record here is invented.
import http from 'node:http';
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, 'public');
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // 31 letters/digits, no look-alikes
const ALLOWED_MINUTES = [60, 1440, 10080]; // 1 hour, 24 hours, 7 days. Never "forever".
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

export function createApp({ storePath, recordPath = join(HERE, 'data', 'sample-record.json'), testMode = false, now = () => Date.now() } = {}) {
  const record = JSON.parse(readFileSync(recordPath, 'utf8'));
  let store = { shares: [] };
  if (storePath) {
    mkdirSync(dirname(storePath), { recursive: true });
    if (existsSync(storePath)) store = JSON.parse(readFileSync(storePath, 'utf8'));
  }
  const save = () => {
    if (!storePath) return;
    const tmp = storePath + '.tmp';
    writeFileSync(tmp, JSON.stringify(store));
    renameSync(tmp, storePath); // atomic: never a half-written file
  };
  const token = () => Array.from(randomBytes(14), b => ALPHABET[b % 31]).join('');
  const stateOf = s => (s.revokedAt ? 'revoked' : now() >= Date.parse(s.expires) ? 'expired' : 'live');
  const log = (s, t) => { s.log.push({ at: new Date(now()).toISOString(), t }); };
  const publicShare = s => ({ id: s.id, docs: s.docs, who: s.who, created: s.created, expires: s.expires, minutes: s.minutes, revokedAt: s.revokedAt || null, state: stateOf(s), log: s.log });

  // refused guesses of unknown tokens: slow down anyone trying to find a live link
  const misses = new Map();
  const tooManyMisses = ip => { const t = now(), a = (misses.get(ip) || []).filter(x => t - x < 60000); a.push(t); misses.set(ip, a); return a.length > 30; };

  const send = (res, code, body, type = 'application/json; charset=utf-8') => {
    res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer' });
    res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  };
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
      const ip = req.socket.remoteAddress || '';
      if (req.method === 'GET' && path === '/healthz') return send(res, 200, { ok: true });
      if (req.method === 'GET' && path === '/') return file(res, 'patient.html');
      if (req.method === 'GET' && (path === '/style.css' || path === '/qrcode.js' || path === '/doctor.js' || path === '/patient.js')) return file(res, path.slice(1));
      if (req.method === 'GET' && /^\/s\/[a-z0-9]+$/.test(path)) return file(res, 'doctor.html'); // the shell shows nothing; data comes from /api/s/:id

      // --- patient side (one sample patient, no sign-in yet) ---
      if (req.method === 'GET' && path === '/api/record') return send(res, 200, { docs: record.docs.map(d => ({ id: d.id, title: d.title, facility: d.facility, date: d.date_as_written })), testMode, minutes: ALLOWED_MINUTES });
      if (req.method === 'GET' && path === '/api/shares') return send(res, 200, { shares: store.shares.map(publicShare).reverse() });
      if (req.method === 'POST' && path === '/api/shares') {
        const b = await readJson(req);
        const docs = Array.isArray(b.docs) ? [...new Set(b.docs)].filter(id => record.docs.some(d => d.id === id)) : [];
        if (!docs.length) return send(res, 400, { error: 'Choose at least one report to share.' });
        const minutes = Number(b.minutes);
        if (!(ALLOWED_MINUTES.includes(minutes) || (testMode && minutes === 1))) return send(res, 400, { error: 'Choose 1 hour, 24 hours or 7 days.' });
        const who = String(b.who || '').slice(0, 80);
        const t = now();
        const s = { id: token(), docs, who, created: new Date(t).toISOString(), expires: new Date(t + minutes * 60000).toISOString(), minutes, revokedAt: null, log: [] };
        log(s, 'You created this share' + (who ? ' for ' + who : '') + '.');
        store.shares.push(s); save();
        return send(res, 201, publicShare(s));
      }
      let m = path.match(/^\/api\/shares\/([a-z0-9]+)\/stop$/);
      if (req.method === 'POST' && m) {
        const s = store.shares.find(x => x.id === m[1]);
        if (!s) return send(res, 404, { error: 'No such share.' });
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
        return send(res, 200, { state: 'live', expires: s.expires, docs: record.docs.filter(d => s.docs.includes(d.id)) });
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
  const app = createApp({ storePath: join(dataDir, 'store.json'), testMode: process.env.TEST_MODE === '1' });
  const port = Number(process.env.PORT || 8080);
  http.createServer(app.handler).listen(port, () => console.log('Abhilekh share server (SAMPLE data) on port ' + port));
}
