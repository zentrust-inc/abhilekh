# Test set v1 (fictional, SAMPLE)

Ten invented documents in typical Nepali styles, made on 20 Nov 2026. Every person, clinician, clinic, lab and registration number is invented; every page is stamped SAMPLE · नमूना.

| ID | Document | What it tests |
|---|---|---|
| P01 | Hospital OPD ticket, hand-written Rx (diabetes, blood pressure) | 1-0-1 dose notation, BS date in Latin digits |
| P02 | Clinic Rx with Nepali instructions | Devanagari hand-writing, TDS / SOS / HS |
| P03 | Rushed hand-writing on a ruled pad | Invented brand **Glucozen** must be flagged, not mapped; strengths without units |
| P04 | Child's prescription, syrup in ml, weight written | Concentration vs dose kept separate; doctor's advice stored as written |
| P05 | Computer-printed e-prescription | Invented brand **Neurozen-Forte**; mcg vs mg; wrapped table row |
| L01 | CBC | Lakh grouping (2,45,000) |
| L02 | Diabetes panel and lipids | BS date in Devanagari digits; HbA1c bands printed as a footnote |
| L03 | Kidney panel | Potassium 6.6 with the lab's HH flag and critical note, shown exactly as printed |
| L04 | Liver and thyroid (photo is faded) | µ symbol; T4 at the lower limit with no flag: show no flag |
| L05 | Urine form, results hand-filled | Text values (Nil, Trace); no ranges printed, so none are added |

Files: `clean/` (PNG scans), `photo/` (JPG phone photos: tilt, shadow, blur), `answer_key.json` (every field a perfect reader returns, plus each page's traps), `answer_key.csv` (one row per medicine or result).

Rebuild (output is byte-identical):

```bash
./fetch-fonts.sh                 # Kalam, Mukta, Noto Sans Devanagari (SIL OFL) from npm
python3 make_test_set.py . fonts  # needs Pillow with libraqm, fontTools
```
