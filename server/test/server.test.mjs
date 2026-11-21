import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server.mjs';

async function start(opts = {}) {
  let t = Date.parse('2026-11-21T10:00:00Z');
  const clock = { now: () => t, advance: min => { t += min * 60000; } };
  const app = createApp({ now: clock.now, ...opts });
  const srv = http.createServer(app.handler);
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  const call = async (p, method = 'GET', body) => {
    const r = await fetch(base + p, { method, headers: body ? { 'content-type': 'application/json' } : {}, body: body && JSON.stringify(body) });
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  return { call, clock, close: () => srv.close(), app };
}

test('live share shows the record and logs the open', async () => {
  const s = await start();
  const c = await s.call('/api/shares', 'POST', { docs: ['L21'], who: 'Dr. Namuna', minutes: 60 });
  assert.equal(c.status, 201);
  const r = await s.call('/api/s/' + c.json.id);
  assert.equal(r.status, 200);
  assert.deepEqual(r.json.docs.map(d => d.id), ['L21']); // only the chosen report
  const list = await s.call('/api/shares');
  assert.match(list.json.shares[0].log.at(-1).t, /Opened/);
  s.close();
});

test('after the time runs out the server refuses, shows nothing, and logs the attempt', async () => {
  const s = await start();
  const c = await s.call('/api/shares', 'POST', { docs: ['L21', 'L22'], minutes: 60 });
  s.clock.advance(59);
  assert.equal((await s.call('/api/s/' + c.json.id)).status, 200);
  s.clock.advance(2);
  const r = await s.call('/api/s/' + c.json.id);
  assert.equal(r.status, 410);
  assert.deepEqual(r.json, { state: 'expired' }); // no record in the refusal
  const sh = (await s.call('/api/shares')).json.shares[0];
  assert.equal(sh.state, 'expired');
  assert.match(sh.log.at(-1).t, /out of time\. Nothing was shown/);
  s.close();
});

test('stop sharing works at once, is logged, and later opens are refused and logged', async () => {
  const s = await start();
  const c = await s.call('/api/shares', 'POST', { docs: ['L22'], minutes: 1440 });
  const st = await s.call('/api/shares/' + c.json.id + '/stop', 'POST');
  assert.equal(st.json.state, 'revoked');
  const r = await s.call('/api/s/' + c.json.id);
  assert.equal(r.status, 410);
  assert.deepEqual(r.json, { state: 'revoked' });
  const log = (await s.call('/api/shares')).json.shares[0].log.map(e => e.t);
  assert.ok(log.some(t => /You stopped this share/.test(t)));
  assert.match(log.at(-1), /stopped\. Nothing was shown/);
  s.close();
});

test('stopping an already-expired share does not rewrite its history', async () => {
  const s = await start();
  const c = await s.call('/api/shares', 'POST', { docs: ['L21'], minutes: 60 });
  s.clock.advance(61);
  const st = await s.call('/api/shares/' + c.json.id + '/stop', 'POST');
  assert.equal(st.json.state, 'expired');
  assert.equal(st.json.revokedAt, null);
  s.close();
});

test('only 1 hour, 24 hours or 7 days; never forever; nothing without a report', async () => {
  const s = await start();
  for (const minutes of [0, -5, 1, 30, 100000, 'forever', null]) {
    assert.equal((await s.call('/api/shares', 'POST', { docs: ['L21'], minutes })).status, 400, 'minutes=' + minutes);
  }
  assert.equal((await s.call('/api/shares', 'POST', { docs: [], minutes: 60 })).status, 400);
  assert.equal((await s.call('/api/shares', 'POST', { docs: ['nope'], minutes: 60 })).status, 400);
  for (const minutes of [60, 1440, 10080]) assert.equal((await s.call('/api/shares', 'POST', { docs: ['L21'], minutes })).status, 201);
  s.close();
});

test('test mode allows a 1-minute share, normal mode does not', async () => {
  const s = await start({ testMode: true });
  assert.equal((await s.call('/api/shares', 'POST', { docs: ['L21'], minutes: 1 })).status, 201);
  s.close();
});

test('unknown links are 404 and logged nowhere; guessing is slowed down', async () => {
  const s = await start();
  assert.equal((await s.call('/api/s/aaaaaaaaaaaaaa')).status, 404);
  let last;
  for (let i = 0; i < 40; i++) last = (await s.call('/api/s/zzzzzzzzzzzz' + i)).status;
  assert.equal(last, 429);
  s.close();
});

test('shares survive a restart (file store)', async () => {
  const storePath = join(mkdtempSync(join(tmpdir(), 'abh-')), 'store.json');
  const a = await start({ storePath });
  const c = await a.call('/api/shares', 'POST', { docs: ['L21'], minutes: 60 });
  a.close();
  const b = await start({ storePath });
  assert.equal((await b.call('/api/s/' + c.json.id)).status, 200);
  b.close();
});

test('the doctor response carries only printed values (no advice fields)', async () => {
  const s = await start();
  const c = await s.call('/api/shares', 'POST', { docs: ['L22'], minutes: 60 });
  const r = await s.call('/api/s/' + c.json.id);
  const keys = new Set(r.json.docs.flatMap(d => d.results.flatMap(x => Object.keys(x))));
  assert.deepEqual([...keys].sort(), ['flag', 'img', 'range', 'test', 'unit', 'value']);
  s.close();
});
