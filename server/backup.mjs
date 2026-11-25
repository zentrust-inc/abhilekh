// Daily backup of store.json (app build plan v1, M0). Zero dependencies.
//
// 1. Every day (and once at start-up) the current store is copied to DATA_DIR/backups/store-YYYY-MM-DD.json.
//    The last KEEP_DAYS copies are kept; older ones are removed.
// 2. The "second place" is Google Drive (decided 25 Nov 2026): if GOOGLE_BACKUP_SA_JSON (a Google service
//    account key, set only as an Azure app setting, never in the repository) and GOOGLE_BACKUP_FOLDER_ID (a
//    folder in a Google *shared drive* where that service account is a Content manager) are both set, the same
//    copy is also uploaded there as store-YYYY-MM-DD.json. That copy survives if the app's own disk is lost.
//    Without the settings, only the local copies are made, and the start-up log says so.
//
// Restore: stop the app, copy a backup over DATA_DIR/store.json, start the app. `restoreBackup` does the copy
// and checks that the file is a readable store first (see test/backup.test.mjs).
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, readdirSync, unlinkSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { createSign } from 'node:crypto';

const DAY = 24 * 60 * 60 * 1000;
const NAME = /^store-(\d{4}-\d{2}-\d{2})\.json$/;

export function backupName(t) { return 'store-' + new Date(t).toISOString().slice(0, 10) + '.json'; }

// A store must parse and have the shape the server expects; a broken file is never copied or restored.
export function checkStore(text) {
  const s = JSON.parse(text);
  if (!s || typeof s !== 'object' || !Array.isArray(s.shares)) throw new Error('Not an Abhilekh store: no shares list.');
  return s;
}

export function createBackup({ storePath, dir, keepDays = 30, uploader = null, now = () => Date.now(), logger = console } = {}) {
  mkdirSync(dir, { recursive: true });

  async function upload(name, body) {
    if (!uploader) return 'skipped';
    await uploader(name, body);
    return 'uploaded';
  }

  async function run() {
    if (!existsSync(storePath)) return { ok: true, note: 'no store yet' };
    const text = readFileSync(storePath, 'utf8');
    checkStore(text); // never back up a half-written or broken file
    const name = backupName(now());
    const tmp = join(dir, name + '.tmp');
    writeFileSync(tmp, text);
    renameSync(tmp, join(dir, name));
    // keep the newest keepDays copies
    const all = readdirSync(dir).filter(f => NAME.test(f)).sort();
    for (const f of all.slice(0, Math.max(0, all.length - keepDays))) unlinkSync(join(dir, f));
    let remote = 'skipped';
    try { remote = await upload(name, text); } catch (e) { logger.error('Backup upload failed: ' + e.message); remote = 'failed'; }
    return { ok: true, name, remote, kept: Math.min(all.length, keepDays) };
  }

  function start() {
    const go = () => run().then(r => logger.log('Backup: ' + JSON.stringify(r))).catch(e => logger.error('Backup failed: ' + e.message));
    go();
    const t = setInterval(go, DAY);
    t.unref?.();
    return () => clearInterval(t);
  }

  return { run, start, list: () => readdirSync(dir).filter(f => NAME.test(f)).sort() };
}

// Copy a backup over the live store, only if it is a readable store. The app must be stopped first.
export function restoreBackup({ backupPath, storePath }) {
  checkStore(readFileSync(backupPath, 'utf8'));
  if (existsSync(storePath)) copyFileSync(storePath, storePath + '.before-restore');
  copyFileSync(backupPath, storePath);
}

// Google Drive uploader. Zero dependencies: a service-account JWT (RS256, node:crypto) is exchanged for an
// access token, then the file is sent with a multipart upload. supportsAllDrives=true because a service account
// has no storage of its own: the folder must be in a shared drive (Workspace), where the files count against
// the organisation's pooled storage.
const b64url = b => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
export function googleDriveUploader({ credentials, folderId, fetchImpl = globalThis.fetch, now = () => Date.now() }) {
  if (!credentials?.client_email || !credentials?.private_key) throw new Error('GOOGLE_BACKUP_SA_JSON is not a service account key.');
  if (!folderId) throw new Error('GOOGLE_BACKUP_FOLDER_ID is missing.');
  const tokenUri = credentials.token_uri || 'https://oauth2.googleapis.com/token';
  let cached = null;
  async function token() {
    const t = Math.floor(now() / 1000);
    if (cached && cached.exp - 60 > t) return cached.token;
    const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claim = b64url(JSON.stringify({ iss: credentials.client_email, scope: 'https://www.googleapis.com/auth/drive', aud: tokenUri, iat: t, exp: t + 3600 }));
    const sig = b64url(createSign('RSA-SHA256').update(head + '.' + claim).sign(credentials.private_key));
    const r = await fetchImpl(tokenUri, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: head + '.' + claim + '.' + sig }).toString() });
    if (r.status !== 200) throw new Error('Google token answered ' + r.status);
    const j = await r.json();
    cached = { token: j.access_token, exp: t + (j.expires_in || 3600) };
    return cached.token;
  }
  return async function upload(name, body) {
    const boundary = 'abhilekh' + Math.random().toString(36).slice(2);
    const multipart = '--' + boundary + '\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify({ name, parents: [folderId], mimeType: 'application/json' }) +
      '\r\n--' + boundary + '\r\ncontent-type: application/json\r\n\r\n' + body + '\r\n--' + boundary + '--';
    const r = await fetchImpl('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id', { method: 'POST', headers: { authorization: 'Bearer ' + await token(), 'content-type': 'multipart/related; boundary=' + boundary }, body: multipart });
    if (r.status !== 200) throw new Error('Google Drive upload answered ' + r.status);
  };
}
