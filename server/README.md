# Share server (prototype, SAMPLE data only)

The share half of the promise, enforced by a server instead of a page: the patient picks reports, gets a QR code and
link that lasts **15 minutes** (PRD v2.1, FR-064A; never longer, never forever), sees every open (including refused
ones in the log) and can stop the share at any time without a PIN. The doctor's view is served only while the share is
live and shows value, unit, printed range and printed flag only, under the banner "Patient-provided records. Not
institution-verified. May be incomplete." No advice.

Doctor's view: a watermark ("SAMPLE · shared by the patient · opened <time>") lies over every page and every crop of
the original; there is no download button, and right-click/long-press menus, dragging images out and printing are
switched off. A screenshot or a photo of the screen cannot be prevented by a web page.

Plans, not results: this is a plan under test, run only on invented SAMPLE · नमूना pages.

## Run

    cd server && npm test          # 77 tests, node:test, no packages to install
    PORT=8080 DATA_DIR=./data node server.mjs

`TEST_MODE=1` also allows a 1-minute share so expiry can be watched on a live URL, and, when no SMS token is set,
shows the sign-in code on screen instead of sending it. Never set it in a real deployment.
`INSECURE_COOKIES=1` drops the Secure cookie flag for plain-http local runs only.

## Sign-in (auth.mjs, sms.mjs, mail.mjs)

Plan agreed 21 Nov 2026 (status log; PRD rev. 3.3, Security and consent):

- Sign up with a Nepal mobile number (98, 97, 96) and **one SMS code**, or with an **email address** and **one code by email**, then a **6-digit PIN** (runs, repeats and
  halves like 123456, 111111, 123123 are refused).
- **One account per sign-in method**: a phone account and an email account are separate accounts, with their own shares and PIN. (Linking them is later.)
- **Continue with Google** (OAuth authorization-code flow, server side, scope `openid email` only): Google proves who
  the person is, so no code is sent. A new Google account sets a PIN once; after that Google signs the person in on any
  device (no PIN needed to get in, the PIN is still asked to create or stop a share). A forgotten PIN is reset by signing
  in with Google again, with the same 24-hour hold on new shares and sign-out of other devices as any recovery. The
  account is keyed by Google's permanent id (`sub`), not the address, so a changed Google address is the same account.
  The state is one-use, 10 minutes and bound to the browser by a Lax cookie (Lax, not Strict, because Google sends the
  browser back with a cross-site navigation); the token's issuer, audience, expiry, nonce and verified email are checked.
  Settings (Azure app settings, never the repository): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and optionally
  `PUBLIC_URL` (default `https://app.abhilekh.org`; the redirect URI is `PUBLIC_URL/api/auth/google/callback`). Without
  both, the Google button is hidden and `/api/auth/google/start` says it is not switched on. Not yet run against the real
  Google: that is the first check after the OAuth client exists.
- **Fingerprint or face (passkeys, `passkey.mjs`)**: optional, next to the PIN, never instead of it. Signed in, the patient turns it on
  for a phone (the PIN is asked, so a stolen session cannot add a way in that outlives sign-out). After that one touch signs in. The phone's
  own unlock does the check; Abhilekh stores only a public key, never a fingerprint or a face. The same touch confirms **creating a share** in place of the PIN (the PIN still works; a passkey answer is a one-time, account-bound proof and does not count towards the PIN lockout). A recovery with a
  code removes every passkey. At most 5 per account. The site name (rpId) is the host of `PUBLIC_URL`. Checked with a software authenticator in
  the tests; **not yet tried on a real phone**.
- One field on the sign-in page: an "@" means email, anything else is read as a Nepal mobile number. The email is lower-cased; dots and +tags are kept.
- After that: PIN on the same phone. The phone is remembered by a device cookie, so the PIN alone does not work
  from another phone; a new phone gets an SMS code.
- A code again only for recovery (by SMS for a phone account, by email for an email account): **new phone, forgotten PIN, lockout**. Recovery signs out every other phone and
  **pauses new shares for 24 hours**; stopping a share is never paused.
- The PIN (or fingerprint/face) is asked again to **create a share**. Stopping a share needs no PIN, so it is easy in a hurry. Every share belongs to the account that made it.
- Wrong PIN: 5 in a row means a 15-minute wait; 10 means a code by SMS. A code works 10 minutes, 5 tries, once.
- Code limits (cost and abuse): one a minute, 3 an hour and 5 a day per number or address; 10 an hour per connection;
  200 SMS and 1,000 emails a day in total. The SMS and the email carry no health content.
- Stored: phone number, email address or Google id and email, scrypt hash of the PIN, SHA-256 of codes, sessions and device tokens; never a plain code,
  PIN or token. Cookies are HttpOnly, Secure, SameSite=Strict; every POST must be JSON.
- Later, not here: family profiles (one person managing a parent's record, build plan M1), consent records.

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

## Backups (backup.mjs)

Once at start-up and then every 24 hours, `store.json` is checked (a broken file is never copied) and copied to
`DATA_DIR/backups/store-YYYY-MM-DD.json`; the newest 30 copies are kept.

The second place is **Google Drive** (decided 25 Nov 2026). When both Azure app settings below are set, the same copy is
also uploaded to a Google Drive folder, so a copy survives if the app's own disk is lost. The start-up log says which.

- `GOOGLE_BACKUP_SA_JSON`: the whole JSON key of a Google Cloud **service account** (secret: Azure app setting only,
  never the repository, never chat). The Google Drive API must be switched on in that Cloud project.
- `GOOGLE_BACKUP_FOLDER_ID`: the id of a folder **inside a shared drive** (the part after `/folders/` in its link).
  Add the service account's email to that shared drive as **Content manager**. A service account has no storage of
  its own, so a folder in someone's My Drive does not work; in a shared drive the files use the organisation's storage.

Copies on Drive are not deleted by the app. Without the settings, the copies sit only on the app's own disk.

Restore: stop the app; copy the chosen backup over `DATA_DIR/store.json` (or call `restoreBackup`, which first checks
the backup is a readable store and keeps the old file as `store.json.before-restore`); start the app.
`test/backup.test.mjs` runs this restore end to end.

## What it does not do yet

- **No photos yet.** Each account has its own record, but it can hold only the invented SAMPLE papers. Taking and
  keeping a photo of a paper is build plan M1.
- **Storage is one JSON file** (atomic writes, daily backups). Fine for a demo; photos will go to Azure Blob Storage.
- **Unknown links** return 404 and are not logged (no share to log against); more than 30 misses a minute from one address are slowed down. The limiter is per process and per address, not a defence against a determined attacker.
- Links are 14 characters from 31 letters and digits (about 69 bits), not guessable in practice.
- English and Nepali (the Nepali wording still needs a native speaker's review); the QR code is drawn but not yet scanned by a phone; not tested with real people.
