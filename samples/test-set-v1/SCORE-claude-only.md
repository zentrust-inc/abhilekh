# Reader score on test-set-v1 (fictional SAMPLE documents)

Mode: one reader only (claude-opus-5-5); agreement needs a second reader. 10 documents × clean scan and phone photo. Planning stage: a score on invented documents, not a result on real records.

| | Fields | Ticked | Right ticks | **Wrong ticks** | Correctly left empty | To check | Not found | Flags added | Ranges added |
|---|---|---|---|---|---|---|---|---|---|
| Total | 450 | 340 (76%) | 340 | **0** | 110 | 0 | 0 | 0 | 0 |

## Gate checks

- P03 clean: invented brand copied as written
- P03 photo: invented brand copied as written
- P05 clean: invented brand copied as written
- P05 photo: invented brand copied as written
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
| P01 | clean | Tab Glimepiride 1 mg | not found: shown as written, flagged | glimepiride |
| P01 | photo | Tab Glimepiride 1 mg | not found: shown as written, flagged | glimepiride |
| P01 | clean | Tab Amlodipine 5 mg | on list: amlodipine | amlodipine |
| P01 | photo | Tab Amlodipine 5 mg | on list: amlodipine | amlodipine |
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
