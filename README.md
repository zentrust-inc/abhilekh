# अभिलेख (Abhilekh)

**Your medical history follows you, not a plastic bag.**

A patient-controlled portable health record for Nepal, run as a social enterprise. The patient photographs a prescription or lab report; Abhilekh reads it and suggests the entries; the patient confirms them; a doctor sees the history through a QR code that the patient controls.

Abhilekh keeps the record and shows what the paper says. It gives no advice: no interpretation, no added lines about results, no alarms.

**Status: planning stage.** A share app runs at app.abhilekh.org with invented SAMPLE · नमूना papers only. Photos of papers can be kept (exactly as taken, in a Google shared drive) but are not read yet, and adding photos is switched off in production until real papers are decided. Hosting is Microsoft Azure; originals and backups are in Google Drive.

## What is here

| Path | What it is |
|---|---|
| `server/` | The app at app.abhilekh.org: sign-in (SMS, email or Google, then a PIN; fingerprint or face as an option), family records (several people per account), photos kept as taken, 15-minute shares with a log, the doctor's view. See `server/README.md` |
| `reader/` | The two readers (reused from Chautari), the agreement rule, value regions, DDA medicine check, scorer. Runs on test sets; not yet called by the app |
| `prototype/` | Stand-alone pages: `confirm/` (checking values against the paper), `flow/`, `share/` |
| `samples/` | Fictional test sets v1–v3: clean scans and phone photos with answer keys and scores |
| `site-next/` | The public website abhilekh.org (Cloudflare Pages publishes this folder) |
| `film/` | Film sources and scripts |
| `CLAUDE.md` | Working rules for anyone (human or Claude) changing this repository |

## Where the rest lives

- Product baseline: **Abhilekh PRD v2.1** (24 Nov 2026). Build order: **Abhilekh app build plan v1** (25 Nov 2026). Status log and other docs: Google Drive › Kakani-3 › Abhilekh.
- The photo reader Abhilekh reuses: [zentrust-inc/chautari](https://github.com/zentrust-inc/chautari), `reader/` (two independent readers must agree before a value is ticked).

## The four steps (plan)

1. **Photograph:** camera or gallery; the photo is kept exactly as taken, never straightened or cropped, never overwritten.
2. **Read:** two readers read the page; a value is pre-ticked only when both agree. Dates are always typed by the patient; a value with a decimal point always needs its own tap. When the readers disagree, the field says "Unresolved. Original document available." Medicine names are checked against the Department of Drug Administration (DDA) list; a name not on it is shown as written and flagged, never guessed.
3. **Confirm:** nothing enters the record until the patient (or a named clinician) confirms it against the original.
4. **Share:** a QR or link that lasts 15 minutes, with a watermark and no download; no account needed for the doctor; every look is logged; the patient can stop it at any time.
