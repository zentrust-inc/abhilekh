# Abhilekh server (live test with real papers)

The share half of the promise, enforced by a server instead of a page: the patient picks reports, gets a QR code and
link that lasts **15 minutes** (PRD v2.1, FR-064A; never longer, never forever), sees every open (including refused
ones in the log) and can stop the share at any time without a PIN. The doctor's view is served only while the share is
live and shows value, unit, printed range and printed flag only, under the banner "Patient-provided records. Not
institution-verified. May be incomplete." No advice.

Doctor's view: a watermark ("Shared by the patient · opened <time>") lies over every page and every crop of
the original; there is no download button, and right-click/long-press menus, dragging images out and printing are
switched off. A screenshot or a photo of the screen cannot be prevented by a web page.

Live test from 25 Nov 2026 with real papers of patients who have signed consent (Dr. Shrestha's decision). Every paper is
confidential. The invented SAMPLE · नमूना papers stay as a demo ("Try it with a SAMPLE paper") and are labelled.

## Run

    cd server && npm test          # 84 tests, node:test, no packages to install
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

## Family and photos (build plan M1)

**Family.** One account can hold up to 6 people ("Me", "Aama"...), each with their own papers and shares. Adding a person
needs no PIN (the new record is empty) and opens that person. Opening another person's papers asks for the PIN or
fingerprint/face, so on a shared phone one person's papers do not open another's. The person in view is kept per
session. Records made before M1 became the account's first person, name and papers kept. A share belongs to the
person it was made for; the doctor sees only that person's papers.

**Photos.** "Photograph a paper" (camera or gallery) sends the photo as taken: JPEG, PNG, WebP or HEIC, up to 15 MB.
The server keeps exactly those bytes (never straightened, cropped, re-encoded or overwritten), records their SHA-256,
and checks the hash again every time the original is served. The same photo twice is kept once. Only the person it
belongs to, signed in, can open the original. A photo is "waiting to be read": it is not read yet (M2) and cannot be
shared, because only papers the patient has confirmed reach a doctor.

Where originals are kept (`originals.mjs`): with `GOOGLE_BACKUP_SA_JSON` and `GOOGLE_BACKUP_FOLDER_ID` set, in the Google
shared drive, folder `originals` (made once), each file named by its SHA-256 only, so no name or paper is visible in
Drive. Without them (tests, local runs): `DATA_DIR/originals`.

Adding photos is **off** unless the Azure app setting `PHOTOS_ENABLED=1` is set (or `TEST_MODE=1`); it is on in
production since 25 Nov 2026. Beside the camera button, the page gives photo tips (one page, flat, fill the screen, no shine).

The upload is the one POST that is not JSON: raw image bytes with the header `X-Abhilekh-Upload: 1`, which a cross-site
form cannot send.

## Backups (backup.mjs)

Decided 26 Nov 2026: the app works on its own disk on Azure (every tap reads and writes `store.json`, and Google Drive
is not a disk), and **Google Drive holds every copy**.

- **Live copy:** after any change, at most once a minute, the store is written to the shared drive as
  `store-live.json` (one file, replaced in place). If the Azure disk is lost, at most the last minute is lost.
- **Snapshots:** at start-up and every 24 hours, `store-YYYY-MM-DD-HHMM.json` (UTC; older copies have no time) goes to
  `DATA_DIR/backups` and, as a new file, to the shared drive. Snapshots older than 30 days are removed in both places,
  so whatever a patient deletes is gone from every copy within 30 days. A broken store is never copied.
- **Test papers:** anything left in `DATA_DIR/test-papers` is moved at start-up to the shared drive folder
  `test-papers`; the copy here is deleted only when Drive reports the same MD5 and size. Before that, the photos those
  files point to are moved inside the shared drive from `originals` to `test-papers/photos` (same file ids, so the
  archive's links still work), unless a live account uses them; if any move fails, the files stay here. Test papers
  live only in the shared drive (CLAUDE.md), and `originals` holds only photos that live accounts use.

Settings (Azure app settings only, never the repository): `GOOGLE_BACKUP_SA_JSON` (the whole JSON key of a Google Cloud
**service account**; the Drive API must be on in that project) and `GOOGLE_BACKUP_FOLDER_ID` (a folder **inside a shared
drive**, with the service account as **Content manager**, or **Manager** so that deleted photos and old snapshots are deleted at once instead of going to the trash; a service account has no storage of its own). Without them,
only the local snapshots are made, and the start-up log says so.

Restore: stop the app; copy `store-live.json` (from Drive) or a snapshot over `DATA_DIR/store.json` (or call
`restoreBackup`, which first checks the backup is a readable store and keeps the old file as
`store.json.before-restore`); start the app. `test/backup.test.mjs` runs this restore end to end.

## Record model (spec v1.0, record.mjs)

Data first; no screen uses it yet. For each paper with a full copy (prompt v2), the model keeps:
- **Consensus per path**: agreed / one reader / uncertain (from `checkCopy`). Only an agreed value is pre-filled; a date or a value with a decimal point needs its own tick.
- **One append-only decision log** (`paper.log`): confirmed, corrected, not on the paper, can't read, reopened, row counts, whose paper, paper type, coverage. Never edited or shortened; the last event (by sequence number) wins. All events in one request are checked first and added all or none.
- **The gate** (`reader/checklist.mjs`, rules in `schema/checklist.json`): required fields per paper type, confirmed row counts, person and type, and every Google Vision line accounted for. Vision's lines are now kept with each reading (`reading.vision_lines`); a paper read before that needs a person to confirm nothing else is written on it.
- **Items**, built from the log only when the gate is clear, so a correction reaches everything.
- **Re-read**: decisions whose text did not change stand; the rest are reopened by the system.

API (signed in, the person in view only): `GET /api/papers/:id/model`, `POST /api/papers/:id/events` with `{ events: [{ path, action, value?, bulk? }] }`.
The existing check screen (`/confirm`) is unchanged.

**Deploying:** copy `schema/` next to `reader/` (the checklist reads `../schema/checklist.json` from the reader folder). Without it the app still runs and only these two endpoints answer 503.

## Help and deleting (26 Nov 2026)

**Help** (Menu › Help and questions): 13 questions and answers, photo tips and, when the Azure app setting
`HELP_WHATSAPP` is set (digits with country code, e.g. `9779800000000`), a "Write to us on WhatsApp" button. The words
live in `public/help.js` (Nepali in `i18n.js`); `test/help.test.mjs` checks every line has Nepali, that no answer gives
advice, and that the answers match what the app does (15 minutes, 30 days, not kept in Nepal, 6 people, 24 hours).
A "?" on the check screen and on Sharing opens the matching answer.

**Deleting** (decided 26 Nov 2026): the patient deletes a paper (My papers › Delete this paper) or her whole account
(Menu › Delete my account, typing DELETE), confirmed with her PIN or fingerprint/face. At once: gone from the app and
from every share (a share left empty goes too); the photo is deleted in the shared drive, or put in its trash if the
service account is not a Manager there (Google empties the trash after 30 days). Within a minute: gone from
`store-live.json`. Within 30 days: gone from the dated snapshots, which are removed after 30 days. Deleting the account
also removes its sign-in (phone or email, PIN hash, devices, passkeys, sessions, pending codes). API:
`POST /api/papers/:id/delete`, `POST /api/docs/:id/delete` and `POST /api/account/delete` (`{ pin, confirm: 'DELETE' }`).

## What it does not do yet

- **Photos are kept, not read.** Reading them with the two readers is M2; confirming them in the app is M3.
- **Storage is one JSON file** (atomic writes, daily backups) for records; photos go to the Google shared drive.
- **Unknown links** return 404 and are not logged (no share to log against); more than 30 misses a minute from one address are slowed down. The limiter is per process and per address, not a defence against a determined attacker.
- Links are 14 characters from 31 letters and digits (about 69 bits), not guessable in practice.
- English and Nepali (the Nepali wording still needs a native speaker's review); the QR code is drawn but not yet scanned by a phone; not tested with real people.
