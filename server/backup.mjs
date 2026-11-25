// Daily backup of store.json (app build plan v1, M0). Zero dependencies.
//
// 1. Every day (and once at start-up) the current store is copied to DATA_DIR/backups/store-YYYY-MM-DD.json.
//    The last KEEP_DAYS copies are kept; older ones are removed.
// 2. If BACKUP_BLOB_SAS_URL is set (an Azure Blob Storage *container* URL with a SAS token that allows
//    create and write, set only as an Azure app setting, never in the repository), the same copy is also
//    uploaded there as store-YYYY-MM-DD.json. That is the "second place": a copy that survives if the app's
//    own disk is lost. Without the setting, only the local copies are made, and the start-up log says so.
//
// Restore: stop the app, copy a backup over DATA_DIR/store.json, start the app. `restoreBackup` does the copy
// and checks that the file is a readable store first (see test/backup.test.mjs).
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, readdirSync, unlinkSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';

const DAY = 24 * 60 * 60 * 1000;
const NAME = /^store-(\d{4}-\d{2}-\d{2})\.json$/;

export function backupName(t) { return 'store-' + new Date(t).toISOString().slice(0, 10) + '.json'; }

// A store must parse and have the shape the server expects; a broken file is never copied or restored.
export function checkStore(text) {
  const s = JSON.parse(text);
  if (!s || typeof s !== 'object' || !Array.isArray(s.shares)) throw new Error('Not an Abhilekh store: no shares list.');
  return s;
}

export function createBackup({ storePath, dir, keepDays = 30, sasUrl = '', fetchImpl = globalThis.fetch, now = () => Date.now(), logger = console } = {}) {
  mkdirSync(dir, { recursive: true });

  async function upload(name, body) {
    if (!sasUrl) return 'skipped';
    const u = new URL(sasUrl);
    u.pathname = u.pathname.replace(/\/$/, '') + '/' + name;
    const r = await fetchImpl(u.toString(), { method: 'PUT', headers: { 'x-ms-blob-type': 'BlockBlob', 'content-type': 'application/json' }, body });
    if (r.status !== 201) throw new Error('Blob upload answered ' + r.status);
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
