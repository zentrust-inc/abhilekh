# Reader score on test-set-v1 (fictional SAMPLE documents)

Mode: agreement of claude-opus-5-5 + google-vision (a field is ticked only when every reader has the same characters). 10 documents × clean scan and phone photo. Planning stage: a score on invented documents, not a result on real records.

| | Fields | Ticked | Right ticks | **Wrong ticks** | Patient must confirm | Correctly left empty | To check | Not found | Flags added | Ranges added |
|---|---|---|---|---|---|---|---|---|---|---|
| Total | 450 | 332 (74%) | 332 | **0** | 0 | 110 | 8 | 0 | 0 | 0 |

## By kind of field

| Kind | Fields | Right ticks | **Wrong ticks** | Patient must confirm | Correctly left empty | To check |
|---|---|---|---|---|---|---|
| date | 20 | 20 | **0** | 0 | 0 | 0 |
| medicine name | 30 | 28 | **0** | 0 | 0 | 2 |
| result value | 100 | 96 | **0** | 0 | 0 | 4 |
| result unit | 100 | 78 | **0** | 0 | 22 | 0 |
| result range | 100 | 74 | **0** | 0 | 24 | 2 |
| result flag | 100 | 36 | **0** | 0 | 64 | 0 |

## By document

| Doc | Version | Fields | Right ticks | **Wrong ticks** | Patient must confirm | Correctly left empty | To check |
|---|---|---|---|---|---|---|---|
| P01 | clean | 4 | 3 | **0** | 0 | 0 | 1 |
| P01 | photo | 4 | 3 | **0** | 0 | 0 | 1 |
| P02 | clean | 4 | 4 | **0** | 0 | 0 | 0 |
| P02 | photo | 4 | 4 | **0** | 0 | 0 | 0 |
| P03 | clean | 4 | 4 | **0** | 0 | 0 | 0 |
| P03 | photo | 4 | 4 | **0** | 0 | 0 | 0 |
| P04 | clean | 4 | 4 | **0** | 0 | 0 | 0 |
| P04 | photo | 4 | 4 | **0** | 0 | 0 | 0 |
| P05 | clean | 4 | 4 | **0** | 0 | 0 | 0 |
| P05 | photo | 4 | 4 | **0** | 0 | 0 | 0 |
| L01 | clean | 57 | 43 | **0** | 0 | 10 | 4 |
| L01 | photo | 57 | 45 | **0** | 0 | 10 | 2 |
| L02 | clean | 37 | 35 | **0** | 0 | 2 | 0 |
| L02 | photo | 37 | 35 | **0** | 0 | 2 | 0 |
| L03 | clean | 25 | 24 | **0** | 0 | 1 | 0 |
| L03 | photo | 25 | 24 | **0** | 0 | 1 | 0 |
| L04 | clean | 41 | 32 | **0** | 0 | 9 | 0 |
| L04 | photo | 41 | 32 | **0** | 0 | 9 | 0 |
| L05 | clean | 45 | 12 | **0** | 0 | 33 | 0 |
| L05 | photo | 45 | 12 | **0** | 0 | 33 | 0 |

Run with --no-withhold: agreement alone pre-ticks dates and decimal values (the earlier rule).

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
| P01 | clean | medicine: Tab Glimepiride 1 mg | Tab Glimepiride 1 mg | Tab Glimepiride 1 mg / «not seen» | check |
| P01 | photo | medicine: Tab Amlodipine 5 mg | Tab Amlodipine 5 mg | Tab Amlodipine 5 mg / «not seen» | check |
| L01 | clean | Monocytes: value | 5 | 5 / «not seen» | check |
| L01 | clean | Eosinophils: value | 3 | 3 / «not seen» | check |
| L01 | clean | MCHC: value | 32.2 | 32.2 / «not seen» | check |
| L01 | clean | Platelet count: range | 1,50,000 – 4,00,000 | 1,50,000 – 4,00,000 / «not seen» | check |
| L01 | photo | MCHC: value | 32.2 | 32.2 / «not seen» | check |
| L01 | photo | Platelet count: range | 1,50,000 – 4,00,000 | 1,50,000 – 4,00,000 / «not seen» | check |
