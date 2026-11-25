// Build plan M1: family (one account, several people) and photos kept exactly as taken.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { createApp } from '../server.mjs';
import { memorySender } from '../sms.mjs';
import { driveOriginals } from '../originals.mjs';

const PIN = '482915';
const sha = b => createHash('sha256').update(b).digest('hex');
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), randomBytes(4000), Buffer.from([0xff, 0xd9])]); // stands in for a photo

async function start(opts = {}) {
  const sms = memorySender();
  const dir = mkdtempSync(join(tmpdir(), 'abk-m1-'));
  const app = createApp({ sms, secureCookies: false, storePath: join(dir, 'store.json'), ...opts });
  const srv = http.createServer(app.handler);
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const phone = () => {
    const jar = {};
    const call = async (p, method = 'GET', body, headers = {}) => {
      const h = { ...headers };
      if (body !== undefined && !h['content-type']) h['content-type'] = 'application/json';
      const ck = Object.entries(jar).map(([k, v]) => k + '=' + v).join('; ');
      if (ck) h.cookie = ck;
      const r = await fetch(base + p, { method, headers: h, body: body === undefined ? undefined : (Buffer.isBuffer(body) ? body : JSON.stringify(body)) });
      for (const c of r.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
      const buf = Buffer.from(await r.arrayBuffer());
      let json = null; try { json = JSON.parse(buf.toString()); } catch {}
      return { status: r.status, json, buf, headers: r.headers };
    };
    return { call };
  };
  const signUp = async (num) => {
    const ph = phone();
    await ph.call('/api/auth/code', 'POST', { phone: num });
    const code = sms.sent.filter(m => m.to === num).at(-1).text.match(/\d{6}/)[0];
    const v = await ph.call('/api/auth/verify', 'POST', { phone: num, code });
    assert.equal((await ph.call('/api/auth/pin', 'POST', { ticket: v.json.ticket, pin: PIN })).status, 200);
    return ph;
  };
  const photo = (ph, buf = JPEG, type = 'image/jpeg', hdr = true) => ph.call('/api/papers', 'POST', buf, { 'content-type': type, ...(hdr ? { 'x-abhilekh-upload': '1' } : {}) });
  const anon = async p => { const r = await fetch(base + p); return { status: r.status, json: await r.json().catch(() => null) }; };
  return { app, dir, signUp, photo, anon, close: () => { srv.closeAllConnections(); srv.close(); } };
}

test('records made before M1 become the account\'s first person, with name and papers kept', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'abk-mig-'));
  writeFileSync(join(dir, 'store.json'), JSON.stringify({ shares: [], records: { a1: { label: 'Aama', docs: [{ id: 'L21' }] } } }));
  const app = createApp({ storePath: join(dir, 'store.json') });
  const r = app.store().records.a1;
  assert.equal(r.people.length, 1);
  assert.equal(r.people[0].name, 'Aama');
  assert.deepEqual(r.people[0].docs, [{ id: 'L21' }]);
  assert.deepEqual(r.people[0].papers, []);
});

test('family: a new person starts empty; opening another person needs the PIN; papers and shares stay with their person', async () => {
  const s = await start();
  const me = await s.signUp('9841000001');
  const first = (await me.call('/api/record/sample', 'POST', {})).json;
  assert.ok(first.docs.length > 0);
  const myId = first.person;
  assert.equal((await me.call('/api/people', 'POST', { name: '   ' })).status, 400);
  const aama = await me.call('/api/people', 'POST', { name: '  Aama  ' });
  assert.equal(aama.status, 201);
  assert.equal(aama.json.label, 'Aama');            // the new person is in view
  assert.deepEqual(aama.json.docs, []);             // and starts empty
  assert.equal(aama.json.people.length, 2);
  // Aama's share holds Aama's papers only
  await me.call('/api/record/sample', 'POST', {});
  const sh = await me.call('/api/shares', 'POST', { docs: ['L21'], minutes: 15, pin: PIN });
  assert.equal(sh.status, 201);
  assert.equal((await me.call('/api/shares')).json.shares.length, 1);
  // back to me: no PIN, wrong PIN, then the PIN
  assert.equal((await me.call('/api/people/switch', 'POST', { person: myId })).status, 400);
  assert.equal((await me.call('/api/people/switch', 'POST', { person: myId, pin: '000001' })).status, 401);
  assert.equal((await me.call('/api/people/switch', 'POST', { person: 'pnope' , pin: PIN })).status, 404);
  const back = await me.call('/api/people/switch', 'POST', { person: myId, pin: PIN });
  assert.equal(back.status, 200);
  assert.equal(back.json.person, myId);
  assert.equal((await me.call('/api/shares')).json.shares.length, 0); // Aama's share is listed under Aama, not me
  // the doctor still sees Aama's paper
  const doc = await s.anon('/api/s/' + sh.json.id);
  assert.equal(doc.status, 200);
  assert.deepEqual(doc.json.docs.map(d => d.id), ['L21']);
  // the person in view is per session: a new sign-in on another phone starts with the first person
  const other = await s.signUp('9841000002');
  assert.equal((await other.call('/api/record')).json.people.length, 1); // another account sees none of mine
  // at most 6 people
  for (let i = 0; i < 4; i++) assert.equal((await me.call('/api/people', 'POST', { name: 'P' + i })).status, 201);
  assert.equal((await me.call('/api/people', 'POST', { name: 'Seventh' })).status, 400);
  s.close();
});

test('photos are off unless switched on (or test mode)', async () => {
  const s = await start();
  const me = await s.signUp('9841000001');
  assert.equal((await s.photo(me)).status, 403);
  assert.equal((await me.call('/api/record')).json.photos, false);
  s.close();
});

test('a photo is kept exactly as sent, named by its SHA-256, once; only its owner can see it; it cannot be shared', async () => {
  const s = await start({ photos: true });
  const me = await s.signUp('9841000001');
  assert.equal((await s.photo(me, JPEG, 'image/jpeg', false)).status, 400);           // no upload header: refused (CSRF)
  assert.equal((await s.photo(me, JPEG, 'application/pdf')).status, 415);
  assert.equal((await s.photo(me, Buffer.alloc(10))).status, 400);
  assert.equal((await s.photo(me, Buffer.alloc(15 * 1024 * 1024 + 1))).status, 413);
  const up = await s.photo(me);
  assert.equal(up.status, 201);
  const p = up.json.papers[0];
  assert.equal(p.sha256, sha(JPEG));
  assert.equal(p.bytes, JPEG.length);
  assert.equal(p.status, 'waiting');
  // on disk: the same bytes, named by the hash, nothing else in the name
  const files = readdirSync(join(s.dir, 'originals'));
  assert.deepEqual(files, [sha(JPEG) + '.jpg']);
  assert.ok(readFileSync(join(s.dir, 'originals', files[0])).equals(JPEG));
  // the same photo again is not added twice
  const again = await s.photo(me);
  assert.equal(again.json.already, true);
  assert.equal(again.json.papers.length, 1);
  // the owner gets the original back unchanged, never cached
  const g = await me.call('/api/papers/' + p.id + '/original');
  assert.equal(g.status, 200);
  assert.ok(g.buf.equals(JPEG));
  assert.equal(g.headers.get('content-type'), 'image/jpeg');
  assert.match(g.headers.get('cache-control'), /no-store/);
  // nobody else: signed out, another account, or another person on the same account
  assert.equal((await s.anon('/api/papers/' + p.id + '/original')).status, 401);
  const other = await s.signUp('9841000002');
  assert.equal((await other.call('/api/papers/' + p.id + '/original')).status, 404);
  await me.call('/api/people', 'POST', { name: 'Aama' });
  assert.equal((await me.call('/api/papers/' + p.id + '/original')).status, 404);
  // a photo that is not read and confirmed cannot be shared
  assert.equal((await me.call('/api/shares', 'POST', { docs: [p.id], minutes: 15, pin: PIN })).status, 400);
  s.close();
});

test('if the original cannot be kept, nothing is added; if a kept original was changed, it is not served', async () => {
  const broken = { name: 'x', put: async () => { throw new Error('down'); }, get: async () => JPEG };
  const s = await start({ photos: true, originals: broken });
  const me = await s.signUp('9841000001');
  assert.equal((await s.photo(me)).status, 503);
  assert.deepEqual((await me.call('/api/record')).json.papers, []);
  s.close();
  const swapped = { name: 'x', put: async () => 'x:1', get: async () => Buffer.concat([JPEG, Buffer.from('!')]) };
  const t = await start({ photos: true, originals: swapped });
  const you = await t.signUp('9841000001');
  const p = (await t.photo(you)).json.papers[0];
  assert.equal((await you.call('/api/papers/' + p.id + '/original')).status, 500);
  t.close();
});

test('Google Drive originals: one "originals" folder made once, the bytes uploaded unchanged, and read back', async () => {
  const calls = [];
  let folders = 0;
  const drive = {
    folder: async (name, parent) => { folders++; calls.push(['folder', name, parent]); return 'F1'; },
    upload: async o => { calls.push(['upload', o]); return 'FILE' + calls.length; },
    download: async id => { calls.push(['download', id]); return JPEG; },
  };
  const o = driveOriginals(drive, 'DRIVE0');
  const ref = await o.put(sha(JPEG), 'image/jpeg', JPEG);
  await o.put('ab'.repeat(32), 'image/png', JPEG);
  assert.equal(folders, 1);
  assert.deepEqual(calls[0], ['folder', 'originals', 'DRIVE0']);
  assert.equal(calls[1][1].name, sha(JPEG) + '.jpg');
  assert.equal(calls[1][1].parent, 'F1');
  assert.ok(calls[1][1].body.equals(JPEG));
  assert.match(ref, /^drive:FILE/);
  assert.ok((await o.get(ref)).equals(JPEG));
  assert.deepEqual(calls.at(-1), ['download', ref.slice(6)]);
});

test('Drive client: finds the folder or makes it once; uploads raw bytes untouched; downloads by id; all with shared-drive flags', async () => {
  const { generateKeyPairSync } = await import('node:crypto');
  const { createDrive } = await import('../drive.mjs');
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const credentials = { client_email: 'b@x.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  const calls = [];
  let listed = [];
  const fake = async (url, o = {}) => {
    calls.push({ url, o });
    if (url.includes('oauth2')) return { status: 200, json: async () => ({ access_token: 't', expires_in: 3600 }) };
    if (url.includes('?q=')) return { status: 200, json: async () => ({ files: listed }) };
    if (url.includes('/upload/')) return { status: 200, json: async () => ({ id: 'UP1' }) };
    if (url.includes('alt=media')) return { status: 200, arrayBuffer: async () => JPEG.buffer.slice(JPEG.byteOffset, JPEG.byteOffset + JPEG.length) };
    return { status: 200, json: async () => ({ id: 'NEWF' }) };
  };
  const d = createDrive({ credentials, fetchImpl: fake });
  assert.equal(await d.folder('originals', 'D0'), 'NEWF');               // not there: made
  listed = [{ id: 'OLDF' }];
  assert.equal(await d.folder('originals', 'D0'), 'OLDF');               // there: found
  const id = await d.upload({ name: 'h.jpg', mime: 'image/jpeg', body: JPEG, parent: 'OLDF' });
  assert.equal(id, 'UP1');
  const up = calls.find(c => c.url.includes('/upload/'));
  assert.match(up.url, /supportsAllDrives=true/);
  assert.ok(up.o.body.includes(JPEG));                                     // the photo's bytes, unchanged, inside the multipart body
  assert.ok((await d.download('UP1')).equals(JPEG));
  assert.ok(calls.filter(c => !c.url.includes('oauth2')).every(c => /supportsAllDrives=true/.test(c.url)));
});
