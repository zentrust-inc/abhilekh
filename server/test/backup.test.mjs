import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBackup, restoreBackup, backupName, googleDriveUploader } from '../backup.mjs';
import { generateKeyPairSync, createVerify } from 'node:crypto';
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

test('with Google settings the copy also goes to Google Drive (shared drive); a failed upload keeps the local copy', async () => {
  const f = fresh(); writeFileSync(f.store, JSON.stringify({ shares: [] }));
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const credentials = { client_email: 'backup@abhilekh-test.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), token_uri: 'https://oauth2.googleapis.com/token' };
  const calls = [];
  const fake = async (url, o) => {
    calls.push({ url, o });
    if (url.startsWith('https://oauth2.googleapis.com/token')) return { status: 200, json: async () => ({ access_token: 'tok', expires_in: 3600 }) };
    return { status: 200, json: async () => ({ id: 'x' }) };
  };
  const t = Date.parse('2026-11-25T06:00:00Z');
  const uploader = googleDriveUploader({ credentials, folderId: 'FOLDER123', fetchImpl: fake, now: () => t });
  const b = createBackup({ storePath: f.store, dir: f.dir, uploader, now: () => t, logger: quiet });
  assert.equal((await b.run()).remote, 'uploaded');
  // the token request carries a JWT signed by the service account's key, for the Drive scope
  const jwt = new URLSearchParams(calls[0].o.body).get('assertion').split('.');
  assert.ok(createVerify('RSA-SHA256').update(jwt[0] + '.' + jwt[1]).verify(publicKey, Buffer.from(jwt[2], 'base64url')));
  const claim = JSON.parse(Buffer.from(jwt[1], 'base64url'));
  assert.equal(claim.iss, credentials.client_email);
  assert.equal(claim.scope, 'https://www.googleapis.com/auth/drive');
  // the upload goes into the folder, works in shared drives, and is named by date
  assert.match(calls[1].url, /upload\/drive\/v3\/files\?uploadType=multipart&supportsAllDrives=true/);
  assert.equal(calls[1].o.headers.authorization, 'Bearer tok');
  assert.match(String(calls[1].o.body), /"name":"store-2026-11-25\.json","parents":\["FOLDER123"\]/);
  assert.match(String(calls[1].o.body), /\{"shares":\[\]\}/);
  await b.run(); assert.equal(calls.filter(c => c.url.includes('token')).length, 1); // token reused within the hour
  const bad = createBackup({ storePath: f.store, dir: f.dir, uploader: googleDriveUploader({ credentials, folderId: 'F', fetchImpl: async () => ({ status: 403 }) }), now: () => t + DAY, logger: quiet });
  assert.equal((await bad.run()).remote, 'failed');
  assert.ok(existsSync(join(f.dir, backupName(t + DAY))));
  assert.throws(() => googleDriveUploader({ credentials: {}, folderId: 'F' }));
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
  assert.equal(app2.store().records.u1.people[0].name, 'Aama'); // pre-M1 records become the first person
  assert.throws(() => { writeFileSync(join(f.dir, 'bad.json'), 'nope'); restoreBackup({ backupPath: join(f.dir, 'bad.json'), storePath: f.store }); });
  assert.equal(JSON.parse(readFileSync(f.store, 'utf8')).shares[0].id, 'abc'); // a bad backup changes nothing
});
