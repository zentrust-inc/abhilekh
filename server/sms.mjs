// SMS senders for sign-in codes. The code text carries no health content.
//
// akash: Akash SMS (sms.aakashsms.com), v3 send API: POST form fields auth_token, to (10-digit Nepal mobile), text.
//        Reply JSON: { error: bool, message, data: { valid: [{ id, mobile, credit, network, status }], invalid: [...] } }
//        (docs: bitbucket.org/aakashsms/api, branch v4). One credit is one SMS; checked 21 Nov 2026. The token is read from AKASH_SMS_TOKEN, which is
//        set in Azure app settings only, never in the repository.
// memory: keeps messages in memory and sends nothing (tests, and TEST_MODE demos). Never used when AKASH_SMS_TOKEN is set.
const AKASH_URL = 'https://sms.aakashsms.com/sms/v3/send/';

export function akashSender({ token, fetchImpl = fetch, url = AKASH_URL }) {
  if (!token) throw new Error('AKASH_SMS_TOKEN is not set');
  return {
    name: 'akash',
    async send(to, text) {
      const body = new URLSearchParams({ auth_token: token, to, text }).toString();
      let r, j;
      try {
        r = await fetchImpl(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, redirect: 'error', signal: AbortSignal.timeout(15000) });
        j = await r.json().catch(() => null);
      } catch (e) {
        return { ok: false, reason: 'network: ' + e.name };
      }
      if (!r.ok || !j || j.error) return { ok: false, reason: 'akash: ' + ((j && j.message) || 'HTTP ' + r.status) };
      // Akash can answer error:false and still put the number under data.invalid (status "aborted"): not sent.
      const valid = j.data && Array.isArray(j.data.valid) ? j.data.valid : [];
      if (!valid.length) return { ok: false, reason: 'akash: number not accepted (' + ((j.data && j.data.invalid && j.data.invalid[0] && j.data.invalid[0].status) || 'no valid recipient') + ')' };
      return { ok: true, credit: valid.reduce((n, v) => n + (Number(v.credit) || 0), 0), network: valid[0].network };
    },
  };
}

export function memorySender() {
  const sent = [];
  return { name: 'memory', sent, async send(to, text) { sent.push({ to, text }); return { ok: true }; } };
}
