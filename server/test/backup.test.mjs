import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBackup, restoreBackup, backupName, googleDriveUploader, moveToDrive, LIVE_NAME } from '../backup.mjs';
import { createHash } from 'node:crypto';
import { generateKeyPairSync, createVerify } from 'node:crypto';
import { createApp } from '../server.mjs';

const DAY = 86400000;
const fresh = () => { const d = mkdtempSync(join(tmpdir(), 'abk-')); return { d, store: join(d, 'store.json'), dir: join(d, 'backups') }; };
const quiet = { log() {}, error() {} };

test('a daily copy is made under its date and time, and only the newest copies are kept', async () => {
  const f = fresh(); let t = Date.parse('2026-11-25T06:00:00Z');
  writeFileSync(f.store, JSON.stringify({ shares: [], records: {} }));
  const b = createBackup({ storePath: f.store, dir: f.dir, keepDays: 3, now: () => t, logger: quiet });
  for (let i = 0; i < 5; i++) { assert.equal((await b.run()).ok, true); t += DAY; }
  assert.deepEqual(b.list(), ['store-2026-11-27-0600.json', 'store-2026-11-28-0600.json', 'store-2026-11-29-0600.json']);
  assert.equal(backupName(Date.parse('2026-11-26T09:24:30Z')), 'store-2026-11-26-0924.json'); // two copies on one day never share a name
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
  assert.match(String(calls[1].o.body), /"name":"store-2026-11-25-0600\.json","parents":\["FOLDER123"\]/);
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

// A fake Drive: files by id, with md5 and size computed from the bytes it received.
function fakeDrive() {
  const files = {}; let n = 0; const calls = [];
  const md5 = b => createHash('md5').update(b).digest('hex');
  const body = async o => Buffer.isBuffer(o.body) ? o.body : Buffer.from(o.body);
  const fetchImpl = async (url, o = {}) => {
    calls.push({ url, method: o.method || 'GET' });
    if (url.startsWith('https://oauth2.googleapis.com/token')) return { status: 200, json: async () => ({ access_token: 'tok', expires_in: 3600 }) };
    const u = new URL(url);
    if (o.method === 'POST' && u.pathname === '/upload/drive/v3/files') {
      const raw = await body(o), text = raw.toString('latin1');
      const meta = JSON.parse(text.slice(text.indexOf('{'), text.indexOf('}\r\n') + 1));
      const start = raw.indexOf('\r\n\r\n', raw.indexOf('\r\n\r\n') + 4) + 4, end = raw.lastIndexOf(Buffer.from('\r\n--'));
      const bytes = raw.subarray(start, end), id = 'f' + (++n);
      files[id] = { name: meta.name, parents: meta.parents, bytes, folder: meta.mimeType === 'application/vnd.google-apps.folder' };
      return { status: 200, json: async () => ({ id, md5Checksum: md5(bytes), size: String(bytes.length) }) };
    }
    if (o.method === 'PATCH') {
      const id = decodeURIComponent(u.pathname.split('/').pop()), bytes = await body(o);
      files[id].bytes = bytes;
      return { status: 200, json: async () => ({ id, md5Checksum: md5(bytes), size: String(bytes.length) }) };
    }
    if (o.method === 'POST' && u.pathname === '/drive/v3/files') { // folder
      const meta = JSON.parse(o.body), id = 'd' + (++n); files[id] = { ...meta, folder: true };
      return { status: 200, json: async () => ({ id }) };
    }
    if (u.pathname === '/drive/v3/files') { // list
      const q = u.searchParams.get('q');
      const parent = q.match(/'([^']+)' in parents/)[1];
      const name = (q.match(/name (?:=|contains) '([^']+)'/) || [])[1];
      const wantFolder = q.includes("mimeType = 'application/vnd.google-apps.folder'");
      const list = Object.entries(files).filter(([, f]) => f.parents?.[0] === parent && (!name || f.name.includes(name)) && (!wantFolder || f.folder)).map(([id, f]) => ({ id, name: f.name }));
      return { status: 200, json: async () => ({ files: list }) };
    }
    return { status: 404 };
  };
  return { files, calls, fetchImpl };
}
const KEY = (() => { const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  return { client_email: 'b@x.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) }; })();
const sleep = ms => new Promise(r => setTimeout(r, ms));

test('live copy: after changes, one write to Drive per window; the same file is replaced in place', async () => {
  const f = fresh(); writeFileSync(f.store, JSON.stringify({ shares: [], n: 1 }));
  const D = fakeDrive();
  const uploader = googleDriveUploader({ credentials: KEY, folderId: 'ROOT', fetchImpl: D.fetchImpl });
  const b = createBackup({ storePath: f.store, dir: f.dir, uploader, syncMs: 40, logger: quiet });
  b.changed(); b.changed(); b.changed();                      // three saves close together
  assert.equal(b.pending(), true);
  await sleep(20);
  let live = Object.entries(D.files).filter(([, x]) => x.name === LIVE_NAME);
  assert.equal(live.length, 1);                               // made once
  assert.equal(JSON.parse(live[0][1].bytes).n, 1);
  writeFileSync(f.store, JSON.stringify({ shares: [], n: 2 }));
  b.changed(); await sleep(10);
  assert.equal(JSON.parse(live[0][1].bytes).n, 1);            // not yet: at most once per window
  await sleep(60);
  live = Object.entries(D.files).filter(([, x]) => x.name === LIVE_NAME);
  assert.equal(live.length, 1);                               // still one file, replaced in place
  assert.equal(JSON.parse(live[0][1].bytes).n, 2);
  assert.equal(D.calls.filter(c => c.method === 'PATCH').length, 1);
});

test('live copy: a broken store is never sent, and a failed write is tried again', async () => {
  const f = fresh(); writeFileSync(f.store, '{"shares": [');
  const D = fakeDrive();
  const b = createBackup({ storePath: f.store, dir: f.dir, uploader: googleDriveUploader({ credentials: KEY, folderId: 'ROOT', fetchImpl: D.fetchImpl }), syncMs: 20, logger: quiet });
  assert.equal(await b.sync(), 'failed');
  assert.equal(Object.values(D.files).filter(x => x.name === LIVE_NAME).length, 0);
  writeFileSync(f.store, JSON.stringify({ shares: [] }));
  await sleep(50);                                            // retried by itself
  assert.equal(Object.values(D.files).filter(x => x.name === LIVE_NAME).length, 1);
});

test('test papers move to the shared drive; the local copy is deleted only when Drive confirms MD5 and size', async () => {
  const f = fresh(); const dir = join(f.d, 'test-papers');
  const { mkdirSync } = await import('node:fs'); mkdirSync(dir);
  writeFileSync(join(dir, 'a.json'), JSON.stringify({ shares: [], sample: 'SAMPLE' }));
  writeFileSync(join(dir, 'b.json'), 'second SAMPLE file');
  const D = fakeDrive();
  const uploader = googleDriveUploader({ credentials: KEY, folderId: 'ROOT', fetchImpl: D.fetchImpl });
  assert.deepEqual(await moveToDrive({ dir, uploader, folderName: 'test-papers', logger: quiet }), { moved: 2, kept: 0 });
  assert.equal(existsSync(join(dir, 'a.json')), false);
  const folder = Object.entries(D.files).find(([, x]) => x.name === 'test-papers' && x.folder)[0];
  assert.deepEqual(Object.values(D.files).filter(x => x.parents?.[0] === folder).map(x => x.name).sort(), ['a.json', 'b.json']);
  // Drive reports different bytes: the file stays here
  writeFileSync(join(dir, 'c.json'), 'third');
  const liar = Object.assign(async () => {}, { archive: async () => ({ md5Checksum: 'x', size: '5' }) });
  assert.deepEqual(await moveToDrive({ dir, uploader: liar, folderName: 'test-papers', logger: quiet }), { moved: 0, kept: 1 });
  assert.equal(existsSync(join(dir, 'c.json')), true);
});

test('every save of the app tells the backup the store changed', async () => {
  const f = fresh(); let n = 0;
  const { memorySender } = await import('../sms.mjs');
  const http = (await import('node:http')).default;
  const app = createApp({ storePath: f.store, sms: memorySender(), secureCookies: false, onSave: () => n++ });
  const srv = http.createServer(app.handler); await new Promise(r => srv.listen(0, '127.0.0.1', r));
  try {
    const r = await fetch('http://127.0.0.1:' + srv.address().port + '/api/auth/code', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: '9841000077' }) });
    assert.equal(r.status, 200);
    assert.ok(n >= 1, 'saving the sign-in code must mark the store changed');
  } finally { srv.closeAllConnections(); srv.close(); }
});
