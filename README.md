# अभिलेख (Abhilekh)

**Your medical history follows you, not a plastic bag.**

A patient-controlled portable health record for Nepal, run as a social enterprise. The patient photographs a prescription or lab report; Abhilekh reads it and suggests the entries; the patient confirms them; a doctor sees the history through a QR code that the patient controls.

Abhilekh keeps the record and shows what the paper says. It gives no advice: no interpretation, no added lines about results, no alarms.

**Status: planning stage.** No app yet. This repository holds only fictional documents stamped SAMPLE.

## What is here

| Path | What it is |
|---|---|
| `samples/test-set-v1/` | 10 fictional documents (5 prescriptions, 5 lab reports), each as a clean scan and a phone photo, with an answer key and the script that makes them |
| `CLAUDE.md` | Working rules for anyone (human or Claude) changing this repository |

## Where the rest lives

- Product requirements, brief and status log: Google Drive › Kakani-3 › Abhilekh ("MVP PRD — Abhilekh", "अभिलेख (Abhilekh) — status log").
- The photo reader Abhilekh reuses: [zentrust-inc/chautari](https://github.com/zentrust-inc/chautari), `reader/` (two independent readers must agree before a value is ticked).

## The four steps

1. **Photograph:** camera, gallery or PDF; blurred pages are kept as images, never thrown away.
2. **Read:** two readers read the page; a value is pre-ticked only when both agree. Medicine names are checked against the Department of Drug Administration (DDA) registered list; a name not on it is shown as written and flagged, never guessed.
3. **Confirm:** nothing enters the record until the patient (or a named clinician) confirms it against the original.
4. **Share:** a time-limited QR or link, no account needed for the doctor; every look is logged; the patient can revoke at any time.
