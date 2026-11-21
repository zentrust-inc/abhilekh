# Reader score on test-set-v2 (fictional SAMPLE documents)

Mode: agreement of claude-opus-5-5 + google-vision (a field is ticked only when every reader has the same characters). 10 documents × clean scan and phone photo. Planning stage: a score on invented documents, not a result on real records.

| | Fields | Ticked | Right ticks | **Wrong ticks** | Patient must confirm | Correctly left empty | To check | Not found | Flags added | Ranges added |
|---|---|---|---|---|---|---|---|---|---|---|
| Total | 336 | 179 (53%) | 179 | **0** | 0 | 48 | 104 | 5 | 0 | 0 |

## By kind of field

| Kind | Fields | Right ticks | **Wrong ticks** | Patient must confirm | Correctly left empty | To check |
|---|---|---|---|---|---|---|
| date | 20 | 15 | **0** | 0 | 0 | 5 |
| medicine name | 52 | 32 | **0** | 0 | 0 | 20 |
| dose | 52 | 25 | **0** | 0 | 0 | 27 |
| duration | 52 | 23 | **0** | 0 | 14 | 15 |
| result value | 40 | 16 | **0** | 0 | 2 | 22 |
| result unit | 40 | 34 | **0** | 0 | 0 | 6 |
| result range | 40 | 30 | **0** | 0 | 4 | 6 |
| result flag | 40 | 4 | **0** | 0 | 28 | 8 |

## By document

| Doc | Version | Fields | Right ticks | **Wrong ticks** | Patient must confirm | Correctly left empty | To check |
|---|---|---|---|---|---|---|---|
| P11 | clean | 13 | 2 | **0** | 0 | 2 | 9 |
| P11 | photo | 13 | 4 | **0** | 0 | 2 | 7 |
| P12 | clean | 13 | 10 | **0** | 0 | 0 | 3 |
| P12 | photo | 13 | 10 | **0** | 0 | 0 | 3 |
| P13 | clean | 13 | 8 | **0** | 0 | 1 | 4 |
| P13 | photo | 13 | 8 | **0** | 0 | 1 | 4 |
| P14 | clean | 10 | 3 | **0** | 0 | 1 | 6 |
| P14 | photo | 10 | 5 | **0** | 0 | 1 | 4 |
| P15 | clean | 10 | 4 | **0** | 0 | 2 | 4 |
| P15 | photo | 10 | 4 | **0** | 0 | 2 | 4 |
| P16 | clean | 13 | 11 | **0** | 0 | 0 | 2 |
| P16 | photo | 13 | 13 | **0** | 0 | 0 | 0 |
| P17 | clean | 13 | 4 | **0** | 0 | 1 | 8 |
| P17 | photo | 13 | 4 | **0** | 0 | 1 | 8 |
| L11 | clean | 33 | 19 | **0** | 0 | 6 | 8 |
| L11 | photo | 33 | 15 | **0** | 0 | 6 | 12 |
| L12 | clean | 25 | 12 | **0** | 0 | 8 | 5 |
| L12 | photo | 25 | 13 | **0** | 0 | 8 | 4 |
| L13 | clean | 25 | 14 | **0** | 0 | 3 | 8 |
| L13 | photo | 25 | 16 | **0** | 0 | 3 | 6 |

Run with --no-withhold: agreement alone pre-ticks dates and decimal values (the earlier rule).

## Gate checks

- P17 clean: invented brand "Tab Namucef 500" copied as written
- P17 photo: invented brand "Tab Namucef 500" copied as written
- P17 clean: invented brand "Cap Udarol-SR 150" copied as written
- P17 photo: invented brand "Cap Udarol-SR 150" copied as written
- P14 clean: smudged duration of Tab Pantoprazole 40 mg: left empty
- P14 photo: smudged duration of Tab Pantoprazole 40 mg: left empty
- L13 clean: smudged value of VLDL cholesterol: left empty
- L13 photo: smudged value of VLDL cholesterol: left empty

## Medicine names against DDA essential-medicines list 2021

Exact matches only. Not found means: shown as written and flagged for the patient; never replaced. Wrong matches: **0**. The essential list is not the full register of medicines DDA has registered, so registered medicines missing from it (glimepiride, cetirizine, pantoprazole here) are flagged too.

| Doc | Version | As written | Check | Truth (answer key) |
|---|---|---|---|---|
| P11 | clean | Tab Pantoprazole 40 mg | readers disagree | pantoprazole |
| P11 | photo | Tab Pantoprazole 40 mg | readers disagree | pantoprazole |
| P11 | clean | Tab Domperidone 10mg | readers disagree | domperidone |
| P11 | photo | Tab Domperidone 10 mg | readers disagree | domperidone |
| P11 | clean | Tab Ondansetron 4 mg | on list: ondansetron | ondansetron |
| P11 | photo | Tab Ondansetron 4 mg | on list: ondansetron | ondansetron |
| P11 | clean | Tab Paracetamol 500 mg | readers disagree | paracetamol |
| P11 | photo | Tab Paracetamol 500 mg | readers disagree | paracetamol |
| P12 | clean | Tab Metformin 500 mg | on list: metformin | metformin |
| P12 | photo | Tab Metformin 500 mg | on list: metformin | metformin |
| P12 | clean | Tab Enalapril 5 mg | on list: enalapril | enalapril |
| P12 | photo | Tab Enalapril 5 mg | readers disagree | enalapril |
| P12 | clean | Tab Atorvastatin 20 mg | on list: atorvastatin | atorvastatin |
| P12 | photo | Tab Atorvastatin 20 mg | on list: atorvastatin | atorvastatin |
| P12 | clean | Tab Aspirin 75 mg | readers disagree | aspirin |
| P12 | photo | Tab Aspirin 75 mg | on list: acetylsalicylic acid (aspirin) | aspirin |
| P13 | clean | Tab Azithromycin 500 mg | on list: azithromycin | azithromycin |
| P13 | photo | Tab Azithromycin 500 mg | on list: azithromycin | azithromycin |
| P13 | clean | Tab Prednisolone 5 mg | on list: prednisolone | prednisolone |
| P13 | photo | Tab Prednisolone 5 mg | on list: prednisolone | prednisolone |
| P13 | clean | Tab Cetirizine 10 mg | not found: shown as written, flagged | cetirizine |
| P13 | photo | Tab Cetirizine 10 mg | not found: shown as written, flagged | cetirizine |
| P13 | clean | Tab Paracetamol 650 mg | readers disagree | paracetamol |
| P13 | photo | Tab Paracetamol 650 mg | readers disagree | paracetamol |
| P14 | clean | Tab Pantoprazole 40 mg | not found: shown as written, flagged | pantoprazole |
| P14 | photo | Tab Pantoprazole 40 mg | not found: shown as written, flagged | pantoprazole |
| P14 | clean |  | readers disagree | clarithromycin |
| P14 | photo | Tab Clarithromycin 500 mg | readers disagree | clarithromycin |
| P14 | clean | Cap Amoxicillin 500 mg | readers disagree | amoxicillin |
| P14 | photo | Cap Amoxicillin 500 mg | readers disagree | amoxicillin |
| P15 | clean | Tab Ciprofloxacin 500 mg | readers disagree | ciprofloxacin |
| P15 | photo | Tab Ciprofloxacin 500 mg | readers disagree | ciprofloxacin |
| P15 | clean | Tab Paracetamol 500 mg | readers disagree | paracetamol |
| P15 | photo | Tab Paracetamol 500 mg | readers disagree | paracetamol |
| P15 | clean | ORS | on list: oral rehydration salts | oral rehydration salts |
| P15 | photo | ORS | on list: oral rehydration salts | oral rehydration salts |
| P16 | clean | Tab Ramipril 5 mg | on list: ramipril | ramipril |
| P16 | photo | Tab Ramipril 5 mg | on list: ramipril | ramipril |
| P16 | clean | Tab Metoprolol 25 mg | on list: metoprolol | metoprolol |
| P16 | photo | Tab Metoprolol 25 mg | on list: metoprolol | metoprolol |
| P16 | clean | Tab Furosemide 40 mg | on list: furosemide | furosemide |
| P16 | photo | Tab Furosemide 40 mg | on list: furosemide | furosemide |
| P16 | clean | Tab spironolactone 25 mg | on list: spironolactone | spironolactone |
| P16 | photo | Tab Spironolactone 25 mg | on list: spironolactone | spironolactone |
| P17 | clean | Tab Namucef 500 | not found: shown as written, flagged | (invented brand) |
| P17 | photo | Tab Namucef 500 | not found: shown as written, flagged | (invented brand) |
| P17 | clean | cap Udarol-SR 150 | not found: shown as written, flagged | (invented brand) |
| P17 | photo | cap Udarol-SR 150 | not found: shown as written, flagged | (invented brand) |
| P17 | clean | Tab Pantoprazole 40 mg | not found: shown as written, flagged | pantoprazole |
| P17 | photo | Tab Pantoprazole 40 mg | not found: shown as written, flagged | pantoprazole |
| P17 | clean | Tab Paracetamol 500 mg | readers disagree | paracetamol |
| P17 | photo | Tab Paracetamol 500 mg | readers disagree | paracetamol |

## Every field that was not a right tick

| Doc | Version | Field | Answer key | Reader(s) | Status |
|---|---|---|---|---|---|
| P11 | clean | date | 2083/08/10 | 2083/08/10 / «not seen» | check |
| P11 | clean | medicine: Tab Pantoprazole 40 mg | Tab Pantoprazole 40 mg | Tab Pantoprazole 40 mg / «not seen» | check |
| P11 | clean | dose: Tab Pantoprazole 40 mg | 1-0-0 | 1-0-0 / «not seen» | check |
| P11 | clean | duration: Tab Pantoprazole 40 mg | 14 days | x 14 days / «not seen» | check |
| P11 | clean | medicine: Tab Domperidone 10 mg | Tab Domperidone 10 mg | Tab Domperidone 10mg / «not seen» | check |
| P11 | clean | dose: Tab Domperidone 10 mg | 1-1-1 | 1-1-1 / «not seen» | check |
| P11 | clean | duration: Tab Domperidone 10 mg | 5 days | x 5 days / «not seen» | check |
| P11 | clean | medicine: Tab Paracetamol 500 mg | Tab Paracetamol 500 mg | Tab Paracetamol 500 mg / «not seen» | check |
| P11 | clean | dose: Tab Paracetamol 500 mg | SOS | SOS / «not seen» | check |
| P11 | photo | medicine: Tab Pantoprazole 40 mg | Tab Pantoprazole 40 mg | Tab Pantoprazole 40 mg / «not seen» | check |
| P11 | photo | duration: Tab Pantoprazole 40 mg | 14 days | x 14 days / «not seen» | check |
| P11 | photo | medicine: Tab Domperidone 10 mg | Tab Domperidone 10 mg | Tab Domperidone 10 mg / «not seen» | check |
| P11 | photo | dose: Tab Domperidone 10 mg | 1-1-1 | 1-1-1 / «not seen» | check |
| P11 | photo | duration: Tab Domperidone 10 mg | 5 days | x 5 days / «not seen» | check |
| P11 | photo | medicine: Tab Paracetamol 500 mg | Tab Paracetamol 500 mg | Tab Paracetamol 500 mg / «not seen» | check |
| P11 | photo | dose: Tab Paracetamol 500 mg | SOS | SOS / «not seen» | check |
| P12 | clean | medicine: Tab Aspirin 75 mg | Tab Aspirin 75 mg | Tab Aspirin 75 mg / «not seen» | check |
| P12 | clean | dose: Tab Aspirin 75 mg | 0-1-0 | 0-1-0 / «not seen» | check |
| P12 | clean | duration: Tab Aspirin 75 mg | 1 month | 1 month / «not seen» | check |
| P12 | photo | medicine: Tab Enalapril 5 mg | Tab Enalapril 5 mg | Tab Enalapril 5 mg / «not seen» | check |
| P12 | photo | duration: Tab Atorvastatin 20 mg | 1 month | x 1 month / «not seen» | check |
| P12 | photo | duration: Tab Aspirin 75 mg | 1 month | x 1 month / «not seen» | check |
| P13 | clean | dose: Tab Prednisolone 5 mg | 2-1-0 | 2-1-0 / «not seen» | check |
| P13 | clean | dose: Tab Cetirizine 10 mg | 0-0-1 | 0-0-1 / «not seen» | check |
| P13 | clean | medicine: Tab Paracetamol 650 mg | Tab Paracetamol 650 mg | Tab Paracetamol 650 mg / «not seen» | check |
| P13 | clean | dose: Tab Paracetamol 650 mg | SOS | SOS / «not seen» | check |
| P13 | photo | dose: Tab Prednisolone 5 mg | 2-1-0 | 2-1-0 / «not seen» | check |
| P13 | photo | dose: Tab Cetirizine 10 mg | 0-0-1 | 0-0-1 / «not seen» | check |
| P13 | photo | medicine: Tab Paracetamol 650 mg | Tab Paracetamol 650 mg | Tab Paracetamol 650 mg / «not seen» | check |
| P13 | photo | dose: Tab Paracetamol 650 mg | SOS | SOS / «not seen» | check |
| P14 | clean | dose: Tab Pantoprazole 40 mg | 1-0-1 | 1-0-1 / «not seen» | check |
| P14 | clean | medicine: Tab Clarithromycin 500 mg | Tab Clarithromycin 500 mg | — / — | check |
| P14 | clean | dose: Tab Clarithromycin 500 mg | 1-0-1 | — / — | check |
| P14 | clean | duration: Tab Clarithromycin 500 mg | 14 days | — / — | check |
| P14 | clean | medicine: Cap Amoxicillin 500 mg | Cap Amoxicillin 500 mg | Cap Amoxicillin 500 mg / «not seen» | check |
| P14 | clean | dose: Cap Amoxicillin 500 mg | 1-0-1 | 1-0-1 / «not seen» | check |
| P14 | photo | dose: Tab Pantoprazole 40 mg | 1-0-1 | 1-0-1 / «not seen» | check |
| P14 | photo | medicine: Tab Clarithromycin 500 mg | Tab Clarithromycin 500 mg | Tab Clarithromycin 500 mg / «not seen» | check |
| P14 | photo | medicine: Cap Amoxicillin 500 mg | Cap Amoxicillin 500 mg | Cap Amoxicillin 500 mg / «not seen» | check |
| P14 | photo | dose: Cap Amoxicillin 500 mg | 1-0-1 | 1-0-1 / «not seen» | check |
| P15 | clean | medicine: Tab Ciprofloxacin 500 mg | Tab Ciprofloxacin 500 mg | Tab Ciprofloxacin 500 mg / «not seen» | check |
| P15 | clean | dose: Tab Ciprofloxacin 500 mg | १-०-१ | १-०-१ / «not seen» | check |
| P15 | clean | duration: Tab Ciprofloxacin 500 mg | ५ दिन | ५ दिन / «not seen» | check |
| P15 | clean | medicine: Tab Paracetamol 500 mg | Tab Paracetamol 500 mg | Tab Paracetamol 500 mg / «not seen» | check |
| P15 | photo | date | २०८३/०८/१३ | २०८३/०८/२३ / «not seen» | check |
| P15 | photo | medicine: Tab Ciprofloxacin 500 mg | Tab Ciprofloxacin 500 mg | Tab Ciprofloxacin 500 mg / «not seen» | check |
| P15 | photo | dose: Tab Ciprofloxacin 500 mg | १-०-१ | १-०-१ / «not seen» | check |
| P15 | photo | medicine: Tab Paracetamol 500 mg | Tab Paracetamol 500 mg | Tab Paracetamol 500 mg / «not seen» | check |
| P16 | clean | duration: Tab Furosemide 40 mg | 7 days | x 7 days / «not seen» | check |
| P16 | clean | duration: Tab Spironolactone 25 mg | 7 days | x 7 days / «not seen» | check |
| P17 | clean | date | 14/11/2026 | 4/11/2026 / «not seen» | check |
| P17 | clean | dose: Tab Namucef 500 | 1-0-1 | 1-0-1 / «not seen» | check |
| P17 | clean | dose: Cap Udarol-SR 150 | 0-0-1 | 0-0-1 / «not seen» | check |
| P17 | clean | duration: Cap Udarol-SR 150 | 10 d | 10 d / «not seen» | check |
| P17 | clean | dose: Tab Pantoprazole 40 mg | 1-0-0 | 1-0-0 / «not seen» | check |
| P17 | clean | duration: Tab Pantoprazole 40 mg | 10 d |  /  | check |
| P17 | clean | medicine: Tab Paracetamol 500 mg | Tab Paracetamol 500 mg | Tab Paracetamol 500 mg / «not seen» | check |
| P17 | clean | dose: Tab Paracetamol 500 mg | SOS | SOS / «not seen» | check |
| P17 | photo | date | 14/11/2026 | 4/11/2026 / «not seen» | check |
| P17 | photo | dose: Tab Namucef 500 | 1-0-1 | 1-0-1 / «not seen» | check |
| P17 | photo | dose: Cap Udarol-SR 150 | 0-0-1 | 0-0-1 / «not seen» | check |
| P17 | photo | duration: Cap Udarol-SR 150 | 10 d | 10 d / «not seen» | check |
| P17 | photo | dose: Tab Pantoprazole 40 mg | 1-0-0 | 1-0-0 / «not seen» | check |
| P17 | photo | duration: Tab Pantoprazole 40 mg | 10 d |  /  | check |
| P17 | photo | medicine: Tab Paracetamol 500 mg | Tab Paracetamol 500 mg | Tab Paracetamol 500 mg / «not seen» | check |
| P17 | photo | dose: Tab Paracetamol 500 mg | SOS | SOS / «not seen» | check |
| L11 | clean | Haemoglobin: flag | L | L / «not seen» | check |
| L11 | clean | Total WBC count: value | 7,600 | 7,600 / «not seen» | check |
| L11 | clean | Neutrophils: value | 62 | 62 / «not seen» | check |
| L11 | clean | Lymphocytes: value | 31 | 31 / «not seen» | check |
| L11 | clean | RBC count: value | 4.2 | 4.2 / «not seen» | check |
| L11 | clean | MCV: value | 86 | 86 / «not seen» | check |
| L11 | clean | ESR (1st hour): value | 28 | 28 / «not seen» | check |
| L11 | clean | ESR (1st hour): flag | H | H / «not seen» | check |
| L11 | photo | Haemoglobin: flag | L | L / «not seen» | check |
| L11 | photo | Total WBC count: value | 7,600 | 7,600 / «not seen» | check |
| L11 | photo | Neutrophils: value | 62 | 62 / «not seen» | check |
| L11 | photo | Lymphocytes: value | 31 | 31 / «not seen» | check |
| L11 | photo | Platelet count: unit | /µL | /µL / «not seen» | check |
| L11 | photo | RBC count: value | 4.2 | 4.2 / «not seen» | check |
| L11 | photo | RBC count: unit | million/µL | million/µL / «not seen» | check |
| L11 | photo | RBC count: range | 3.8 – 5.2 | 3.8 – 5.2 / «not seen» | check |
| L11 | photo | MCV: value | 86 | 86 / «not seen» | check |
| L11 | photo | ESR (1st hour): value | 28 | 28 / «not seen» | check |
| L11 | photo | ESR (1st hour): range | 0 – 20 | 0 – 20 / «not seen» | check |
| L11 | photo | ESR (1st hour): flag | H | H / «not seen» | check |
| L12 | clean | Urea: range | 15-45 | 15-45 / «not seen» | check |
| L12 | clean | Creatinine: range | 0.6-1.2 | 0.6-1.2 / «not seen» | check |
| L12 | clean | Sodium: value | 138 | 138 / «not seen» | check |
| L12 | clean | Sodium: unit | mmol/L | mmol/L / «not seen» | check |
| L12 | clean | Potassium: value | 4.1 | 4.1 / «not seen» | check |
| L12 | photo | FBS: unit | mg/dl | mg/dl / «not seen» | check |
| L12 | photo | Urea: unit | mg/dl | mg/dl / «not seen» | check |
| L12 | photo | Creatinine: unit | mg/dl | mg/dl / «not seen» | check |
| L12 | photo | Creatinine: range | 0.6-1.2 | 0.6-1.2 / «not seen» | check |
| L13 | clean | date | 2083/08/16 | 2083/08/16 / «not seen» | check |
| L13 | clean | Total cholesterol: value | 196 | 196 / «not seen» | check |
| L13 | clean | Triglycerides: value | 180 | 180 / «not seen» | check |
| L13 | clean | Triglycerides: flag | H | H / «not seen» | check |
| L13 | clean | HDL cholesterol: value | 42 | 42 / «not seen» | check |
| L13 | clean | LDL cholesterol: value | 118 | 118 / «not seen» | check |
| L13 | clean | Non-HDL cholesterol: value | 154 | 154 / «not seen» | check |
| L13 | clean | Non-HDL cholesterol: flag | H | H / «not seen» | check |
| L13 | photo | Triglycerides: value | 180 | 180 / «not seen» | check |
| L13 | photo | Triglycerides: flag | H | H / «not seen» | check |
| L13 | photo | HDL cholesterol: value | 42 | 42 / «not seen» | check |
| L13 | photo | HDL cholesterol: range | > 40 | > 40 / «not seen» | check |
| L13 | photo | LDL cholesterol: value | 118 | 118 / «not seen» | check |
| L13 | photo | Non-HDL cholesterol: flag | H | H / «not seen» | check |
