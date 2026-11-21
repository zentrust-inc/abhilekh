# One connected flow: photograph, read, check, share (prototype, sample data)

One self-contained page: `index.html`. Open it in a browser; no server, no network, no keys, no camera. Rebuild from the repo root: `python3 prototype/flow/build.py <path to qrcode.js>` (QR library `qrcode-generator` 2.0.4, MIT, inlined with its licence header).

It joins the confirm screen and the share screen into the whole promise on invented SAMPLE pages (test set v3: L21 urine report, L22 thyroid report, and the phone photo of L22 as the harder case):
1. **Photograph**: pick a sample page to stand in for the photo.
2. **Read**: shows a reading saved earlier (Claude Opus and Google Vision, the two readers). Nothing is read live and nothing is sent anywhere.
3. **Check**: `decide.mjs` decides each field the way the app would, without the answer key. Both readers agree: pre-filled, confirmed with one tap for the group (each can be edited). A date, or a value with a decimal point in the reading or the printed range: never pre-filled, own tap, crop beside it, no confirm-all. Anything else (readers disagree or one did not see it): left empty, type it from the paper or leave it empty.
4. **Share**: as in `prototype/share` (1 hour, 24 hours or 7 days; QR and a link that goes nowhere; log of every open, refused ones too; stop sharing). The doctor's view shows what the patient confirmed: value, unit, printed range, printed flag, with "See the original". No advice.

Limits:
- `decide.mjs` repeats the rules of `reader/score.mjs` (which only runs as a script) so the page does not need the answer key. If the rules change in one, change the other; `SCORE.md` is the check.
- The demo is honest about weak readings: on most pages Vision does not confirm handwritten values, so many fields are left empty. A patient who taps "Matches the paper" on a wrong pre-filled decimal (for example 1020 for 1.020) would still be wrong: the crop beside it is the only guard, as in the confirm screen.
- Expiry and stopping live only in the page's memory; a real share needs a server. The QR code was drawn, not scanned.
- Only 3 sample pages; crops found by column can show a sliver of a neighbouring line; Anti-TPO has no region. English only. Not usability-tested.
