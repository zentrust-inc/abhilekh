# Reader score on test-set-v3 (fictional SAMPLE documents)

Mode: agreement of claude-opus-5-5 + google-vision (a field is ticked only when every reader has the same characters). 10 documents × clean scan and phone photo. Planning stage: a score on invented documents, not a result on real records.

| | Fields | Ticked | Right ticks | **Wrong ticks** | Correctly left empty | To check | Not found | Flags added | Ranges added |
|---|---|---|---|---|---|---|---|---|---|
| Total | 382 | 194 (51%) | 191 | **3** | 50 | 138 | 0 | 0 | 0 |

## By kind of field

| Kind | Fields | Right ticks | **Wrong ticks** | Correctly left empty | To check |
|---|---|---|---|---|---|
| date | 20 | 9 | **2** | 0 | 9 |
| medicine name | 62 | 35 | **0** | 0 | 27 |
| dose | 62 | 28 | **0** | 0 | 34 |
| duration | 62 | 25 | **0** | 4 | 33 |
| result value | 44 | 23 | **1** | 0 | 20 |
| result unit | 44 | 29 | **0** | 12 | 3 |
| result range | 44 | 36 | **0** | 0 | 8 |
| result flag | 44 | 6 | **0** | 34 | 4 |

## By document

| Doc | Version | Fields | Right ticks | **Wrong ticks** | Correctly left empty | To check |
|---|---|---|---|---|---|---|
| P21 | clean | 16 | 3 | **0** | 0 | 13 |
| P21 | photo | 16 | 2 | **0** | 0 | 14 |
| P22 | clean | 16 | 3 | **0** | 1 | 12 |
| P22 | photo | 16 | 3 | **0** | 1 | 12 |
| P23 | clean | 16 | 8 | **1** | 0 | 7 |
| P23 | photo | 16 | 12 | **1** | 0 | 3 |
| P24 | clean | 13 | 7 | **0** | 0 | 6 |
| P24 | photo | 13 | 7 | **0** | 0 | 6 |
| P25 | clean | 13 | 10 | **0** | 0 | 3 |
| P25 | photo | 13 | 5 | **0** | 0 | 8 |
| P26 | clean | 13 | 9 | **0** | 0 | 4 |
| P26 | photo | 13 | 9 | **0** | 0 | 4 |
| P27 | clean | 13 | 9 | **0** | 1 | 3 |
| P27 | photo | 13 | 7 | **0** | 1 | 5 |
| L21 | clean | 37 | 17 | **1** | 14 | 5 |
| L21 | photo | 37 | 5 | **0** | 14 | 18 |
| L22 | clean | 21 | 11 | **0** | 4 | 6 |
| L22 | photo | 21 | 12 | **0** | 4 | 5 |
| L23 | clean | 33 | 26 | **0** | 5 | 2 |
| L23 | photo | 33 | 26 | **0** | 5 | 2 |

## Gate checks

- P22 clean: invented brand "Syp Amoxinepa 250 mg/5 ml" copied as written
- P22 photo: invented brand "Syp Amoxinepa 250 mg/5 ml" copied as written

## Medicine names against DDA essential-medicines list 2021

Exact matches only. Not found means: shown as written and flagged for the patient; never replaced. Wrong matches: **0**. The essential list is not the full register of medicines DDA has registered, so registered medicines missing from it (glimepiride, cetirizine, pantoprazole here) are flagged too.

| Doc | Version | As written | Check | Truth (answer key) |
|---|---|---|---|---|
| P21 | clean | Tab Amlodipine 5 mg | readers disagree | amlodipine |
| P21 | photo | Tab Amlodipine 5 mg | readers disagree | amlodipine |
| P21 | clean | Tab Losartan 50 mg | readers disagree | losartan |
| P21 | photo | Tab Losartan 50 mg | readers disagree | losartan |
| P21 | clean | Tab Gliclazide 80 mg | readers disagree | gliclazide |
| P21 | photo | Tab Gliclazide 80 mg | readers disagree | gliclazide |
| P21 | clean | Tab Levothyroxine 50 mcg | readers disagree | levothyroxine |
| P21 | photo | Tab Levothyroxine 50 mcg | readers disagree | levothyroxine |
| P21 | clean | Tab Furosemide 40 mg | readers disagree | furosemide |
| P21 | photo | Tab Furosemide 40 mg | readers disagree | furosemide |
| P22 | clean | Syp Paracetamol 125 mg/5 ml | readers disagree | paracetamol |
| P22 | photo | Syp Paracetamol 125 mg/5 ml | readers disagree | paracetamol |
| P22 | clean | Syp Amoxinepa 250 mg/5 ml | readers disagree | (invented brand) |
| P22 | photo | Syp Amoxinepa 250 mg/5 ml | readers disagree | (invented brand) |
| P22 | clean | Syp Salbutamol 2 mg/5 ml | on list: salbutamol | salbutamol |
| P22 | photo | Syp Salbutamol 2 mg/5 ml | on list: salbutamol | salbutamol |
| P22 | clean | Tab Zinc sulfate 20 mg | on list: zinc sulfate | zinc sulfate |
| P22 | photo | Tab Zinc sulfate 20 mg | on list: zinc sulfate | zinc sulfate |
| P22 | clean | ORS | readers disagree | oral rehydration salts |
| P22 | photo | ORS | readers disagree | oral rehydration salts |
| P23 | clean | Tab Losartan 25 mg | on list: losartan | losartan |
| P23 | photo | Tab Losartan 25 mg | on list: losartan | losartan |
| P23 | clean | Tab Furosemide 20 mg | on list: furosemide | furosemide |
| P23 | photo | Tab Furosemide 20 mg | on list: furosemide | furosemide |
| P23 | clean | Tab Prednisolone 5 mg | on list: prednisolone | prednisolone |
| P23 | photo | Tab Prednisolone 5 mg | on list: prednisolone | prednisolone |
| P23 | clean | Tab Amlodipine 2.5 mg | on list: amlodipine | amlodipine |
| P23 | photo | Tab Amlodipine 2.5 mg | on list: amlodipine | amlodipine |
| P23 | clean | Tab Folic acid 5 mg | readers disagree | folic acid |
| P23 | photo | Tab Folic acid 5 mg | on list: folic acid | folic acid |
| P24 | clean | Cap Doxycycline 100 mg | on list: doxycycline | doxycycline |
| P24 | photo | Cap Doxycycline 100 mg | on list: doxycycline | doxycycline |
| P24 | clean | Tab Ibuprofen 400 mg | on list: ibuprofen | ibuprofen |
| P24 | photo | Tab Ibuprofen 400 mg | on list: ibuprofen | ibuprofen |
| P24 | clean | Tab Levocetirizine 5 mg | on list: levocetirizine | levocetirizine |
| P24 | photo | Tab Levocetirizine 5 mg | on list: levocetirizine | levocetirizine |
| P24 | clean | Tab Paracetamol 500 mg | readers disagree | paracetamol |
| P24 | photo | Tab Paracetamol 500 mg | readers disagree | paracetamol |
| P25 | clean | Tab Cefixime 200 mg | readers disagree | cefixime |
| P25 | photo | Tab Cefixime 200 mg | readers disagree | cefixime |
| P25 | clean | Tab Metronidazole 400 mg | on list: metronidazole | metronidazole |
| P25 | photo | Tab Metronidazole 400 mg | readers disagree | metronidazole |
| P25 | clean | Tab Domperidone 10 mg | on list: domperidone | domperidone |
| P25 | photo | Tab Domperidone 10 mg | on list: domperidone | domperidone |
| P25 | clean | Tab Ranitidine 150 mg | on list: ranitidine | ranitidine |
| P25 | photo | Tab Ranitidine 150 mg | readers disagree | ranitidine |
| P26 | clean | TAB ASPIRIN 75 MG | readers disagree | aspirin |
| P26 | photo | TAB ASPIRIN 75 MG | readers disagree | aspirin |
| P26 | clean | TAB AMLODIPINE 5 MG | on list: amlodipine | amlodipine |
| P26 | photo | TAB AMLODIPINE 5 MG | on list: amlodipine | amlodipine |
| P26 | clean | TAB LOSARTAN 50 MG | on list: losartan | losartan |
| P26 | photo | TAB LOSARTAN 50 MG | on list: losartan | losartan |
| P26 | clean | TAB OMEPRAZOLE 20 MG | on list: omeprazole | omeprazole |
| P26 | photo | TAB OMEPRAZOLE 20 MG | on list: omeprazole | omeprazole |
| P27 | clean | Tab Albendazole 400 mg | on list: albendazole | albendazole |
| P27 | photo | Tab Albendazole 400 mg | on list: albendazole | albendazole |
| P27 | clean | Tab Folic acid 5 mg | readers disagree | folic acid |
| P27 | photo | Tab Folic acid 5 mg | readers disagree | folic acid |
| P27 | clean | Cap Omeprazole 20 mg | on list: omeprazole | omeprazole |
| P27 | photo | Cap Omeprazole 20 mg | on list: omeprazole | omeprazole |
| P27 | clean | Tab Metronidazole 400 mg | on list: metronidazole | metronidazole |
| P27 | photo | Tab Metronidazole 400 mg | on list: metronidazole | metronidazole |

## Every field that was not a right tick

| Doc | Version | Field | Answer key | Reader(s) | Status |
|---|---|---|---|---|---|
| P21 | clean | medicine: Tab Amlodipine 5 mg | Tab Amlodipine 5 mg | Tab Amlodipine 5 mg / «not seen» | check |
| P21 | clean | duration: Tab Amlodipine 5 mg | x 1 month | x 1 month / «not seen» | check |
| P21 | clean | medicine: Tab Losartan 50 mg | Tab Losartan 50 mg | Tab Losartan 50 mg / «not seen» | check |
| P21 | clean | dose: Tab Losartan 50 mg | BD | BD / «not seen» | check |
| P21 | clean | duration: Tab Losartan 50 mg | x 1 month | x 1 month / «not seen» | check |
| P21 | clean | medicine: Tab Gliclazide 80 mg | Tab Gliclazide 80 mg | Tab Gliclazide 80 mg / «not seen» | check |
| P21 | clean | dose: Tab Gliclazide 80 mg | 1 tab BD | 1 tab BD / «not seen» | check |
| P21 | clean | duration: Tab Gliclazide 80 mg | continue | continue / «not seen» | check |
| P21 | clean | medicine: Tab Levothyroxine 50 mcg | Tab Levothyroxine 50 mcg | Tab Levothyroxine 50 mcg / «not seen» | check |
| P21 | clean | dose: Tab Levothyroxine 50 mcg | OD empty stomach | OD empty stomach / «not seen» | check |
| P21 | clean | duration: Tab Levothyroxine 50 mcg | x 3 mo | x 3 mo / «not seen» | check |
| P21 | clean | medicine: Tab Furosemide 40 mg | Tab Furosemide 40 mg | Tab Furosemide 40 mg / «not seen» | check |
| P21 | clean | duration: Tab Furosemide 40 mg | till review | till review / «not seen» | check |
| P21 | photo | medicine: Tab Amlodipine 5 mg | Tab Amlodipine 5 mg | Tab Amlodipine 5 mg / «not seen» | check |
| P21 | photo | duration: Tab Amlodipine 5 mg | x 1 month | x 1 month / «not seen» | check |
| P21 | photo | medicine: Tab Losartan 50 mg | Tab Losartan 50 mg | Tab Losartan 50 mg / «not seen» | check |
| P21 | photo | dose: Tab Losartan 50 mg | BD | BD / «not seen» | check |
| P21 | photo | duration: Tab Losartan 50 mg | x 1 month | x 1 month / «not seen» | check |
| P21 | photo | medicine: Tab Gliclazide 80 mg | Tab Gliclazide 80 mg | Tab Gliclazide 80 mg / «not seen» | check |
| P21 | photo | dose: Tab Gliclazide 80 mg | 1 tab BD | 1 tab BD / «not seen» | check |
| P21 | photo | duration: Tab Gliclazide 80 mg | continue | continue / «not seen» | check |
| P21 | photo | medicine: Tab Levothyroxine 50 mcg | Tab Levothyroxine 50 mcg | Tab Levothyroxine 50 mcg / «not seen» | check |
| P21 | photo | dose: Tab Levothyroxine 50 mcg | OD empty stomach | OD empty stomach / «not seen» | check |
| P21 | photo | duration: Tab Levothyroxine 50 mcg | x 3 mo | x 3 mo / «not seen» | check |
| P21 | photo | medicine: Tab Furosemide 40 mg | Tab Furosemide 40 mg | Tab Furosemide 40 mg / «not seen» | check |
| P21 | photo | dose: Tab Furosemide 40 mg | OD mane | OD mane / «not seen» | check |
| P21 | photo | duration: Tab Furosemide 40 mg | till review | till review / «not seen» | check |
| P22 | clean | medicine: Syp Paracetamol 125 mg/5 ml | Syp Paracetamol 125 mg/5 ml | Syp Paracetamol 125 mg/5 ml / «not seen» | check |
| P22 | clean | dose: Syp Paracetamol 125 mg/5 ml | 5 ml TDS | 5 ml TDS / «not seen» | check |
| P22 | clean | duration: Syp Paracetamol 125 mg/5 ml | x 3 days | x 3 days / «not seen» | check |
| P22 | clean | medicine: Syp Amoxinepa 250 mg/5 ml | Syp Amoxinepa 250 mg/5 ml | Syp Amoxinepa 250 mg/5 ml / «not seen» | check |
| P22 | clean | dose: Syp Amoxinepa 250 mg/5 ml | 5 ml BD | 5 ml BD / «not seen» | check |
| P22 | clean | duration: Syp Amoxinepa 250 mg/5 ml | x 5 days | x 5 days / «not seen» | check |
| P22 | clean | dose: Syp Salbutamol 2 mg/5 ml | 2.5 ml TDS | 2.5 ml TDS / «not seen» | check |
| P22 | clean | duration: Syp Salbutamol 2 mg/5 ml | x 3 days | x 3 days / «not seen» | check |
| P22 | clean | dose: Tab Zinc sulfate 20 mg | 1 tab OD | 1 tab OD / «not seen» | check |
| P22 | clean | duration: Tab Zinc sulfate 20 mg | x 10 days | x 10 days / «not seen» | check |
| P22 | clean | medicine: ORS | ORS | ORS / «not seen» | check |
| P22 | clean | dose: ORS | after each loose stool | after each loose stool / «not seen» | check |
| P22 | photo | medicine: Syp Paracetamol 125 mg/5 ml | Syp Paracetamol 125 mg/5 ml | Syp Paracetamol 125 mg/5 ml / «not seen» | check |
| P22 | photo | dose: Syp Paracetamol 125 mg/5 ml | 5 ml TDS | 5 ml TDS / «not seen» | check |
| P22 | photo | duration: Syp Paracetamol 125 mg/5 ml | x 3 days | × 3 days / «not seen» | check |
| P22 | photo | medicine: Syp Amoxinepa 250 mg/5 ml | Syp Amoxinepa 250 mg/5 ml | Syp Amoxinepa 250 mg/5 ml / «not seen» | check |
| P22 | photo | dose: Syp Amoxinepa 250 mg/5 ml | 5 ml BD | 5 ml BD / «not seen» | check |
| P22 | photo | duration: Syp Amoxinepa 250 mg/5 ml | x 5 days | × 5 days / «not seen» | check |
| P22 | photo | dose: Syp Salbutamol 2 mg/5 ml | 2.5 ml TDS | 2.5 ml TDS / «not seen» | check |
| P22 | photo | duration: Syp Salbutamol 2 mg/5 ml | x 3 days | × 3 days / «not seen» | check |
| P22 | photo | dose: Tab Zinc sulfate 20 mg | 1 tab OD | 1 tab OD / «not seen» | check |
| P22 | photo | duration: Tab Zinc sulfate 20 mg | x 10 days | × 10 days / «not seen» | check |
| P22 | photo | medicine: ORS | ORS | ORS / «not seen» | check |
| P22 | photo | dose: ORS | after each loose stool | after each loose stool / «not seen» | check |
| P23 | clean | date | 2083/08/1 | 2083/08/17 / 2083/08/17 | WRONG |
| P23 | clean | dose: Tab Furosemide 20 mg | 1/2-0-0 | 1/2-0-0 / «not seen» | check |
| P23 | clean | duration: Tab Furosemide 20 mg | x 1 days | x 17 days / «not seen» | check |
| P23 | clean | dose: Tab Prednisolone 5 mg | 0.5-0-0.5 | 0.5-0-0.5 / «not seen» | check |
| P23 | clean | duration: Tab Prednisolone 5 mg | x 1 days | x 17 days / «not seen» | check |
| P23 | clean | medicine: Tab Folic acid 5 mg | Tab Folic acid 5 mg | Tab Folic acid 5 mg / «not seen» | check |
| P23 | clean | dose: Tab Folic acid 5 mg | 1-0-0 | 1-0-0 / «not seen» | check |
| P23 | clean | duration: Tab Folic acid 5 mg | x 3 months | x 3 months / «not seen» | check |
| P23 | photo | date | 2083/08/1 | 2083/08/17 / 2083/08/17 | WRONG |
| P23 | photo | duration: Tab Furosemide 20 mg | x 1 days | x 17 days / «not seen» | check |
| P23 | photo | dose: Tab Prednisolone 5 mg | 0.5-0-0.5 | 0.5-0-0.5 / «not seen» | check |
| P23 | photo | duration: Tab Prednisolone 5 mg | x 1 days | x 17 days / «not seen» | check |
| P24 | clean | date | 2083/08/22 | 2083/08/22 / «not seen» | check |
| P24 | clean | duration: Cap Doxycycline 100 mg | x 7 d | x 7 d / «not seen» | check |
| P24 | clean | dose: Tab Ibuprofen 400 mg | 1-1-1 | 1-1-1 / «not seen» | check |
| P24 | clean | medicine: Tab Paracetamol 500 mg | Tab Paracetamol 500 mg | Tab Paracetamol 500 mg / «not seen» | check |
| P24 | clean | dose: Tab Paracetamol 500 mg | 1-1-1 | 1-1-1 / «not seen» | check |
| P24 | clean | duration: Tab Paracetamol 500 mg | x 3 d | x 3 d / «not seen» | check |
| P24 | photo | date | 2083/08/22 | 2083/08/22 / «not seen» | check |
| P24 | photo | duration: Cap Doxycycline 100 mg | x 7 d | x 7 d / «not seen» | check |
| P24 | photo | dose: Tab Ibuprofen 400 mg | 1-1-1 | 1-1-1 / «not seen» | check |
| P24 | photo | medicine: Tab Paracetamol 500 mg | Tab Paracetamol 500 mg | Tab Paracetamol 500 mg / «not seen» | check |
| P24 | photo | dose: Tab Paracetamol 500 mg | 1-1-1 | 1-1-1 / «not seen» | check |
| P24 | photo | duration: Tab Paracetamol 500 mg | x 3 d | x 3 d / «not seen» | check |
| P25 | clean | medicine: Tab Cefixime 200 mg | Tab Cefixime 200 mg | Tab Cefixime 200 mg / «not seen» | check |
| P25 | clean | dose: Tab Cefixime 200 mg | 1-0-1 | 1-0-1 / «not seen» | check |
| P25 | clean | dose: Tab Metronidazole 400 mg | 1-1-1 | 1-1-1 / «not seen» | check |
| P25 | photo | date | 23/11/2026 | 23/11/2026 / «not seen» | check |
| P25 | photo | medicine: Tab Cefixime 200 mg | Tab Cefixime 200 mg | Tab Cefixime 200 mg / «not seen» | check |
| P25 | photo | dose: Tab Cefixime 200 mg | 1-0-1 | 1-0-1 / «not seen» | check |
| P25 | photo | medicine: Tab Metronidazole 400 mg | Tab Metronidazole 400 mg | Tab Metronidazole 400 mg / «not seen» | check |
| P25 | photo | dose: Tab Metronidazole 400 mg | 1-1-1 | 1-1-1 / «not seen» | check |
| P25 | photo | duration: Tab Metronidazole 400 mg | x 5 days | x 5 days / «not seen» | check |
| P25 | photo | dose: Tab Domperidone 10 mg | 1-0-1 | 1-0-1 / «not seen» | check |
| P25 | photo | medicine: Tab Ranitidine 150 mg | Tab Ranitidine 150 mg | Tab Ranitidine 150 mg / «not seen» | check |
| P26 | clean | date | 2083/08/24 | 2083/08/24 / «not seen» | check |
| P26 | clean | medicine: TAB ASPIRIN 75 MG | TAB ASPIRIN 75 MG | TAB ASPIRIN 75 MG / «not seen» | check |
| P26 | clean | duration: TAB AMLODIPINE 5 MG | X 1 MONTH | X 1 MONTH / «not seen» | check |
| P26 | clean | duration: TAB LOSARTAN 50 MG | X 1 MONTH | X 1 MONTH / «not seen» | check |
| P26 | photo | date | 2083/08/24 | 2083/08/14 / «not seen» | check |
| P26 | photo | medicine: TAB ASPIRIN 75 MG | TAB ASPIRIN 75 MG | TAB ASPIRIN 75 MG / «not seen» | check |
| P26 | photo | duration: TAB AMLODIPINE 5 MG | X 1 MONTH | X 1 MONTH / «not seen» | check |
| P26 | photo | duration: TAB LOSARTAN 50 MG | X 1 MONTH | X 1 MONTH / «not seen» | check |
| P27 | clean | date | २०८३ मंसिर ५ | २०८३ मंसिर ६ / «not seen» | check |
| P27 | clean | medicine: Tab Folic acid 5 mg | Tab Folic acid 5 mg | Tab Folic acid 5 mg / «not seen» | check |
| P27 | clean | dose: Tab Metronidazole 400 mg | १-१-१ | १-१-१ / «not seen» | check |
| P27 | photo | medicine: Tab Folic acid 5 mg | Tab Folic acid 5 mg | Tab Folic acid 5 mg / «not seen» | check |
| P27 | photo | dose: Tab Folic acid 5 mg | बिहान १ | बिहान १ / «not seen» | check |
| P27 | photo | duration: Tab Folic acid 5 mg | ३ महिना | ३ महिना / «not seen» | check |
| P27 | photo | dose: Cap Omeprazole 20 mg | खाली पेटमा १ | खाली पेटमा १ / «not seen» | check |
| P27 | photo | dose: Tab Metronidazole 400 mg | १-१-१ | १-१-१ / «not seen» | check |
| L21 | clean | date | 24/11/2026 | 24/11/2026 / «not seen» | check |
| L21 | clean | Specific gravity: value | 1.020 | 1020 / 1020 | WRONG |
| L21 | clean | Pus cells: value | 2-4 | 2-4 / «not seen» | check |
| L21 | clean | RBC: value | Nil | Nil / «not seen» | check |
| L21 | clean | Epithelial cells: value | 6-8 | 6-8 / «not seen» | check |
| L21 | clean | Epithelial cells: flag | H | H / «not seen» | check |
| L21 | photo | Reaction: value | Acidic | Acidic / «not seen» | check |
| L21 | photo | Reaction: range | Acidic | Acidic / «not seen» | check |
| L21 | photo | Specific gravity: value | 1.020 | 1020 / «not seen» | check |
| L21 | photo | Specific gravity: range | 1.005 – 1.030 | 1.005 – 1.030 / «not seen» | check |
| L21 | photo | Protein: value | Trace | Trace / «not seen» | check |
| L21 | photo | Protein: range | Nil | Nil / «not seen» | check |
| L21 | photo | Sugar: value | Nil | Nil / «not seen» | check |
| L21 | photo | Sugar: range | Nil | Nil / «not seen» | check |
| L21 | photo | Pus cells: value | 2-4 | 2-4 / «not seen» | check |
| L21 | photo | Pus cells: unit | /HPF | /HPF / «not seen» | check |
| L21 | photo | Pus cells: range | 0 – 5 | 0 – 5 / «not seen» | check |
| L21 | photo | RBC: value | Nil | Nil / «not seen» | check |
| L21 | photo | RBC: unit | /HPF | /HPF / «not seen» | check |
| L21 | photo | RBC: range | 0 – 2 | 0 – 2 / «not seen» | check |
| L21 | photo | Epithelial cells: value | 6-8 | 6-8 / «not seen» | check |
| L21 | photo | Epithelial cells: unit | /HPF | /HPF / «not seen» | check |
| L21 | photo | Epithelial cells: range | 0 – 5 | 0 – 5 / «not seen» | check |
| L21 | photo | Epithelial cells: flag | H | H / «not seen» | check |
| L22 | clean | date | 25/11/2026 | 25/11/2026 / «not seen» | check |
| L22 | clean | TSH: value | 2.45 | 2.45 / «not seen» | check |
| L22 | clean | Free T4: value | 1.1 | 1.1 / «not seen» | check |
| L22 | clean | Anti-TPO: value | 28 | 28 / «not seen» | check |
| L22 | clean | Vitamin D (25-OH): value | 18.2 | 18.2 / «not seen» | check |
| L22 | clean | Vitamin D (25-OH): flag | L | L / «not seen» | check |
| L22 | photo | date | 25/11/2026 | 25/11/2026 / «not seen» | check |
| L22 | photo | TSH: value | 2.45 | 2.45 / «not seen» | check |
| L22 | photo | Free T4: value | 1.1 | 1.1 / «not seen» | check |
| L22 | photo | Anti-TPO: value | 28 | 28 / «not seen» | check |
| L22 | photo | Vitamin D (25-OH): flag | L | L / «not seen» | check |
| L23 | clean | Total protein: value | 7.1 | 7.1 / «not seen» | check |
| L23 | clean | Albumin: value | 4.2 | 4.2 / «not seen» | check |
| L23 | photo | Total bilirubin: value | 0.8 | 0.8 / «not seen» | check |
| L23 | photo | Total bilirubin: range | 0.2 – 1.2 | 0.2 - 1.2 / «not seen» | check |
