# Share server (prototype, SAMPLE data only)

The share half of the promise, enforced by a server instead of a page: the patient picks reports and a time
(1 hour, 24 hours or 7 days, never forever), gets a QR code and link, sees every open (including refused ones in
the log) and can stop the share. The doctor's view is served only while the share is live and shows value, unit,
printed range and printed flag only. No advice.

Plans, not results: this is a plan under test, run only on invented SAMPLE · नमूना pages.

## Run

    cd server && npm test          # 42 tests, node:test, no packages to install
    PORT=8080 DATA_DIR=./data node server.mjs

`TEST_MODE=1` also allows a 1-minute share so expiry can be watched on a live URL, and, when no SMS token is set,
shows the sign-in code on screen instead of sending it. Never set it in a real deployment.
`INSECURE_COOKIES=1` drops the Secure cookie flag for plain-http local runs only.

## Sign-in (auth.mjs, sms.mjs, mail.mjs)

Plan agreed 21 Nov 2026 (status log; PRD rev. 3.3, Security and consent):

- Sign up with a Nepal mobile number (98, 97, 96) and **one SMS code**, or with an **email address** and **one code by email**, then a **6-digit PIN** (runs, repeats and
  halves like 123456, 111111, 123123 are refused).
- **One account per sign-in method**: a phone account and an email account are separate accounts, with their own shares and PIN. (Linking them is later.)
- One field on the sign-in page: an "@" means email, anything else is read as a Nepal mobile number. The email is lower-cased; dots and +tags are kept.
- After that: PIN on the same phone. The phone is remembered by a device cookie, so the PIN alone does not work
  from another phone; a new phone gets an SMS code.
- A code again only for recovery (by SMS for a phone account, by email for an email account): **new phone, forgotten PIN, lockout**. Recovery signs out every other phone and
  **pauses new shares for 24 hours**; stopping a share is never paused.
- The PIN is asked again to **create or stop a share**. Every share belongs to the account that made it.
- Wrong PIN: 5 in a row means a 15-minute wait; 10 means a code by SMS. A code works 10 minutes, 5 tries, once.
- Code limits (cost and abuse): one a minute, 3 an hour and 5 a day per number or address; 10 an hour per connection;
  200 SMS and 1,000 emails a day in total. The SMS and the email carry no health content.
- Stored: phone number, scrypt hash of the PIN, SHA-256 of codes, sessions and device tokens; never a plain code,
  PIN or token. Cookies are HttpOnly, Secure, SameSite=Strict; every POST must be JSON.
- Later, not here: passkeys (rpId abhilekh.org), family profiles, consent records.

SMS: Akash SMS v3 (`POST https://sms.aakashsms.com/sms/v3/send/`, form fields auth_token, to, text; docs at
bitbucket.org/aakashsms/api, branch v4). About Rs 1 per code (one credit per SMS). The token is set only as the
Azure app setting `AKASH_SMS_TOKEN`, never in the repository. Without it (and without TEST_MODE) nobody can sign up by SMS.

Email: Azure Communication Services Email (REST `POST https://NAME.communication.azure.com/emails:send?api-version=2023-03-31`,
HMAC-SHA256 signed, no packages). The connection string is set only as the Azure app setting
`ACS_EMAIL_CONNECTION_STRING` (`endpoint=https://NAME.communication.azure.com/;accesskey=...`), never in the repository.
`MAIL_FROM` (default `DoNotReply@abhilekh.org`) must be a sender of a verified domain of that resource. Without the
connection string (and without TEST_MODE) nobody can sign up by email; the page says so. ACS answers 202 when it has
accepted a message; the signing code is tested against its documented scheme but has not yet been run against the live
service. That is the first thing to check after the resource exists.

## Rebuild the sample record

`python3 prototype/share/build.py <qrcode.js>` also writes `server/data/sample-record.json` (same invented L21 and L22
pages and crops as the share prototype). `server/public/qrcode.js` is qrcode-generator 2.0.4 (MIT), licence header kept.

## What it does not do yet

- **One record for everyone.** Every account sees the same invented SAMPLE record; each patient's own confirmed
  record comes next.
- **Storage is one JSON file** (atomic writes). Fine for a demo; a real record needs a database and backups.
- **Unknown links** return 404 and are not logged (no share to log against); more than 30 misses a minute from one address are slowed down. The limiter is per process and per address, not a defence against a determined attacker.
- Links are 14 characters from 31 letters and digits (about 69 bits), not guessable in practice.
- English only; the QR code is drawn but not yet scanned by a phone; not tested with real people.
