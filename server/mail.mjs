// Email senders for sign-in codes. The message carries no health content.
//
// acs: Azure Communication Services Email, REST API 2023-03-31, no packages. The connection string
//      ("endpoint=https://NAME.communication.azure.com/;accesskey=BASE64") is read from ACS_EMAIL_CONNECTION_STRING,
//      set in Azure app settings only, never in the repository. The sender address must belong to a verified domain
//      of that resource (default DoNotReply@abhilekh.org, setting MAIL_FROM). ACS answers 202 once it has accepted the
//      message; delivery to the inbox happens afterwards and is not known here.
// memory: keeps messages in memory and sends nothing (tests, and TEST_MODE demos).
// none: no email service configured. Email sign-in answers "not switched on" instead of pretending to send.
import { createHash, createHmac } from 'node:crypto';

const API_VERSION = '2023-03-31';

export function parseConnectionString(cs) {
  const parts = Object.fromEntries(String(cs || '').split(';').map(s => s.trim()).filter(Boolean).map(s => { const i = s.indexOf('='); return [s.slice(0, i).toLowerCase(), s.slice(i + 1)]; }));
  if (!parts.endpoint || !parts.accesskey) throw new Error('ACS_EMAIL_CONNECTION_STRING must look like endpoint=https://NAME.communication.azure.com/;accesskey=...');
  const endpoint = new URL(parts.endpoint);
  if (endpoint.protocol !== 'https:' || !endpoint.hostname.endsWith('.communication.azure.com')) throw new Error('ACS endpoint must be https://NAME.communication.azure.com/');
  return { host: endpoint.host, key: parts.accesskey };
}

// HMAC-SHA256 request signing, as ACS documents it: sign "METHOD\npathAndQuery\ndate;host;contentHash".
export function signAcs({ method, pathAndQuery, host, body, key, date }) {
  const contentHash = createHash('sha256').update(body).digest('base64');
  const toSign = `${method}\n${pathAndQuery}\n${date};${host};${contentHash}`;
  const signature = createHmac('sha256', Buffer.from(key, 'base64')).update(toSign).digest('base64');
  return {
    'x-ms-date': date,
    'x-ms-content-sha256': contentHash,
    authorization: `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signature}`,
  };
}

export function acsMailSender({ connectionString, from = 'DoNotReply@abhilekh.org', fetchImpl = fetch, now = () => Date.now() }) {
  const { host, key } = parseConnectionString(connectionString);
  return {
    name: 'acs',
    async send(to, subject, text) {
      const pathAndQuery = `/emails:send?api-version=${API_VERSION}`;
      const body = JSON.stringify({
        senderAddress: from,
        content: { subject, plainText: text },
        recipients: { to: [{ address: to }] },
        userEngagementTrackingDisabled: true,
      });
      const headers = { 'content-type': 'application/json', ...signAcs({ method: 'POST', pathAndQuery, host, body, key, date: new Date(now()).toUTCString() }) };
      let r;
      try {
        r = await fetchImpl('https://' + host + pathAndQuery, { method: 'POST', headers, body, redirect: 'error', signal: AbortSignal.timeout(15000) });
      } catch (e) {
        return { ok: false, reason: 'network: ' + e.name };
      }
      if (r.status !== 202) {
        const j = await r.json().catch(() => null);
        return { ok: false, reason: 'acs: HTTP ' + r.status + ((j && j.error && j.error.message) ? ' ' + j.error.message : '') };
      }
      return { ok: true };
    },
  };
}

export function noMail() {
  return { name: 'none', async send() { return { ok: false, reason: 'no email service configured' }; } };
}

export function memoryMail() {
  const sent = [];
  return { name: 'memory', sent, async send(to, subject, text) { sent.push({ to, subject, text }); return { ok: true }; } };
}
