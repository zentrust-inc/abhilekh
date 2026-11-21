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

## Where it runs (SAMPLE demo only)

Azure App Service, Linux, Node 22, Basic B1 (about USD 0.018 an hour, about USD 13 a month), Central India.
Resource group `rg-abhilekh`, plan `plan-abhilekh`, app `abhilekh-share-sample`, address
`https://abhilekh-share-sample.azurewebsites.net` (HTTPS only, TLS 1.2 minimum, FTPS off).
App settings: `DATA_DIR=/home/data-demo` (persistent disk), `SCM_DO_BUILD_DURING_DEPLOYMENT=false`, `PORT` and `WEBSITES_PORT=8080`.
Deployed by zipping `server/` (without `test/`) and `az webapp deploy --type zip` from Azure Cloud Shell, with GitHub signed in for the clone only and signed out afterwards.
To stop the cost: delete the resource group `rg-abhilekh`; Chautari's `rg-chautari` is separate and untouched.

Checked on the live address (with `TEST_MODE=1`, later removed): a 1-minute share opened (200), then after a minute was refused (410) with the refusal in the log;
a stopped share was refused (410) with the refusal logged; "forever" was refused (400). Not checked there: a phone scanning the QR code.
