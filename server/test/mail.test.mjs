import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { acsMailSender, parseConnectionString, signAcs, memoryMail, noMail } from '../mail.mjs';

const KEY = Buffer.from('test-access-key-not-real').toString('base64');
const CS = `endpoint=https://abhilekh-mail.communication.azure.com/;accesskey=${KEY}`;

test('connection string: endpoint and key are read; anything else is refused', () => {
  assert.deepEqual(parseConnectionString(CS), { host: 'abhilekh-mail.communication.azure.com', key: KEY });
  assert.throws(() => parseConnectionString(''), /must look like/);
  assert.throws(() => parseConnectionString('endpoint=https://abhilekh-mail.communication.azure.com/'), /must look like/);
  assert.throws(() => parseConnectionString(`endpoint=http://abhilekh-mail.communication.azure.com/;accesskey=${KEY}`), /https/);
  assert.throws(() => parseConnectionString(`endpoint=https://evil.example.com/;accesskey=${KEY}`), /communication\.azure\.com/);
});

test('request signing: HMAC-SHA256 over METHOD, path, date;host;content hash, with the base64-decoded key', () => {
  const body = '{"a":1}', date = 'Sun, 22 Nov 2026 08:00:00 GMT', host = 'x.communication.azure.com', pathAndQuery = '/emails:send?api-version=2023-03-31';
  const h = signAcs({ method: 'POST', pathAndQuery, host, body, key: KEY, date });
  const hash = createHash('sha256').update(body).digest('base64');
  const sig = createHmac('sha256', Buffer.from(KEY, 'base64')).update(`POST\n${pathAndQuery}\n${date};${host};${hash}`).digest('base64');
  assert.equal(h['x-ms-date'], date);
  assert.equal(h['x-ms-content-sha256'], hash);
  assert.equal(h.authorization, `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${sig}`);
});

test('ACS sender: posts one signed JSON message to the resource; 202 is ok; tracking is off', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return { status: 202, json: async () => ({ id: 'x', status: 'Running' }) }; };
  const m = acsMailSender({ connectionString: CS, fetchImpl, now: () => Date.parse('2026-11-22T08:00:00Z') });
  assert.equal(m.name, 'acs');
  const r = await m.send('asha@example.com', 'Your Abhilekh sign-in code', 'Abhilekh code: 123456');
  assert.deepEqual(r, { ok: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://abhilekh-mail.communication.azure.com/emails:send?api-version=2023-03-31');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers['content-type'], 'application/json');
  assert.match(calls[0].init.headers.authorization, /^HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=/);
  assert.equal(calls[0].init.headers['x-ms-date'], 'Sun, 22 Nov 2026 08:00:00 GMT');
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.senderAddress, 'DoNotReply@abhilekh.org');
  assert.deepEqual(body.recipients, { to: [{ address: 'asha@example.com' }] });
  assert.deepEqual(body.content, { subject: 'Your Abhilekh sign-in code', plainText: 'Abhilekh code: 123456' });
  assert.equal(body.userEngagementTrackingDisabled, true);
  assert.equal(calls[0].init.redirect, 'error');
  // the signature covers the body that was actually sent
  assert.equal(calls[0].init.headers['x-ms-content-sha256'], createHash('sha256').update(calls[0].init.body).digest('base64'));
});

test('ACS sender: a refusal or a network failure is { ok: false } with a reason, never a throw; the key is never in the reason', async () => {
  const refuse = acsMailSender({ connectionString: CS, fetchImpl: async () => ({ status: 401, json: async () => ({ error: { message: 'Denied' } }) }) });
  const r1 = await refuse.send('a@example.com', 's', 't');
  assert.equal(r1.ok, false); assert.match(r1.reason, /HTTP 401 Denied/); assert.ok(!r1.reason.includes(KEY));
  const down = acsMailSender({ connectionString: CS, fetchImpl: async () => { const e = new Error('x'); e.name = 'TimeoutError'; throw e; } });
  assert.deepEqual(await down.send('a@example.com', 's', 't'), { ok: false, reason: 'network: TimeoutError' });
  const custom = [];
  await acsMailSender({ connectionString: CS, from: 'hello@abhilekh.org', fetchImpl: async (u, i) => { custom.push(JSON.parse(i.body).senderAddress); return { status: 202 }; } }).send('a@example.com', 's', 't');
  assert.deepEqual(custom, ['hello@abhilekh.org']);
});

test('memory and none senders', async () => {
  const m = memoryMail();
  assert.deepEqual(await m.send('a@example.com', 's', 't'), { ok: true });
  assert.deepEqual(m.sent, [{ to: 'a@example.com', subject: 's', text: 't' }]);
  assert.equal((await noMail().send()).ok, false);
});
