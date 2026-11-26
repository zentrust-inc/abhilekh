// Copies of store.json in Google Drive (app build plan v1, M0; changed 26 Nov 2026). Zero dependencies.
//
// Decided 26 Nov 2026 (Dr. Shrestha): the app works on its own disk on Azure, because every tap reads and writes the
// store and Drive is not a disk; Google Drive holds every copy. So:
//   1. Live copy: after any change, at most once a minute, the store is written to Drive as store-live.json (the same
//      file, replaced in place). Losing the Azure disk loses at most the last minute.
//   2. Snapshots: once a day (and at start-up) a dated copy store-YYYY-MM-DD-HHMM.json (UTC) goes to DATA_DIR/backups
//      (newest KEEP copies kept there) and, as a NEW file, to Drive, where nothing is ever deleted (100 TB).
//   3. Archives: files left in DATA_DIR/test-papers are moved to the shared drive folder "test-papers"; the Azure copy
//      is deleted only after Drive reports the same MD5 and size.
// Settings (Azure app settings only, never the repository): GOOGLE_BACKUP_SA_JSON (a Google service account key) and
// GOOGLE_BACKUP_FOLDER_ID (the shared drive, or a folder in it, where that service account is a Content manager).
// Without them only the local snapshots are made, and the start-up log says so.
//
// Restore: stop the app, copy a backup (a snapshot, or store-live.json from Drive) over DATA_DIR/store.json, start the
// app. `restoreBackup` does the copy and checks that the file is a readable store first (see test/backup.test.mjs).
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, readdirSync, unlinkSync, copyFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { createDrive } from './drive.mjs';

const DAY = 24 * 60 * 60 * 1000;
const NAME = /^store-(\d{4}-\d{2}-\d{2})(-\d{4})?\.json$/; // older copies have no time
export const LIVE_NAME = 'store-live.json';

// store-2026-11-26-0924.json: date and time (UTC), so two copies on one day never share a name.
export function backupName(t) { const s = new Date(t).toISOString(); return 'store-' + s.slice(0, 10) + '-' + s.slice(11, 13) + s.slice(14, 16) + '.json'; }

// A store must parse and have the shape the server expects; a broken file is never copied or restored.
export function checkStore(text) {
  const s = JSON.parse(text);
  if (!s || typeof s !== 'object' || !Array.isArray(s.shares)) throw new Error('Not an Abhilekh store: no shares list.');
  return s;
}

export function createBackup({ storePath, dir, keepDays = 30, uploader = null, syncMs = 60 * 1000, now = () => Date.now(), logger = console } = {}) {
  mkdirSync(dir, { recursive: true });

  async function upload(name, body) {
    if (!uploader) return 'skipped';
    await uploader(name, body);
    return 'uploaded';
  }

  // A dated snapshot: local copy (rotated) and a new file in Drive (never deleted there).
  async function run() {
    if (!existsSync(storePath)) return { ok: true, note: 'no store yet' };
    const text = readFileSync(storePath, 'utf8');
    checkStore(text); // never back up a half-written or broken file
    const name = backupName(now());
    const tmp = join(dir, name + '.tmp');
    writeFileSync(tmp, text);
    renameSync(tmp, join(dir, name));
    const all = readdirSync(dir).filter(f => NAME.test(f)).sort();
    for (const f of all.slice(0, Math.max(0, all.length - keepDays))) unlinkSync(join(dir, f));
    let remote = 'skipped';
    try { remote = await upload(name, text); } catch (e) { logger.error('Backup upload failed: ' + e.message); remote = 'failed'; }
    return { ok: true, name, remote, kept: Math.min(all.length, keepDays) };
  }

  // ---- the live copy in Drive: after a change, at most once per syncMs ----
  let timer = null, last = 0, running = false, again = false;
  async function sync() {
    if (!uploader?.live || !existsSync(storePath)) return 'skipped';
    if (running) { again = true; return 'queued'; }
    running = true; last = now();
    try {
      const text = readFileSync(storePath, 'utf8');
      checkStore(text);
      await uploader.live(text);
      return 'synced';
    } catch (e) { logger.error('Live copy to Drive failed: ' + e.message); schedule(); return 'failed'; }
    finally { running = false; if (again) { again = false; schedule(); } }
  }
  function schedule() {
    if (!uploader?.live || timer) return;
    const wait = Math.max(0, last + syncMs - now());
    timer = setTimeout(() => { timer = null; sync(); }, wait);
    timer.unref?.();
  }
  const changed = () => schedule();

  function start() {
    const go = () => run().then(r => logger.log('Backup: ' + JSON.stringify(r))).catch(e => logger.error('Backup failed: ' + e.message));
    go();
    changed(); // the live copy is brought up to date once at start-up too
    const t = setInterval(go, DAY);
    t.unref?.();
    return () => { clearInterval(t); if (timer) clearTimeout(timer); };
  }

  return { run, start, sync, changed, pending: () => !!timer, list: () => readdirSync(dir).filter(f => NAME.test(f)).sort() };
}

// Move every file in dir to the Drive folder `folderName`; delete the local copy only when Drive reports the same MD5
// and size. A file that does not match stays where it is, and the log says so.
export async function moveToDrive({ dir, uploader, folderName, logger = console }) {
  if (!uploader?.archive || !existsSync(dir)) return { moved: 0, kept: 0 };
  let moved = 0, kept = 0;
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (!statSync(p).isFile() || f.endsWith('.tmp')) continue;
    const buf = readFileSync(p);
    const md5 = createHash('md5').update(buf).digest('hex');
    try {
      const r = await uploader.archive(folderName, f, buf);
      if (r?.md5Checksum === md5 && Number(r.size) === buf.length) { unlinkSync(p); moved++; }
      else { kept++; logger.error('Moved to Drive but not confirmed (checksum or size differs): ' + f + ' kept on this disk'); }
    } catch (e) { kept++; logger.error('Not moved to Drive: ' + f + ': ' + e.message); }
  }
  return { moved, kept };
}

// Copy a backup over the live store, only if it is a readable store. The app must be stopped first.
export function restoreBackup({ backupPath, storePath }) {
  checkStore(readFileSync(backupPath, 'utf8'));
  if (existsSync(storePath)) copyFileSync(storePath, storePath + '.before-restore');
  copyFileSync(backupPath, storePath);
}

// Google Drive target for the copies, all in the shared drive (folder GOOGLE_BACKUP_FOLDER_ID):
//   uploader(name, body)               a new snapshot file
//   uploader.live(body)                store-live.json, replaced in place (made once)
//   uploader.archive(folder, name, buf) a new file in a subfolder; returns Drive's { md5Checksum, size }
export function googleDriveUploader({ credentials, folderId, fetchImpl = globalThis.fetch, now = () => Date.now() }) {
  if (!folderId) throw new Error('GOOGLE_BACKUP_FOLDER_ID is missing.');
  const drive = createDrive({ credentials, fetchImpl, now });
  const up = async (name, body) => { await drive.upload({ name, mime: 'application/json', body, parent: folderId }); };
  let liveId = null;
  up.live = async body => {
    if (!liveId) { const f = await drive.latest(LIVE_NAME, folderId); liveId = f && f.name === LIVE_NAME ? f.id : null; }
    if (liveId) return drive.update(liveId, { mime: 'application/json', body });
    const r = await drive.uploadChecked({ name: LIVE_NAME, mime: 'application/json', body, parent: folderId });
    liveId = r.id; return r;
  };
  up.archive = async (folderName, name, buf) => {
    const parent = await drive.folder(folderName, folderId);
    return drive.uploadChecked({ name, mime: name.endsWith('.json') ? 'application/json' : 'application/octet-stream', body: buf, parent });
  };
  return up;
}
