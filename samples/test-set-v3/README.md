# Test set v3 — held-out pages (fictional, SAMPLE · नमूना)

Planning stage: invented documents only. A score on these pages is a score on invented pages, not a result on real records.

## Why v3 exists

v1 and v2 were used to build and tune the reader's scoring (the agreement rule, the dose and duration comparison, the dash-tolerant dose confirmation). Scores on pages you tuned against say little about pages you have not seen. v3 is **held out**: new hands, new ways of writing a dose, new damage. It is read **once**, with the code on this branch as committed; nothing in `reader/` changes after the scores are seen. If a key error turns up later it is corrected and disclosed, as was done for v2.

## The ten documents

| Id | Page | What it tests |
|---|---|---|
| P21 | `abbreviated-doses` (Homemade Apple) | doses as letters and words: `OD`, `BD`, `1 tab BD`, `OD empty stomach`, `OD mane`; durations `continue`, `till review`, `x 3 mo`; duration on a second line |
| P22 | `child-syrup-ml` (Mansalva) | ml doses, `2.5 ml TDS` (decimal), `125 mg/5 ml` (slash), weight on the page, invented brand **Amoxinepa**, no duration on ORS |
| P23 | `fractions-decimals` (Zeyada) | `1/2-0-1/2`, `1/2-0-0`, `0.5-0-0.5`, `2.5 mg`; 1/7 look-alikes in the date, two durations and a dose |
| P24 | `faded-carbon-steep` (Nothing You Could Do) | pale-blue carbon copy, faint ink; photo at a steep angle with a finger shadow |
| P25 | `folded-torn-corner` (Just Another Hand) | folded in four (a crease through the durations), top-right corner torn off, narrow crowded writing |
| P26 | `narrow-caps-lookalikes-glare` (Sue Ellen Francisco) | all capitals; 1/7, 4/9, 0/6, 2/7 look-alikes; photo under-exposed with a flash highlight |
| P27 | `devanagari-weeks-months` (Amita + Kalam) | Devanagari doses (`एक पटक`, `बिहान १`, `खाली पेटमा १`), durations in weeks and months, month name in the date (`२०८३ मंसिर ५`) |
| L21 | `urine-text-results` | results that are words (`Pale yellow`, `Trace`, `Nil`), `2-4` and `6-8` counts, `1.020`, hand-written `H` |
| L22 | `thyroid-coffee-bleed` (Rock Salt) | coffee ring over values, mirrored bleed-through from the back, `µIU/mL`, decimals, hand-written `L` |
| L23 | `liver-fax` | printed report, photo is a fax: shrunk, thresholded, noise, dropped scan lines, a streak |

Every page exists as a clean scan (`clean/*.png`) and a phone photo (`photo/*.jpg`). 382 scored fields in total (62 doses, 62 durations, 62 medicine names, 20 dates, 44 results × value, unit, range, flag).

## What is new for the scorer

- Doses that are **not digits in slots**: the dash-tolerant rule (PR #3) must leave them alone and they are compared as written.
- A **fraction is not its digits run together**: `1/2-0-1/2` is not `12-0-12` (`doseOf` keeps `/`; commit in this branch, made before any v3 reading; v1 and v2 re-score identically).
- Decimals are drawn with a visible point (a hand font can make the full stop of `2.5` vanish, and the key must describe what the page shows).
- Devanagari digits are drawn in Kalam (Amita draws a Devanagari 1 like a 9).

## Checks before any reading

- Rebuilding gives byte-identical files (sha256 compared across two runs).
- An "oracle" reading that copies the answer key exactly scores 332 ticks of 382 fields, **0 wrong ticks**, with 50 fields correctly empty (units and flags that are not printed, durations that are not written): the key and the scorer agree.
- The DDA name check gives the expected result for every medicine: all generics are on the list, **Amoxinepa** is not found.

## Key conventions (same as v1 and v2)

Ground truth is what the writer **meant**. A look-alike digit is the intended digit drawn together with its look-alike (`[1~7]` in the generator: intended 1, look-alike 7). `dose_as_written` and `duration_as_written` are the exact copies a reader should return. Fields a reader cannot read are empty in the key and listed under `illegible` (none in v3).

## Rebuild

```bash
bash samples/test-set-v2/fetch-fonts.sh && bash samples/test-set-v3/fetch-fonts.sh
python3 samples/test-set-v3/make_test_set.py samples/test-set-v3 samples/test-set-v3/fonts
```

Every person, clinician, clinic, laboratory and registration number is invented (Namuna / Udaharan = "sample" / "example"). The fonts are open (SIL OFL) and are not committed.
