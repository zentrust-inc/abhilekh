# Reader score on test-set-v2 (fictional SAMPLE documents)

Mode: one reader only (claude-opus-5-5); agreement needs a second reader. 10 documents × clean scan and phone photo. Planning stage: a score on invented documents, not a result on real records.

| | Fields | Ticked | Right ticks | **Wrong ticks** | Correctly left empty | To check | Not found | Flags added | Ranges added |
|---|---|---|---|---|---|---|---|---|---|
| Total | 336 | 283 (84%) | 280 | **3** | 48 | 0 | 5 | 0 | 0 |

## By kind of field

| Kind | Fields | Right ticks | **Wrong ticks** | Correctly left empty | To check |
|---|---|---|---|---|---|
| date | 20 | 17 | **3** | 0 | 0 |
| medicine name | 52 | 51 | **0** | 0 | 1 |
| dose | 52 | 51 | **0** | 0 | 1 |
| duration | 52 | 35 | **0** | 14 | 3 |
| result value | 40 | 38 | **0** | 2 | 0 |
| result unit | 40 | 40 | **0** | 0 | 0 |
| result range | 40 | 36 | **0** | 4 | 0 |
| result flag | 40 | 12 | **0** | 28 | 0 |

## By document

| Doc | Version | Fields | Right ticks | **Wrong ticks** | Correctly left empty | To check |
|---|---|---|---|---|---|---|
| P11 | clean | 13 | 11 | **0** | 2 | 0 |
| P11 | photo | 13 | 11 | **0** | 2 | 0 |
| P12 | clean | 13 | 13 | **0** | 0 | 0 |
| P12 | photo | 13 | 13 | **0** | 0 | 0 |
| P13 | clean | 13 | 12 | **0** | 1 | 0 |
| P13 | photo | 13 | 12 | **0** | 1 | 0 |
| P14 | clean | 10 | 6 | **0** | 1 | 3 |
| P14 | photo | 10 | 9 | **0** | 1 | 0 |
| P15 | clean | 10 | 8 | **0** | 2 | 0 |
| P15 | photo | 10 | 7 | **1** | 2 | 0 |
| P16 | clean | 13 | 13 | **0** | 0 | 0 |
| P16 | photo | 13 | 13 | **0** | 0 | 0 |
| P17 | clean | 13 | 10 | **1** | 1 | 1 |
| P17 | photo | 13 | 10 | **1** | 1 | 1 |
| L11 | clean | 33 | 27 | **0** | 6 | 0 |
| L11 | photo | 33 | 27 | **0** | 6 | 0 |
| L12 | clean | 25 | 17 | **0** | 8 | 0 |
| L12 | photo | 25 | 17 | **0** | 8 | 0 |
| L13 | clean | 25 | 22 | **0** | 3 | 0 |
| L13 | photo | 25 | 22 | **0** | 3 | 0 |

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
| P11 | clean | Tab Pantoprazole 40 mg | not found: shown as written, flagged | pantoprazole |
| P11 | photo | Tab Pantoprazole 40 mg | not found: shown as written, flagged | pantoprazole |
| P11 | clean | Tab Domperidone 10mg | on list: domperidone | domperidone |
| P11 | photo | Tab Domperidone 10 mg | on list: domperidone | domperidone |
| P11 | clean | Tab Ondansetron 4 mg | on list: ondansetron | ondansetron |
| P11 | photo | Tab Ondansetron 4 mg | on list: ondansetron | ondansetron |
| P11 | clean | Tab Paracetamol 500 mg | on list: paracetamol | paracetamol |
| P11 | photo | Tab Paracetamol 500 mg | on list: paracetamol | paracetamol |
| P12 | clean | Tab Metformin 500 mg | on list: metformin | metformin |
| P12 | photo | Tab Metformin 500 mg | on list: metformin | metformin |
| P12 | clean | Tab Enalapril 5 mg | on list: enalapril | enalapril |
| P12 | photo | Tab Enalapril 5 mg | on list: enalapril | enalapril |
| P12 | clean | Tab Atorvastatin 20 mg | on list: atorvastatin | atorvastatin |
| P12 | photo | Tab Atorvastatin 20 mg | on list: atorvastatin | atorvastatin |
| P12 | clean | Tab Aspirin 75 mg | on list: acetylsalicylic acid (aspirin) | aspirin |
| P12 | photo | Tab Aspirin 75 mg | on list: acetylsalicylic acid (aspirin) | aspirin |
| P13 | clean | Tab Azithromycin 500 mg | on list: azithromycin | azithromycin |
| P13 | photo | Tab Azithromycin 500 mg | on list: azithromycin | azithromycin |
| P13 | clean | Tab Prednisolone 5 mg | on list: prednisolone | prednisolone |
| P13 | photo | Tab Prednisolone 5 mg | on list: prednisolone | prednisolone |
| P13 | clean | Tab Cetirizine 10 mg | not found: shown as written, flagged | cetirizine |
| P13 | photo | Tab Cetirizine 10 mg | not found: shown as written, flagged | cetirizine |
| P13 | clean | Tab Paracetamol 650 mg | on list: paracetamol | paracetamol |
| P13 | photo | Tab Paracetamol 650 mg | on list: paracetamol | paracetamol |
| P14 | clean | Tab Pantoprazole 40 mg | not found: shown as written, flagged | pantoprazole |
| P14 | photo | Tab Pantoprazole 40 mg | not found: shown as written, flagged | pantoprazole |
| P14 | clean |  | readers disagree | clarithromycin |
| P14 | photo | Tab Clarithromycin 500 mg | on list: clarithromycin | clarithromycin |
| P14 | clean | Cap Amoxicillin 500 mg | on list: amoxicillin | amoxicillin |
| P14 | photo | Cap Amoxicillin 500 mg | on list: amoxicillin | amoxicillin |
| P15 | clean | Tab Ciprofloxacin 500 mg | on list: ciprofloxacin | ciprofloxacin |
| P15 | photo | Tab Ciprofloxacin 500 mg | on list: ciprofloxacin | ciprofloxacin |
| P15 | clean | Tab Paracetamol 500 mg | on list: paracetamol | paracetamol |
| P15 | photo | Tab Paracetamol 500 mg | on list: paracetamol | paracetamol |
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
| P17 | clean | Tab Paracetamol 500 mg | on list: paracetamol | paracetamol |
| P17 | photo | Tab Paracetamol 500 mg | on list: paracetamol | paracetamol |

## Every field that was not a right tick

| Doc | Version | Field | Answer key | Reader(s) | Status |
|---|---|---|---|---|---|
| P14 | clean | medicine: Tab Clarithromycin 500 mg | Tab Clarithromycin 500 mg | — | check |
| P14 | clean | dose: Tab Clarithromycin 500 mg | 1-0-1 | — | check |
| P14 | clean | duration: Tab Clarithromycin 500 mg | 14 days | — | check |
| P15 | photo | date | २०८३/०८/१३ | २०८३/०८/२३ | WRONG |
| P17 | clean | date | 14/11/2026 | 4/11/2026 | WRONG |
| P17 | clean | duration: Tab Pantoprazole 40 mg | 10 d |  | check |
| P17 | photo | date | 14/11/2026 | 4/11/2026 | WRONG |
| P17 | photo | duration: Tab Pantoprazole 40 mg | 10 d |  | check |
