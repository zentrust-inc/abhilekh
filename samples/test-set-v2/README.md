# Test set v2 (fictional, SAMPLE): harder hand-writing

Ten invented documents made on 20 Nov 2026: seven prescriptions and three hand-filled lab forms, each as a clean scan (`clean/`, PNG) and a phone photo (`photo/`, JPG). Every person, clinician, clinic, lab and registration number is invented; every page is stamped SAMPLE · नमूना.

v1 used one tidy hand-writing font with a little tilt. In v2 each letter is drawn on its own (own slant, size, baseline wobble, pressure), in six different hands (Caveat, Reenie Beanie, Covered By Your Grace, Shadows Into Light Two, Gochi Hand, Nanum Pen Script) plus Kalam for Devanagari, and the pages carry the faults real prescriptions have. It is still synthetic hand-writing: it is harder than v1, not a substitute for real doctors' pens.

| ID | Document | What it tests |
|---|---|---|
| P11 | Small pad, crowded fast writing leaning about 20° | lines nearly touching, `1-1-1` vs `1-0-1`, `)` glued to the name, SOS lines with no duration |
| P12 | Doses and durations corrected by over-writing | the final (darker) digit is the dose; the light digit under it is not (`1-[1>0]-1`, `x [2>1] month`, `x [3>2] months`) |
| P13 | 5/6 and 9/3 look-alike digits | `x 3 days` drawn like 9, `x 5 days` and `650 mg` like 6/5, a date day 5 like 6 |
| P14 | Ink smudge | one duration smudged beyond reading (key: empty); a light smear over another name (still readable) |
| P15 | English and Devanagari hand-writing, Devanagari digits | `१-०-१`, `५ दिन`, date `२०८३/०८/१३`, dose in words |
| P16 | Fairly legible Rx, **crumpled paper in the photo** | creases shift and shade the strokes |
| P17 | Pencil-soft hand, round rubber stamp over the writing | two invented brands (**Namucef 500**, **Udarol-SR 150**), `5 d` / `10 d` |
| L11 | CBC form: results and flags written by hand | look-alike digits in five values, hand-written H/L flags, lakh grouping `2,56,000`, printed ranges |
| L12 | Lab slip written entirely by hand, **crumpled photo** | units as written (`mg/dl`), ranges for four tests and none for sodium and potassium |
| L13 | Lipid form: one over-written value, one smudged value | total cholesterol 196 over 186; VLDL smudged (key: empty, unit/range/flag still readable) |

## What the answer key means

`answer_key.json` (every field a perfect reader returns) and `answer_key.csv` (one row per medicine or result) work as in v1, plus:

- **`dose_as_written` and `duration_as_written`** on every medicine: the exact copy a reader should return (`1-0-1`, `SOS`, `14 days`, `5 d`, `५ दिन`). The older `dose` and `duration` keep the readable form. `score.mjs` scores dose and duration only for keys that have these fields (v1 does not).
- **Ground truth is what the writer meant.** A look-alike digit is the intended digit drawn together with its look-alike; an over-written digit is the old digit drawn lighter under the new one. Some digits are meant to be hard for anyone. The number to watch is **wrong ticks** (both readers agree and are wrong), not how many fields were read.
- **`illegible`** lists the fields smudged beyond reading (P14 duration of the first medicine, L13 VLDL value). The key leaves them empty. A reader value there can only be a guess; it must be sent to the person, never ticked.

## Key corrections after the first scoring (disclosed)

The first scoring showed 4 wrong ticks for Claude Opus + Vision. Looking at the pages, two of the four mismatches were errors in the answer key, not in the readers, and the key was corrected (the page images and the readings were not touched; the images regenerate byte-identically):

- **P13 date:** the key said `2083/08/05`; the page shows `2083/08/5` (no leading zero). Both readers copied `2083/08/5`.
- **L12 creatinine:** the key said `0.9`; the drawing lost the decimal point, so the page shows `09`. Both readers copied `09`. Abhilekh copies what is written and never repairs it from the printed range, so `09` is the right copy. (A lost decimal point on a real slip would pass two readers the same way; the patient's confirmation is what catches it.)

Before the correction: 4 wrong ticks (both pairs of rows above). After: 0. The correction was made after seeing the scores, so treat the 0 with that in mind. Claude Opus alone still has 3 wrong ticks (a date digit misread on P15 photo and P17 clean and photo), all of which Vision's disagreement caught.

## Rebuild (output is byte-identical)

```bash
./fetch-fonts.sh                  # hand-writing and form fonts (SIL OFL) from npm, merged into ./fonts
python3 make_test_set.py . fonts  # needs Pillow with libraqm, fontTools, numpy, scipy
```

