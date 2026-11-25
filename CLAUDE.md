# Working rules for this repository

## The promise

"Your medical history follows you, not a plastic bag." Build only what serves it: photograph, read, confirm, share. Abhilekh is not racing any other product; features that do not serve the promise wait.

## Never break

- **No advice.** Show what the paper says: value, unit, the printed range and any flag the lab printed. Never interpret, never add lines about what a result means, never invent a range, never raise an alarm. A critical value is shown exactly as the lab printed it.
- **The image is the record.** Extracted values are an index; every value links to the region of the original it came from. Originals are never overwritten.
- **Evidence over guessing.** Two independent readers must agree before a value is pre-ticked; everything else is flagged and shown as "Unresolved. Original document available." (never blank, never guessed). Dates are always typed by the patient; a value with a decimal point always needs its own tap. A medicine name not on the DDA registered list is shown as written and flagged, never mapped to a likely drug.
- **The patient confirms.** Nothing reaches a doctor until the patient (or a named clinician) has confirmed it.
- **The patient controls access.** Shares last 15 minutes, carry a watermark, offer no download, are logged where the patient sees them, and can be stopped at any time without a PIN.
- **No secrets in the repository.** API keys live on the server only.

## How we work

- Planning stage: describe plans, never results; label sample data.
- One home for each thing. Product docs and the status log live in Google Drive › Kakani-3 › Abhilekh; code and test sets live here. Never keep a second copy.
- The product baseline is PRD v2.1 (24 Nov 2026); the build order is the app build plan v1 (25 Nov 2026). Both are in Drive.
- Hosting is Microsoft Azure; originals (paper photos) and backups are in a Google shared drive. Never claim that data stays in Nepal.
- Reuse the Chautari reader (zentrust-inc/chautari, `reader/`) rather than writing a new one.
- Changes go through pull requests; the owner (Dr. Shrestha) reviews and merges.
- At the end of every working session, add one dated entry at the top of the Abhilekh status log in Drive.
