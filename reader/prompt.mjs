// The one instruction every reader gets. It asks for a copy of the paper, never an opinion about it.
export const PROMPT = `You are copying a Nepali medical document (prescription, OPD ticket or lab report) into JSON.
Copy only what is printed or written on the page. Never interpret, correct, complete or translate anything.

Return one JSON object, nothing else:
{
  "kind": "prescription" | "lab_report" | "other",
  "date_as_printed": string | null,      // exactly as on the page, same digits (keep Devanagari digits as Devanagari)
  "facility": string | null,             // clinic, hospital or lab name as printed
  "clinician": string | null,            // doctor's name as written
  "patient_name": string | null,
  "results": [                           // one per test row on a lab report; [] if none
    { "test": string, "value": string, "unit": string | null, "range": string | null, "flag": string | null }
  ],
  "medicines": [                         // one per medicine line on a prescription; [] if none
    { "as_written": string,              // form, name and strength exactly as written, e.g. "Tab Metformin 500 mg"
      "dose": string | null,             // e.g. "1-0-1", "TDS", "4 ml"
      "duration": string | null }
  ],
  "notes": [string]                      // other printed or written notes, e.g. a critical-value box, advice lines
}

Rules:
- "value", "range" and "flag" are copied exactly as printed (keep commas, en dashes, <, >). "flag" is only a flag the lab printed next to the value (H, L, HH, LL, *); never add one.
- If no range is printed, "range" is null. Never supply a normal range from your own knowledge.
- Medicine names: copy the name as written. Never replace a brand with a generic name or guess what a name means.
- If a character is unclear, give your best reading of the characters only; if a field is unreadable, use null.
- Ignore the "SAMPLE · नमूना" watermark and stamp, and any highlighter marks over the text.
- The page may be photographed sideways or upside down, with a table or other objects around it: read only the paper.`;
