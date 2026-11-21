# Confirm screen (prototype, sample data)

One self-contained page: `index.html`. Open it in a browser; no server, no network, no keys.

What it shows, for invented SAMPLE pages only (test set v3, clean versions of L21 and L22):
- A **date** is never filled in. The patient sees the cropped date from the original and types it.
- A **value with a decimal point** (or whose printed range has one) is filled with the reader's copy, next to a crop of the result cell and a crop of the printed range. It needs its own tap: "Matches the paper", or an edited entry ("Use my entry"). There is no confirm-all.
- "Add to my record" stays off until every item is confirmed.
- No advice: the page never says what a value means or whether a reading looks right. Specific gravity is shown as read (1020) beside the crop that shows 1.020; the patient decides.

Limits:
- Crops are now cut from the original pages at the regions `reader/regions.mjs` finds in the saved Vision word boxes, with a margin (`python3 prototype/confirm/build.py`, run from the repo root; the page images are never changed). Of the 5 cards, 4 regions are exact (2 dates by their label, 2 values by their own characters); Free T4 uses the Result column because Vision did not read that handwriting, so its card says the area is approximate and a neighbouring line may show. Each crop was looked at, but only these 5 cards, not all 20 pages.
- Reading and confirming happen in the page's memory only; nothing is stored or sent.
- Nepali labels and dates in Nepali digits are not done yet. Only a layout check, not usability-tested with anyone.
