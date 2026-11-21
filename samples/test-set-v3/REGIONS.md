# Regions found on test set v3 (real Vision word boxes, fictional SAMPLE pages)

Vision was run on all 20 pages in Azure Cloud Shell (free tier, 0 errors, 69 to 123 words a page) and saved as `readings/google-vision-words.json`. Its `lines` are identical to the scored `google-vision.json` on all 20 pages. `reader/regions.mjs` then looked for where each value sits, using Claude Opus's copy of the value and the test name.

| Region | Pages or rows | Found | How | Not found |
|---|---|---|---|---|
| Date | 20 pages | 17 | 14 by the Date or मिति label, 3 by the one date-shaped word | 3 (P22 clean and photo, P25 photo) |
| Result value | 44 lab rows | 42 | 28 by the value's own characters, 14 by the Result column | 2 (Anti-TPO, clean and photo) |
| Printed range | 44 lab rows | 40 | by the Reference column | 4 |

A region not found is `null`: the confirm screen shows the whole page and says so. It never guesses a crop.

## Checked by eye (5 of 20 pages, boxes drawn on the page)
L21 clean, L22 photo, P23 photo, L23 photo (fax), P27 clean (Nepali date). The other 15 pages are counted, not looked at.

## What the real words changed in `regions.mjs`
The first version passed its synthetic tests and was wrong on real pages in these ways:
- A value's characters were also found in the printed range ("Nil"), so Sugar took the range's box.
- The diagonal SAMPLE watermark words joined a row and stretched a range box over several rows.
- Vision gives a colon as a word of its own, so the date box began on the "Date:" label.
- Dates are not always labelled "Date:" (read as "Daze", written मिति, or inside a line); now a single date-shaped word with a four-digit year is used, and several candidates give `null`. A dose such as 1-0-1 is never taken for a date.
- On a tilted phone photo the Result column landed above the handwriting; rows now follow the page's slope.

## Limits
- Where Vision did not read a handwritten value, the Result column is used. Text longer than the column (for example "Pale yellow") can run past it, so crops need padding.
- Boxes are axis-aligned, so on a tilted page a crop includes a little of the neighbouring text.
- A score on invented pages, not a result on real records.
