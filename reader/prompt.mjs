// The one instruction every reader gets. It asks for a full copy of the paper, never an opinion about it.
// v2 (25 Nov 2026): after the first 9 real papers. A page can hold several dated visits, hospital stickers, Bikram Sambat
// and AD dates, Nepali instructions, struck-through or highlighted lines, imaging forms with blank cells, lab comment
// paragraphs and reference tables. Everything visible is copied; what cannot be read is marked [Uncertain], never guessed.
// reader/copy.mjs turns this copy into the fields the check screen uses (legacy()) and checks every field against Vision.
export const SCHEMA = 'abhilekh.page.v2';

export const PROMPT = `You are copying one photographed page of a Nepali medical document into JSON: a prescription, an OPD or follow-up note, a lab report, an imaging or echo report, a discharge summary, a patient's notebook or booklet, or anything else.
Copy EVERYTHING that is printed, stamped or written on the paper: every word, number and mark you can see. Never interpret, explain, correct, complete, expand, translate or summarise.

Copy rules:
- Copy exactly as on the page: same spelling, same abbreviations ("DM-2", "c/o", "OD", "HS", "F/U" stay as they are), same digits (Devanagari digits stay Devanagari), same script (Nepali text stays in Devanagari), same punctuation, dashes, arrows (write "->"), "<", ">", "/" and brackets.
- Uncertain handwriting: write [Uncertain] in place of the characters you cannot read with confidence, e.g. "Tab. Sita[Uncertain] XR 50 mg". A field you cannot read at all is "[Uncertain]". Never guess a word, a name, a number or a unit from what it would usually be.
- Never add anything that is not on the paper: no generic names, no normal ranges, no units, no flags, no diagnoses, no calendar conversions, no role for a date that the paper does not label.
- A blank printed box or line stays out. Leave out every key that would be empty or null: an absent key means "not on the paper".
- Ignore a "SAMPLE · नमूना" watermark. Read only the paper, whatever its rotation, and not the table or objects around it. If a second paper is partly visible, copy only the main one and say so in page.notes.

Return one JSON object, nothing else:
{
  "schema": "${SCHEMA}",
  "page": {
    "document_type": "prescription" | "opd_note" | "lab_report" | "imaging_report" | "discharge_summary" | "notebook_page" | "booklet_cover" | "referral" | "bill" | "other",
    "page_number_as_printed": string,              // e.g. "Page 5 of 6"
    "scripts": ["latin" | "devanagari"],
    "handwritten": boolean, "printed": boolean,
    "notes": [string]                              // e.g. "second paper partly visible", "torn corner", "carbon copy"
  },
  "issuer": {                                      // letterhead, sticker, stamp or footer of the hospital, clinic or lab
    "name": string, "unit_or_department": string, "address": string, "phones": [string], "email": string, "website": string,
    "registration_lines": [string],                // e.g. "ISO 15189:2012 Accredited", "PAN No. ...", "Estd. 2014"
    "other_lines": [string]                        // any other printed line of the letterhead or footer, e.g. a printed instruction
  },
  "clinicians": [{                                 // every doctor, pathologist or technician named anywhere on the page
    "name": string, "qualifications": string, "title_as_printed": string, "registration_as_printed": string,   // e.g. "NMC No.: 3948"
    "where": "letterhead" | "stamp" | "sticker" | "handwritten" | "signature_block" | "referred_by",
    "signed": boolean
  }],
  "patient_as_written": {                          // only what the paper itself says about the patient
    "name": string, "name_variants": [string],     // a different spelling elsewhere on the page goes in name_variants
    "age_as_written": string, "sex_as_written": string, "date_of_birth_as_written": string,   // DOB only when the paper labels it so
    "address": string, "phones": [string], "weight_as_written": string, "height_as_written": string,
    "ids": [{ "label_as_printed": string, "value": string }],   // Hosp. No., Visit No., IP No., Queue No., Room No., Lab ID ...
    "other_lines": [string]                        // e.g. family or contact notes written on the page, exactly as written
  },
  "dates": [{                                      // EVERY date or time on the page, in reading order
    "as_written": string,                          // exactly, e.g. "2-5-023", "19-1-080", "2080/08/21 BS", "30/Oct/2023 09:27AM"
    "label_as_printed": string,                    // the word beside it, if any: "Date:", "Collected", "Reported", "F/U", "BS"
    "near": string                                 // the first words of the line or block it heads or belongs to
  }],
  "encounters": [{                                 // a visit or dated entry; a page with several dated entries has several
    "date_as_written": string,                     // the date heading this entry, copied again exactly as in "dates"
    "visit_label_as_written": string,              // e.g. "F/U", "Follow Up[4]", "FOLLOWUP", "New"
    "complaints_as_written": [string],             // e.g. "c/o ↑ blood pressure"
    "history_as_written": [string],                // each listed item as written, e.g. "HTN", "DM-2", "CAD, post PTCA (2020)"
    "diagnosis_or_impression_as_written": [string],// only lines the paper itself gives as diagnosis, impression or Dx
    "examination": [{ "label_as_written": string, "value_as_written": string, "unit_as_written": string, "qualifier_as_written": string }],
                                                   // e.g. {"label_as_written":"BP","value_as_written":"120/60","unit_as_written":"mmHg","qualifier_as_written":"Rt"}
    "results_in_note": [{ "test_as_written": string, "value_as_written": string, "unit_as_written": string }],
                                                   // results written by hand inside the note, e.g. FBS 288 mg/dl; "RFT- 48/1.3/133/4.4" stays one value
    "medicines": [{
      "number_as_written": string,                 // "1)", "(३)", "④"
      "form_as_written": string,                   // "Tab", "T.", "Cap", "Inj", "Syp"
      "name_as_written": string,                   // brand or name exactly as written
      "name_in_brackets_as_written": string,       // a second name the writer put in brackets, e.g. "(Prednisolone)"
      "strength_as_written": string,
      "dose_as_written": string,                   // the dose characters exactly: "1-0-1", "1-x-1", "— 0 — 0 —", "50 -> 34 -> 24", "26U / 18U"
      "frequency_as_written": string,              // "OD", "BD", "HS", "SOS", "once a wk"
      "timing_as_written": string,                 // e.g. "before bed", "बिहान खाना अघि" (Devanagari stays Devanagari)
      "route_as_written": string,
      "duration_as_written": string,               // "x 4m", "20 days", "– 15 dy"
      "quantity_as_written": string,
      "schedule_change_as_written": string,        // e.g. "once a wk x 8 wks then once a month x 6 mo"
      "marks": ["struck_through" | "highlighted" | "circled" | "underlined" | "ticked" | "added_later" | "boxed" | "different_ink"],
      "line_as_written": string                    // the whole medicine line as one string, exactly as written
    }],
    "investigations_advised_as_written": [string], // tests asked for, e.g. "FBS/PP/HbA1c", "Lipid profile", "ECG + Echo"
    "advice_as_written": [string],                 // every other advice line, exactly as written
    "follow_up_as_written": string,                // e.g. "F/U 10 days", "Review c reports after 1 month"
    "referral_as_written": string,
    "signed": boolean
  }],
  "lab": {                                         // a printed lab report
    "report_status_as_printed": string, "referred_by_as_printed": string, "sample_from_as_printed": string,
    "sections": [{
      "heading_as_printed": string,                // "DEPARTMENT OF BIOCHEMISTRY", "HBA1C", "LIPID PROFILE"
      "sample_type_as_printed": string,
      "rows": [{ "test_as_printed": string, "method_as_printed": string, "result_as_printed": string, "unit_as_printed": string,
                 "reference_range_as_printed": string,   // exactly, including "See Below"; leave out when no range is printed
                 "status_or_flag_as_printed": string,    // only what the lab printed: "N", "H", "L", "*"; never add one
                 "notes_as_printed": [string] }],
      "reference_table_as_printed": [[string]],    // a printed table of ranges or categories, row by row, cell by cell
      "comments_as_printed": [string]              // every printed paragraph or note under the section, word for word
    }],
    "legend_as_printed": [string]                  // e.g. "Abbreviations Meaning : N-Normal, H- High, L-Low", "*Under scope of Accreditation"
  },
  "imaging": {                                     // echo, Doppler, X-ray, USG, ECG and other report forms
    "modality_as_printed": string,
    "measurements": [{ "section_as_printed": string, "parameter_as_printed": string, "value_as_written": string, "unit_as_printed": string }],
                                                   // only cells that hold a value; blank cells stay out
    "findings_as_written": [string],               // e.g. "Others: TDI e' lateral 5.3cm/s"
    "impression_as_written": [string]              // e.g. the lines after "Final Impression:"
  },
  "marks": [{                                      // every mark that is not text
    "kind": "highlight" | "circle" | "strike_through" | "underline" | "box" | "arrow" | "tick" | "cross" | "stamp" | "signature" | "qr_code" | "barcode" | "logo" | "different_ink" | "other",
    "on_or_near": string                           // the words it covers, circles or points to, as written
  }],
  "other_text": [string],                          // every remaining word or line on the paper not copied above, in reading order
  "unreadable": [{ "where": string, "note": string }]   // parts you could not read at all, e.g. {"where":"right margin, middle","note":"two words in blue ink"}
}`;
