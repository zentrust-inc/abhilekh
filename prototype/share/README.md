# Share screen and doctor's view (prototype, sample data)

One self-contained page: `index.html`. Open it in a browser; no server, no network, no keys. Rebuild: `python3 prototype/share/build.py <path to qrcode.js>` from the repo root (QR code library: `qrcode-generator` 2.0.4, MIT, Kazuhiko Arase, copied into the page with its licence header).

What it shows, on invented SAMPLE pages only (test set v3 L21 urine report and L22 thyroid report, as if the patient had confirmed every value):
- The patient chooses which reports to share, optionally names who it is for (for their own list), and picks how long: 1 hour, 24 hours or 7 days. There is no "forever".
- A share gets a QR code and a link that goes nowhere (`abhilekh.example.invalid`).
- The patient sees every share, its state, and a log of who looked and when. A refused attempt (after the share was stopped or ran out) is logged too and shows the doctor nothing.
- "Stop sharing" ends a share at once.
- The doctor's view shows each result exactly as the paper says: value, unit, printed range, any flag the lab printed. "See the original" shows the region of the original page for that value. No advice, no meaning, no alarm.
- "Prototype controls" are not part of the app: they let time pass and open the doctor's view so you can see each state.

Limits:
- Everything lives in the page's memory; nothing is stored, sent or checked on a server. A real share needs a server that holds the record and enforces expiry and revocation; this page only shows how it behaves.
- The crops are cut from the saved Vision word boxes. Where the reader found a value only by its column, the crop is widened and can show a sliver of a neighbouring line. Anti-TPO has no region, so its row says so.
- English only; the Nepali switch of the confirm screen is not carried over yet. Not usability-tested with anyone.
- The sample record skips the confirm step: it stands in for what the patient would have confirmed.
