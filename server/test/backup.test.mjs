import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBackup, restoreBackup, backupName } from '../backup.mjs';
import { createApp } from '../server.mjs';

const DAY = 86400000;
const fresh = () => { const d = mkdtempSync(join(tmpdir(), 'abk-')); return { d, store: join(d, 'store.json'), dir: join(d, 'backups') }; };
const quiet = { log() {}, error() {} };

test('a daily copy is made under its date, and only the newest copies are kept', async () => {
  const f = fresh(); let t = Date.parse('2026-11-25T06:00:00Z');
  writeFileSync(f.store, JSON.stringify({ shares: [], records: {} }));
  const b = createBackup({ storePath: f.store, dir: f.dir, keepDays: 3, now: () => t, logger: quiet });
  for (let i = 0; i < 5; i++) { assert.equal((await b.run()).ok, true); t += DAY; }
  assert.deepEqual(b.list(), ['store-2026-11-27.json', 'store-2026-11-28.json', 'store-2026-11-29.json']);
});

test('a broken store is never backed up', async () => {
  const f = fresh(); writeFileSync(f.store, '{"shares": [');
  const b = createBackup({ storePath: f.store, dir: f.dir, logger: quiet });
  await assert.rejects(b.run());
  assert.deepEqual(b.list(), []);
});

test('with a SAS URL the copy also goes to Azure Blob as a block blob; a failed upload keeps the local copy', async () => {
  const f = fresh(); writeFileSync(f.store, JSON.stringify({ shares: [] }));
  const calls = [];
  const ok = async (url, o) => { calls.push({ url, o }); return { status: 201 }; };
  const t = Date.parse('2026-11-25T06:00:00Z');
  const b = createBackup({ storePath: f.store, dir: f.dir, sasUrl: 'https://acct.blob.core.windows.net/abhilekh-backups?sv=x&sig=y', fetchImpl: ok, now: () => t, logger: quiet });
  assert.equal((await b.run()).remote, 'uploaded');
  assert.equal(calls[0].url, 'https://acct.blob.core.windows.net/abhilekh-backups/store-2026-11-25.json?sv=x&sig=y');
  assert.equal(calls[0].o.method, 'PUT');
  assert.equal(calls[0].o.headers['x-ms-blob-type'], 'BlockBlob');
  const bad = createBackup({ storePath: f.store, dir: f.dir, sasUrl: 'https://acct.blob.core.windows.net/c?sig=y', fetchImpl: async () => ({ status: 403 }), now: () => t + DAY, logger: quiet });
  const r = await bad.run();
  assert.equal(r.remote, 'failed');
  assert.ok(existsSync(join(f.dir, backupName(t + DAY))));
});

test('restore test: a backup brings back every record and share, and the app starts from it', async () => {
  const f = fresh();
  const app1 = createApp({ storePath: f.store });
  app1.store().shares.push({ id: 'abc', ownerId: 'u1', docs: ['L21'], who: '', created: '2026-11-25T00:00:00.000Z', expires: '2026-11-25T00:15:00.000Z', minutes: 15, revokedAt: null, log: [] });
  app1.store().records.u1 = { label: 'Aama', docs: [{ id: 'L21' }] };
  writeFileSync(f.store, JSON.stringify(app1.store()));
  const b = createBackup({ storePath: f.store, dir: f.dir, logger: quiet });
  const { name } = await b.run();
  writeFileSync(f.store, JSON.stringify({ shares: [], records: {} })); // the live file is lost or emptied
  restoreBackup({ backupPath: join(f.dir, name), storePath: f.store });
  assert.ok(existsSync(f.store + '.before-restore')); // what was there before is kept, never thrown away
  const app2 = createApp({ storePath: f.store });
  assert.equal(app2.store().shares[0].id, 'abc');
  assert.equal(app2.store().records.u1.label, 'Aama');
  assert.throws(() => { writeFileSync(join(f.dir, 'bad.json'), 'nope'); restoreBackup({ backupPath: join(f.dir, 'bad.json'), storePath: f.store }); });
  assert.equal(JSON.parse(readFileSync(f.store, 'utf8')).shares[0].id, 'abc'); // a bad backup changes nothing
});
