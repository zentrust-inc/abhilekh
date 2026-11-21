# Reader score on test-set-v1 (fictional SAMPLE documents)

Mode: agreement of claude-opus-5-5 + google-vision (a field is ticked only when every reader has the same characters). 10 documents × clean scan and phone photo. Planning stage: a score on invented documents, not a result on real records.

| | Fields | Ticked | Right ticks | **Wrong ticks** | Patient must confirm | Correctly left empty | To check | Not found | Flags added | Ranges added |
|---|---|---|---|---|---|---|---|---|---|---|
| Total | 450 | 280 (62%) | 280 | **0** | 52 | 110 | 8 | 0 | 0 | 0 |

## By kind of field

| Kind | Fields | Right ticks | **Wrong ticks** | Patient must confirm | Correctly left empty | To check |
|---|---|---|---|---|---|---|
| date | 20 | 0 | **0** | 20 | 0 | 0 |
| medicine name | 30 | 28 | **0** | 0 | 0 | 2 |
| result value | 100 | 64 | **0** | 32 | 0 | 4 |
| result unit | 100 | 78 | **0** | 0 | 22 | 0 |
| result range | 100 | 74 | **0** | 0 | 24 | 2 |
| result flag | 100 | 36 | **0** | 0 | 64 | 0 |

## By document

| Doc | Version | Fields | Right ticks | **Wrong ticks** | Patient must confirm | Correctly left empty | To check |
|---|---|---|---|---|---|---|---|
| P01 | clean | 4 | 2 | **0** | 1 | 0 | 1 |
| P01 | photo | 4 | 2 | **0** | 1 | 0 | 1 |
| P02 | clean | 4 | 3 | **0** | 1 | 0 | 0 |
| P02 | photo | 4 | 3 | **0** | 1 | 0 | 0 |
| P03 | clean | 4 | 3 | **0** | 1 | 0 | 0 |
| P03 | photo | 4 | 3 | **0** | 1 | 0 | 0 |
| P04 | clean | 4 | 3 | **0** | 1 | 0 | 0 |
| P04 | photo | 4 | 3 | **0** | 1 | 0 | 0 |
| P05 | clean | 4 | 3 | **0** | 1 | 0 | 0 |
| P05 | photo | 4 | 3 | **0** | 1 | 0 | 0 |
| L01 | clean | 57 | 38 | **0** | 5 | 10 | 4 |
| L01 | photo | 57 | 40 | **0** | 5 | 10 | 2 |
| L02 | clean | 37 | 33 | **0** | 2 | 2 | 0 |
| L02 | photo | 37 | 33 | **0** | 2 | 2 | 0 |
| L03 | clean | 25 | 20 | **0** | 4 | 1 | 0 |
| L03 | photo | 25 | 20 | **0** | 4 | 1 | 0 |
| L04 | clean | 41 | 24 | **0** | 8 | 9 | 0 |
| L04 | photo | 41 | 24 | **0** | 8 | 9 | 0 |
| L05 | clean | 45 | 10 | **0** | 2 | 33 | 0 |
| L05 | photo | 45 | 10 | **0** | 2 | 33 | 0 |

## Must confirm (dates and decimal values)

Dates are never pre-ticked. A result value is not pre-ticked when any reader's copy of the value or of the printed range holds a decimal point. The patient confirms these herself, with the crop of the original beside each. Of 52 such fields where the readers agreed, **0** would have been wrong ticks under the earlier rule and 52 would have been right. Readers disagreeing is still "to check".

## Gate checks

- P03 clean: invented brand "T. Glucozen 500" copied as written
- P03 photo: invented brand "T. Glucozen 500" copied as written
- P05 clean: invented brand "Cap. Neurozen-Forte" copied as written
- P05 photo: invented brand "Cap. Neurozen-Forte" copied as written
- L03 clean: potassium 6.6 with the printed HH flag; lab's critical note kept
- L03 photo: potassium 6.6 with the printed HH flag; lab's critical note kept
- L05 clean: no range or flag added (none printed)
- L05 photo: no range or flag added (none printed)

## Medicine names against DDA essential-medicines list 2021

Exact matches only. Not found means: shown as written and flagged for the patient; never replaced. Wrong matches: **0**. The essential list is not the full register of medicines DDA has registered, so registered medicines missing from it (glimepiride, cetirizine, pantoprazole here) are flagged too.

| Doc | Version | As written | Check | Truth (answer key) |
|---|---|---|---|---|
| P01 | clean | Tab Metformin 500 mg | on list: metformin | metformin |
| P01 | photo | Tab Metformin 500 mg | on list: metformin | metformin |
| P01 | clean | Tab Glimepiride 1 mg | readers disagree | glimepiride |
| P01 | photo | Tab Glimepiride 1 mg | not found: shown as written, flagged | glimepiride |
| P01 | clean | Tab Amlodipine 5 mg | on list: amlodipine | amlodipine |
| P01 | photo | Tab Amlodipine 5 mg | readers disagree | amlodipine |
| P02 | clean | Cap Amoxicillin 500 mg | on list: amoxicillin | amoxicillin |
| P02 | photo | Cap Amoxicillin 500 mg | on list: amoxicillin | amoxicillin |
| P02 | clean | Tab Paracetamol 500 mg | on list: paracetamol | paracetamol |
| P02 | photo | Tab Paracetamol 500 mg | on list: paracetamol | paracetamol |
| P02 | clean | Tab Cetirizine 10 mg | not found: shown as written, flagged | cetirizine |
| P02 | photo | Tab Cetirizine 10 mg | not found: shown as written, flagged | cetirizine |
| P03 | clean | T. Glucozen 500 | not found: shown as written, flagged | (invented brand) |
| P03 | photo | T. Glucozen 500 | not found: shown as written, flagged | (invented brand) |
| P03 | clean | T. Atorvastatin 10 | on list: atorvastatin | atorvastatin |
| P03 | photo | T. Atorvastatin 10 | on list: atorvastatin | atorvastatin |
| P03 | clean | T. Losartan 50 | on list: losartan | losartan |
| P03 | photo | T. Losartan 50 | on list: losartan | losartan |
| P04 | clean | ORS | on list: oral rehydration salts | oral rehydration salts |
| P04 | photo | ORS | on list: oral rehydration salts | oral rehydration salts |
| P04 | clean | Zinc 20 mg dispersible tab | on list: zinc sulfate | zinc sulfate |
| P04 | photo | Zinc 20 mg dispersible tab | on list: zinc sulfate | zinc sulfate |
| P04 | clean | Syp Paracetamol (250 mg/5 ml) | on list: paracetamol | paracetamol |
| P04 | photo | Syp Paracetamol (250 mg/5 ml) | on list: paracetamol | paracetamol |
| P05 | clean | Tab. Levothyroxine 50 mcg | on list: levothyroxine | levothyroxine |
| P05 | photo | Tab. Levothyroxine 50 mcg | on list: levothyroxine | levothyroxine |
| P05 | clean | Tab. Pantoprazole 40 mg | not found: shown as written, flagged | pantoprazole |
| P05 | photo | Tab. Pantoprazole 40 mg | not found: shown as written, flagged | pantoprazole |
| P05 | clean | Cap. Neurozen-Forte | not found: shown as written, flagged | (invented brand) |
| P05 | photo | Cap. Neurozen-Forte | not found: shown as written, flagged | (invented brand) |

## Every field that was not a right tick

| Doc | Version | Field | Answer key | Reader(s) | Status |
|---|---|---|---|---|---|
| P01 | clean | date | 2083/08/02 | 2083/08/02 / 2083/08/02 | confirm |
| P01 | clean | medicine: Tab Glimepiride 1 mg | Tab Glimepiride 1 mg | Tab Glimepiride 1 mg / «not seen» | check |
| P01 | photo | date | 2083/08/02 | 2083/08/02 / 2083/08/02 | confirm |
| P01 | photo | medicine: Tab Amlodipine 5 mg | Tab Amlodipine 5 mg | Tab Amlodipine 5 mg / «not seen» | check |
| P02 | clean | date | 2083-07-28 | 2083-07-28 / 2083-07-28 | confirm |
| P02 | photo | date | 2083-07-28 | 2083-07-28 / 2083-07-28 | confirm |
| P03 | clean | date | 18/11/2026 | 18/11/2026 / 18/11/2026 | confirm |
| P03 | photo | date | 18/11/2026 | 18/11/2026 / 18/11/2026 | confirm |
| P04 | clean | date | 2083/08/03 | 2083/08/03 / 2083/08/03 | confirm |
| P04 | photo | date | 2083/08/03 | 2083/08/03 / 2083/08/03 | confirm |
| P05 | clean | date | 2026-11-17 10:42 | 2026-11-17 10:42 / 2026-11-17 10:42 | confirm |
| P05 | photo | date | 2026-11-17 10:42 | 2026-11-17 10:42 / 2026-11-17 10:42 | confirm |
| L01 | clean | date | 19-11-2026 | 19-11-2026 / 19-11-2026 | confirm |
| L01 | clean | Haemoglobin: value | 10.8 | 10.8 / 10.8 | confirm |
| L01 | clean | Monocytes: value | 5 | 5 / «not seen» | check |
| L01 | clean | Eosinophils: value | 3 | 3 / «not seen» | check |
| L01 | clean | RBC count: value | 4.1 | 4.1 / 4.1 | confirm |
| L01 | clean | PCV / Haematocrit: value | 33.5 | 33.5 / 33.5 | confirm |
| L01 | clean | MCH: value | 26.3 | 26.3 / 26.3 | confirm |
| L01 | clean | MCHC: value | 32.2 | 32.2 / «not seen» | check |
| L01 | clean | Platelet count: range | 1,50,000 – 4,00,000 | 1,50,000 – 4,00,000 / «not seen» | check |
| L01 | photo | date | 19-11-2026 | 19-11-2026 / 19-11-2026 | confirm |
| L01 | photo | Haemoglobin: value | 10.8 | 10.8 / 10.8 | confirm |
| L01 | photo | RBC count: value | 4.1 | 4.1 / 4.1 | confirm |
| L01 | photo | PCV / Haematocrit: value | 33.5 | 33.5 / 33.5 | confirm |
| L01 | photo | MCH: value | 26.3 | 26.3 / 26.3 | confirm |
| L01 | photo | MCHC: value | 32.2 | 32.2 / «not seen» | check |
| L01 | photo | Platelet count: range | 1,50,000 – 4,00,000 | 1,50,000 – 4,00,000 / «not seen» | check |
| L02 | clean | date | २०८३/०८/०३ | २०८३/०८/०३ / २०८३/०८/०३ | confirm |
| L02 | clean | HbA1c: value | 8.2 | 8.2 / 8.2 | confirm |
| L02 | photo | date | २०८३/०८/०३ | २०८३/०८/०३ / २०८३/०८/०३ | confirm |
| L02 | photo | HbA1c: value | 8.2 | 8.2 / 8.2 | confirm |
| L03 | clean | date | 20-11-2026 | 20-11-2026 / 20-11-2026 | confirm |
| L03 | clean | Creatinine: value | 1.6 | 1.6 / 1.6 | confirm |
| L03 | clean | Potassium (K+): value | 6.6 | 6.6 / 6.6 | confirm |
| L03 | clean | Uric acid: value | 7.4 | 7.4 / 7.4 | confirm |
| L03 | photo | date | 20-11-2026 | 20-11-2026 / 20-11-2026 | confirm |
| L03 | photo | Creatinine: value | 1.6 | 1.6 / 1.6 | confirm |
| L03 | photo | Potassium (K+): value | 6.6 | 6.6 / 6.6 | confirm |
| L03 | photo | Uric acid: value | 7.4 | 7.4 / 7.4 | confirm |
| L04 | clean | date | 02-10-2026 | 02-10-2026 / 02-10-2026 | confirm |
| L04 | clean | Bilirubin, total: value | 0.8 | 0.8 / 0.8 | confirm |
| L04 | clean | Bilirubin, direct: value | 0.2 | 0.2 / 0.2 | confirm |
| L04 | clean | Total protein: value | 7.1 | 7.1 / 7.1 | confirm |
| L04 | clean | Albumin: value | 4.2 | 4.2 / 4.2 | confirm |
| L04 | clean | T3: value | 1.02 | 1.02 / 1.02 | confirm |
| L04 | clean | T4: value | 5.1 | 5.1 / 5.1 | confirm |
| L04 | clean | TSH: value | 7.84 | 7.84 / 7.84 | confirm |
| L04 | photo | date | 02-10-2026 | 02-10-2026 / 02-10-2026 | confirm |
| L04 | photo | Bilirubin, total: value | 0.8 | 0.8 / 0.8 | confirm |
| L04 | photo | Bilirubin, direct: value | 0.2 | 0.2 / 0.2 | confirm |
| L04 | photo | Total protein: value | 7.1 | 7.1 / 7.1 | confirm |
| L04 | photo | Albumin: value | 4.2 | 4.2 / 4.2 | confirm |
| L04 | photo | T3: value | 1.02 | 1.02 / 1.02 | confirm |
| L04 | photo | T4: value | 5.1 | 5.1 / 5.1 | confirm |
| L04 | photo | TSH: value | 7.84 | 7.84 / 7.84 | confirm |
| L05 | clean | date | 2083/08/04 | 2083/08/04 / 2083/08/04 | confirm |
| L05 | clean | Reaction (pH): value | 6.0 | 6.0 / 6.0 | confirm |
| L05 | photo | date | 2083/08/04 | 2083/08/04 / 2083/08/04 | confirm |
| L05 | photo | Reaction (pH): value | 6.0 | 6.0 / 6.0 | confirm |
