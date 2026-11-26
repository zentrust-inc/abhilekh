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
import { createBackup, googleDriveUploader, moveToDrive, moveArchivedPhotos } from './backup.mjs';
import { createDrive } from './drive.mjs';
import { localOriginals, driveOriginals, EXT } from './originals.mjs';
import { createReading, cropsOf } from './reading.mjs';
import { createRegister } from './register.mjs';
import { createRecordModel } from './record.mjs';
// The reader lives in reader/ (one home, reused from Chautari). In the repository it is ../reader; on the server it is
// deployed next to this file as ./reader.
const READER = existsSync(join(dirname(fileURLToPath(import.meta.url)), 'reader')) ? './reader/' : '../reader/';
const { loose, norm, mustConfirmValue, confirmsDose } = await import(READER + 'normalise.mjs');
const { loadList, checkMedicine, namePart } = await import(READER + 'medicine-check.mjs');
const { valueRegion, rangeRegion, dateRegion } = await import(READER + 'regions.mjs');
const { checkCopy } = await import(READER + 'copy.mjs');
// Spec v1.0 checklist (reader/checklist.mjs reads ../schema/checklist.json). Loaded so that a deployment without it
// still runs: only the record endpoints answer 503 until schema/ is deployed next to reader/.
let CHECKLIST = null;
try { CHECKLIST = await import(READER + 'checklist.mjs'); } catch (e) { console.error('Checklist rules not loaded: ' + e.message); }
const RULES = { checkCopy, loose, norm, mustConfirmValue, confirmsDose, checkMedicine, namePart, valueRegion, rangeRegion, dateRegion, ddaIndex: loadList(fileURLToPath(new URL(READER + 'dda/nlem-2021.json', import.meta.url))) };

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, 'public');
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // 31 letters/digits, no look-alikes
const ALLOWED_MINUTES = [15]; // PRD v2.1 FR-064A: a share lasts 15 minutes. Never "forever". (TEST_MODE also allows 1 minute.)
const MAX_PEOPLE = 6;
const KIND_TITLE = { lab_report: 'Lab report', prescription: 'Prescription', other: 'Paper' };
const MAX_PHOTO = 15 * 1024 * 1024; // 15 MB: a phone photo, with room to spare
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

export function createApp({ storePath, recordPath = join(HERE, 'data', 'sample-record.json'), testMode = false, seedSample = false, photos = false, originals = null, readers = null, readingLimits = {}, registerIndex = null, now = () => Date.now(), sms = memorySender(), mail = memoryMail(), google = null, rp = null, secureCookies = true, authLimits, onSave = null, helpWhatsapp = null } = {}) {
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
    if (onSave) try { onSave(); } catch (e) { console.error('After save: ' + e.message); } // the live copy to Drive (backup.mjs)
  };
  // M2: photos are read by the two readers (Claude, Google Vision) when both are set up; otherwise they wait.
  const register = createRegister({ index: registerIndex, namePart: RULES.namePart });
  // Spec v1.0 record model: consensus, the append-only decision log, the gate, items (record.mjs).
  const model = CHECKLIST ? createRecordModel({ expand: CHECKLIST.expand, gate: CHECKLIST.gate, needsOwnTap: CHECKLIST.needsOwnTap, loose, now }) : null;
  const reading = readers ? createReading({ store, save, keep, readers, rules: RULES, register, record: model, now, ...readingLimits }) : null;
  const auth = createAuth({ store, save, now, sms, mail, google, rp, testMode, secureCookies, limits: authLimits });
  const token = () => Array.from(randomBytes(14), b => ALPHABET[b % 31]).join('');
  const stateOf = s => (s.revokedAt ? 'revoked' : now() >= Date.parse(s.expires) ? 'expired' : 'live');
  const log = (s, t) => { s.log.push({ at: new Date(now()).toISOString(), t }); };
  const publicShare = s => ({ id: s.id, docs: s.docs, stated: !!s.stated, who: s.who, created: s.created, expires: s.expires, minutes: s.minutes, revokedAt: s.revokedAt || null, state: stateOf(s), log: s.log });

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
  const readJson = (req, max = 20000) => new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', c => { n += c.length; if (n > max) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
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
      if (req.method === 'GET' && (path === '/style.css' || path === '/help.js' || path === '/qrcode.js' || path === '/doctor.js' || path === '/patient.js' || path === '/i18n.js' || path === '/medline.js')) return file(res, path.slice(1));
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
      const paperOut = p => ({ id: p.id, sha256: p.sha256, mime: p.mime, bytes: p.bytes, added: p.added, status: p.status, reading: p.reading ? { ...p.reading, usd: undefined } : null });
      const summary = () => { const r = mine(); return { label: r.name, person: r.id, people: acct().people.map(p => ({ id: p.id, name: p.name, papers: p.docs.length + p.papers.length })), docs: r.docs.map(d => ({ id: d.id, title: d.title, facility: d.facility, date: d.date_as_written, origin: d.origin || 'sample', paper: d.paperId || null, results: d.results.map(({ img, ...r }) => r), medicines: d.medicines || [] })).reverse(), papers: r.papers.map(paperOut).reverse(), stated: { allergies: (r.stated && r.stated.allergies) || [] }, photos: photos || testMode, testMode, minutes: ALLOWED_MINUTES, help: { whatsapp: helpWhatsapp } }; };
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
        const paper = { id: pid(), sha256, mime, bytes: buf.length, ref, added: new Date(now()).toISOString(), status: 'waiting' };
        r.papers.push(paper);
        save(); if (reading) reading.enqueue(paper.id); return send(res, 201, summary());
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
      // --- Told by the patient (decided 26 Nov 2026): allergies only. Kept apart from what papers say, shown everywhere as
      // "Told by the patient · not from a paper". Stored as typed; Abhilekh adds nothing (no severity, no drug matching, no
      // warning). Adding needs no PIN, like adding a paper; removing needs the PIN, like deleting a paper.
      if (req.method === 'POST' && path === '/api/stated/allergies') {
        const b = await readJson(req);
        const clean = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
        const substance = clean(b.substance, 80), reaction = clean(b.reaction, 160);
        if (!substance) return send(res, 400, { error: 'Type what you are allergic to.' });
        const r = mine(); r.stated = r.stated || { allergies: [] };
        if (r.stated.allergies.length >= 30) return send(res, 400, { error: 'Up to 30 allergies can be added.' });
        r.stated.allergies.push({ id: 'a' + randomBytes(6).toString('hex'), substance, reaction: reaction || null, added: new Date(now()).toISOString() });
        save();
        return send(res, 201, summary());
      }
      mp = path.match(/^\/api\/stated\/allergies\/(a[0-9a-f]+)\/delete$/);
      if (req.method === 'POST' && mp) {
        const b = await readJson(req);
        const ok = auth.confirm(cur.account, b);
        if (!ok.ok) return send(res, ok.status, ok);
        const r = mine(), list = (r.stated && r.stated.allergies) || [];
        if (!list.some(a => a.id === mp[1])) return send(res, 404, { error: 'No such allergy.' });
        r.stated.allergies = list.filter(a => a.id !== mp[1]);
        save();
        return send(res, 200, summary());
      }

      // --- Deleting (decided 26 Nov 2026). The patient deletes a paper or her whole account, confirmed with her PIN or
      // fingerprint/face. Gone at once from the app, and from store-live.json in Google Drive within a minute; the photo
      // is deleted in the shared drive (or put in its trash, which Google empties after 30 days); dated snapshots older
      // than 30 days are removed (backup.mjs). So every copy is gone within 30 days. Nothing is kept about what it was.
      const refUsed = ref => Object.values(store.records).some(r => (r.people || []).some(p => (p.papers || []).some(x => x.ref === ref)));
      const dropShares = ids => {
        if (!ids.size) return;
        for (const s of store.shares.filter(mineOnly)) s.docs = s.docs.filter(d => !ids.has(d));
        store.shares = store.shares.filter(s => !(mineOnly(s) && !s.docs.length)); // a share with nothing left in it goes too
      };
      const removePhoto = async ref => {
        if (!ref || refUsed(ref)) return 'kept';
        try { return await keep.remove(ref); } catch (e) { console.error('Original not removed: ' + e.message); return 'failed'; }
      };
      async function dropPaper(r, p) {
        const gone = new Set(r.docs.filter(d => d.paperId === p.id).map(d => d.id));
        r.docs = r.docs.filter(d => d.paperId !== p.id);
        r.papers = r.papers.filter(x => x !== p);
        dropShares(gone);
        return removePhoto(p.ref);
      }
      mp = path.match(/^\/api\/(papers|docs)\/([A-Za-z0-9_-]{1,40})\/delete$/);
      if (req.method === 'POST' && mp) {
        const b = await readJson(req);
        const ok = auth.confirm(cur.account, b);
        if (!ok.ok) return send(res, ok.status, ok);
        const r = mine();
        const doc = mp[1] === 'docs' ? r.docs.find(d => d.id === mp[2]) : null;
        const p = mp[1] === 'papers' ? r.papers.find(x => x.id === mp[2]) : doc?.paperId ? r.papers.find(x => x.id === doc.paperId) : null;
        if (!p && !doc) return send(res, 404, { error: 'No such paper.' });
        let photo = 'none';
        if (p) photo = await dropPaper(r, p);
        else { r.docs = r.docs.filter(d => d !== doc); dropShares(new Set([doc.id])); } // an entry with no photo (a SAMPLE page)
        save();
        return send(res, 200, { ...summary(), deleted: true, photo });
      }
      if (req.method === 'POST' && path === '/api/account/delete') {
        const b = await readJson(req);
        if (b.confirm !== 'DELETE') return send(res, 400, { error: 'Type DELETE to confirm.' });
        const ok = auth.confirm(cur.account, b);
        if (!ok.ok) return send(res, ok.status, ok);
        const rec = store.records[cur.account.id] || { people: [] };
        const refs = rec.people.flatMap(p => (p.papers || []).map(x => x.ref)).filter(Boolean);
        delete store.records[cur.account.id];
        store.shares = store.shares.filter(s => s.ownerId !== cur.account.id);
        const photos = { deleted: 0, trashed: 0, failed: 0, kept: 0 };
        for (const ref of refs) photos[await removePhoto(ref)]++;
        auth.removeAccount(res, cur.account); // saves; clears the sign-in cookies
        return send(res, 200, { deleted: true, photos });
      }

      // --- Spec v1.0 record (data only; the screens come later). The person in view, on their own account. ---
      // GET  /api/papers/:id/model   the copy per path (agreement, pre-fill, state), what blocks it, and its items once clear
      // POST /api/papers/:id/events  { events: [{ path, action, value?, bulk? }] } appended to the paper's log, all or none
      mp = path.match(/^\/api\/papers\/(p[0-9a-f]+)\/(model|events)$/);
      if (mp) {
        if (!model) return send(res, 503, { error: 'The record rules are not deployed yet.' });
        const p = mine().papers.find(x => x.id === mp[1]);
        if (!p) return send(res, 404, { error: 'No such paper.' });
        const view = () => ({ paper: p.id, status: p.status, model: 'abhilekh.record.v1', copy_at: p.reading?.at || null,
          fields: Object.values(model.current(p)), gate: model.gateOf(p), items: model.itemsOf(p), log: (p.log || []).length });
        if (req.method === 'GET' && mp[2] === 'model') return send(res, 200, view());
        if (req.method === 'POST' && mp[2] === 'events') {
          if (!p.reading?.copy) return send(res, 409, { error: 'This paper has no full copy yet.' });
          const b = await readJson(req, 200000);
          if (!Array.isArray(b.events) || !b.events.length || b.events.length > 2000) return send(res, 400, { error: 'Send a list of events.' });
          try { model.append(p, b.events, { kind: 'patient', person: mine().id }); }
          catch (e) { return send(res, e.status || 400, { error: e.status ? e.message : 'Bad request.' }); }
          save();
          return send(res, 200, view());
        }
        return send(res, 405, { error: 'Not allowed.' });
      }
      // --- M3: the patient checks what the readers found against the paper, then adds it to the record ---
      // Rules (PRD v2.1, date changed 25 Nov 2026): the date is filled in only when both readers agree and then needs its own tick, otherwise typed; a value with a decimal point needs its own tick; an Unresolved field is
      // typed from the paper or left Unresolved. Nothing reaches a doctor until this is done. The server checks the same.
      mp = path.match(/^\/api\/papers\/(p[0-9a-f]+)\/confirm$/);
      if (req.method === 'POST' && mp) {
        const r = mine(), p = r.papers.find(x => x.id === mp[1]);
        if (!p) return send(res, 404, { error: 'No such paper.' });
        if (p.status !== 'ready' || !p.reading) return send(res, 409, { error: 'This paper is not ready to check yet.' });
        const b = await readJson(req, 200000);
        const str = (v, n = 200) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
        const rd = p.reading, UN = 'Unresolved. Original document available.';
        // the date: filled in only when both readers agreed, and then the patient ticks it herself; otherwise she types it
        const sentDate = b.date && typeof b.date === 'object' ? b.date : { value: b.date, ok: false };
        const date = str(sentDate.value, 40);
        if (!date) return send(res, 400, { error: 'Type the date exactly as it is printed on the paper.' });
        if (rd.date && rd.date.state === 'confirm' && !sentDate.ok) return send(res, 400, { error: 'Check the date against the paper.' });
        // each submitted field: { value, ok } where ok = the patient ticked "Matches the paper" (or typed it) or chose to leave it Unresolved
        const take = (sent, from, label) => {
          if (sent?.none) return ''; // "Not written on the paper"
          const v = str(sent?.value), keep = !!sent?.unresolved;
          if (from && from.state === 'confirm' && !sent?.ok && !keep) throw Object.assign(new Error('Check ' + label + ' against the paper.'), { status: 400 });
          if (from && from.state === 'unresolved' && !v && !keep) throw Object.assign(new Error('Type ' + label + ' from the paper, or leave it Unresolved.'), { status: 400 });
          return keep && !v ? UN : v;
        };
        let results, medicines;
        try {
          const R = Array.isArray(b.results) ? b.results : [], M = Array.isArray(b.medicines) ? b.medicines : [];
          if (R.length !== rd.results.length || M.length !== rd.medicines.length) return send(res, 400, { error: 'Bad request.' });
          results = rd.results.map((x, i) => R[i]?.removed ? null : ({ test: take(R[i].test, x.test, 'the test name'), value: take(R[i].value, x.value, 'the value of ' + (x.test.text || x.test.a || 'a test')), unit: take(R[i].unit, x.unit, 'the unit'), range: take(R[i].range, x.range, 'the printed range'), flag: take(R[i].flag, x.flag, 'the printed flag'), box: x.vregion?.box || null })).filter(Boolean);
          medicines = rd.medicines.map((x, i) => { if (M[i]?.removed) return null; const w = take(M[i].as_written, x.as_written, 'the medicine line');
            const reg = register.lookup(w); // looked up again on what the patient confirmed: exact name only
            return { as_written: w, dose: take(M[i].dose, x.dose, 'the dose'), duration: take(M[i].duration, x.duration, 'the duration'), dda: reg ? 'on_register' : x.dda === 'on_register' ? 'not_found' : x.dda, register: reg }; }).filter(Boolean);
        } catch (e) { return send(res, e.status || 400, { error: e.status ? e.message : 'Bad request.' }); }
        let crops = results.map(() => null);
        try { crops = cropsOf(await keep.get(p.ref), p.mime, results.map(x => x.box)); } catch (e) { console.error('Crops not made: ' + e.message); }
        const doc = { id: 'd' + p.id.slice(1), paperId: p.id, origin: 'photo', title: KIND_TITLE[rd.kind] || 'Paper', facility: str(b.facility) || '', clinician: str(b.clinician) || '', patient: '', date_as_written: date,
          results: results.map(({ box, ...x }, i) => ({ ...x, ...(crops[i] ? { img: crops[i] } : {}) })), medicines, confirmedAt: new Date(now()).toISOString() };
        r.docs = r.docs.filter(d => d.paperId !== p.id); r.docs.push(doc);
        p.status = 'confirmed'; save();
        return send(res, 200, summary());
      }
      if (req.method === 'GET' && path === '/api/shares') return send(res, 200, { shares: store.shares.filter(forPerson).map(publicShare).reverse() });
      if (req.method === 'POST' && path === '/api/shares') {
        const b = await readJson(req);
        const pin = auth.confirm(cur.account, b);
        if (!pin.ok) return send(res, pin.status, pin);
        const hold = auth.holdUntil(cur.account);
        if (hold) return send(res, 403, { error: 'New shares are paused until ' + new Date(hold).toISOString() + ', 24 hours after your PIN was reset with a new code. You can still stop shares.', sharesPausedUntil: new Date(hold).toISOString() });
        const docs = Array.isArray(b.docs) ? [...new Set(b.docs)].filter(id => mine().docs.some(d => d.id === id)) : [];
        const stated = !!b.stated && !!(mine().stated && mine().stated.allergies.length); // allergies told by the patient, if she chose them
        if (!docs.length && !stated) return send(res, 400, { error: 'Choose at least one report to share.' });
        const minutes = Number(b.minutes);
        if (!(ALLOWED_MINUTES.includes(minutes) || (testMode && minutes === 1))) return send(res, 400, { error: 'A share lasts 15 minutes.' });
        const who = String(b.who || '').slice(0, 80);
        const t = now();
        const s = { id: token(), ownerId: cur.account.id, personId: mine().id, docs, stated, who, created: new Date(t).toISOString(), expires: new Date(t + minutes * 60000).toISOString(), minutes, revokedAt: null, log: [] };
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
      // the whole original photo of a confirmed paper, only while the share is live (the doctor's view lays the watermark over it)
      m = path.match(/^\/api\/s\/([a-z0-9]+)\/original\/(d[0-9a-f]+)$/);
      if (req.method === 'GET' && m) {
        const s = store.shares.find(x => x.id === m[1]);
        if (!s || stateOf(s) !== 'live' || !s.docs.includes(m[2])) return send(res, 410, { error: 'This share is not live.' });
        const ppl = (store.records[s.ownerId] || { people: [] }).people;
        const doc = ppl.flatMap(p => p.docs).find(d => d.id === m[2]);
        const paper = doc && ppl.flatMap(p => p.papers).find(p => p.id === doc.paperId);
        if (!paper) return send(res, 404, { error: 'not found' });
        let buf; try { buf = await keep.get(paper.ref); } catch (e) { return send(res, 503, { error: 'The original could not be fetched just now.' }); }
        if (createHash('sha256').update(buf).digest('hex') !== paper.sha256) return send(res, 500, { error: 'This original does not match what was kept.' });
        log(s, 'The original photo was opened on a doctor\'s phone.'); save();
        res.writeHead(200, { 'content-type': paper.mime, 'content-length': buf.length, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'content-disposition': 'inline', 'referrer-policy': 'no-referrer' });
        return res.end(buf);
      }
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
        // Allergies told by the patient: only if she chose them for this share; always labelled as not from a paper.
        const person = s.personId ? ppl.find(p => p.id === s.personId) : ppl[0];
        const told = s.stated && person && person.stated ? person.stated.allergies.map(({ substance, reaction, added }) => ({ substance, reaction, added })) : [];
        return send(res, 200, { state: 'live', expires: s.expires, docs, stated: told.length ? { label: 'Told by the patient · not from a paper', allergies: told } : null });
      }
      send(res, 404, { error: 'not found' });
    } catch (e) {
      send(res, 400, { error: 'Bad request.' });
    }
  };
  return { handler, store: () => store, reading, register, useRegister: i => { register.set(i); return reading ? reading.refreshRegister() : 0; } };
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
  // M2 readers: Claude (fields) and Google Cloud Vision (lines that confirm them). Both keys must be set (Azure app
  // settings only). Limits: US$0.10 a page, US$20 a month (25 Nov 2026).
  let readers = null;
  if (process.env.ANTHROPIC_API_KEY && process.env.VISION_API_KEY) {
    const eng = await import(READER + 'engines.mjs'), vis = await import(READER + 'vision.mjs');
    readers = { claude: (b, m) => eng.readClaudeBytes(b, m), vision: b => vis.readVisionBytes(b) };
  }
  console.log('Reading: ' + (readers ? 'on (Claude + Google Vision; US$0.10 a page, US$20 a month)' : 'off (ANTHROPIC_API_KEY and VISION_API_KEY are both needed)'));
  console.log('Photos: ' + (photos || testMode ? 'on' : 'off (PHOTOS_ENABLED)') + '; originals kept in ' + (originals ? 'Google Drive' : join(dataDir, 'originals')));
  let backup = null; // set below; every save tells it the store changed
  const app = createApp({ storePath: join(dataDir, 'store.json'), testMode, photos, originals, readers, sms, mail, google, rp, secureCookies: process.env.INSECURE_COOKIES !== '1', onSave: () => backup?.changed(),
    helpWhatsapp: (process.env.HELP_WHATSAPP || '').replace(/\D/g, '') || null }); // Help › Contact us; hidden until set
  // Daily backup of store.json: local copies in DATA_DIR/backups, plus Google Drive when both Google settings are set.
  let uploader = null;
  if (process.env.GOOGLE_BACKUP_SA_JSON && process.env.GOOGLE_BACKUP_FOLDER_ID) {
    try { uploader = googleDriveUploader({ credentials: JSON.parse(process.env.GOOGLE_BACKUP_SA_JSON), folderId: process.env.GOOGLE_BACKUP_FOLDER_ID }); }
    catch (e) { console.error('Backups: Google Drive settings are not usable: ' + e.message); }
  }
  console.log('Backups: ' + (uploader ? 'live copy to Google Drive within a minute of every change; daily snapshots to ' + join(dataDir, 'backups') + ' and Google Drive'
    : 'daily snapshots to ' + join(dataDir, 'backups') + ' only; no second place set (GOOGLE_BACKUP_SA_JSON, GOOGLE_BACKUP_FOLDER_ID)'));
  backup = createBackup({ storePath: join(dataDir, 'store.json'), dir: join(dataDir, 'backups'), uploader });
  backup.start();
  // Archives left on this disk (test papers) belong only in the shared drive: move them, deleting here only when Drive confirms.
  // Their photos go first (within the shared drive, originals -> test-papers/photos), while the archive is still here to say which.
  if (uploader) (async () => {
    try {
      const drive = createDrive({ credentials: JSON.parse(process.env.GOOGLE_BACKUP_SA_JSON) });
      const p = await moveArchivedPhotos({ dir: join(dataDir, 'test-papers'), drive, rootFolderId: process.env.GOOGLE_BACKUP_FOLDER_ID, folderName: 'test-papers', liveStore: app.store() });
      if (p.moved || p.skipped || p.failed) console.log('Test-paper photos to test-papers/photos: ' + p.moved + ' moved, ' + p.skipped + ' still used by an account, ' + p.failed + ' failed');
      if (p.failed) return console.error('Test papers kept here until every photo is moved.');
      const r = await moveToDrive({ dir: join(dataDir, 'test-papers'), uploader, folderName: 'test-papers' });
      if (r.moved || r.kept) console.log('Test papers to Google Drive: ' + r.moved + ' moved, ' + r.kept + ' kept here');
    } catch (e) { console.error('Test papers not moved: ' + e.message); }
  })();
  const port = Number(process.env.PORT || 8080);
  http.createServer(app.handler).listen(port, () => console.log('Abhilekh server on port ' + port));
  if (app.reading) app.reading.resume(); // read what is waiting, including photos added before reading was switched on
  // The DDA register (brand index): the newest abhilekh-register-index-*.json in the shared drive's "register" folder.
  if (process.env.GOOGLE_BACKUP_SA_JSON && process.env.GOOGLE_BACKUP_FOLDER_ID) (async () => {
    try {
      const drive = createDrive({ credentials: JSON.parse(process.env.GOOGLE_BACKUP_SA_JSON) });
      const folder = await drive.folder('register', process.env.GOOGLE_BACKUP_FOLDER_ID);
      const f = await drive.latest('abhilekh-register-index-', folder);
      if (!f) return console.log('Register: none found in the shared drive (folder "register")');
      const index = JSON.parse((await drive.download(f.id)).toString('utf8'));
      const n = app.useRegister(index);
      console.log('Register: ' + f.name + ' (' + Object.keys(index.entries).length + ' names); added to ' + n + ' papers waiting to be checked');
    } catch (e) { console.error('Register not loaded: ' + e.message); }
  })();
}
