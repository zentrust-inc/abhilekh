# Share server (prototype, SAMPLE data only)

The share half of the promise, enforced by a server instead of a page: the patient picks reports and a time
(1 hour, 24 hours or 7 days, never forever), gets a QR code and link, sees every open (including refused ones in
the log) and can stop the share. The doctor's view is served only while the share is live and shows value, unit,
printed range and printed flag only. No advice.

Plans, not results: this is a plan under test, run only on invented SAMPLE · नमूना pages.

## Run

    cd server && npm test          # 9 tests, node:test, no packages to install
    PORT=8080 DATA_DIR=./data node server.mjs

`TEST_MODE=1` also allows a 1-minute share so expiry can be watched on a live URL. Never set it in a real deployment.

## Rebuild the sample record

`python3 prototype/share/build.py <qrcode.js>` also writes `server/data/sample-record.json` (same invented L21 and L22
pages and crops as the share prototype). `server/public/qrcode.js` is qrcode-generator 2.0.4 (MIT), licence header kept.

## What it does not do yet

- **No accounts.** One sample patient, no sign-in: anyone who can reach the patient page can create shares. Acceptable only because every record is invented. Real records need sign-in first.
- **Storage is one JSON file** (atomic writes). Fine for a demo; a real record needs a database and backups.
- **Unknown links** return 404 and are not logged (no share to log against); more than 30 misses a minute from one address are slowed down. The limiter is per process and per address, not a defence against a determined attacker.
- Links are 14 characters from 31 letters and digits (about 69 bits), not guessable in practice.
- English only; the QR code is drawn but not yet scanned by a phone; not tested with real people.
