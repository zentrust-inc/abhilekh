// Check a medicine name, as the reader copied it, against a DDA list.
// Exact matches only: a name is "on the list" when, after removing the dosage form and strength,
// it is exactly a listed medicine (or a listed synonym, or the listed name without its salt).
// No spelling correction and no "closest match": a name that is not exactly there is "not_found",
// shown to the patient as written and flagged. A brand is never turned into a generic here.
import { readFileSync } from 'node:fs';

const FORMS = /\b(tab|tabs|tablet|tablets|t|cap|caps|capsule|capsules|syp|syr|syrup|susp|suspension|inj|injection|drops?|oint|ointment|cream|gel|dispersible|dt|sr|er|xr|od|forte)\b\.?/g;
const SALTS = new Set(['sodium', 'potassium', 'sulfate', 'sulphate', 'hydrochloride', 'hcl', 'carbonate', 'acetate', 'phosphate', 'citrate', 'gluconate', 'bromide', 'chloride', 'fumarate', 'maleate', 'tartrate', 'succinate', 'salt', 'salts']);
// Standard abbreviations only (no brands): written form → listed name.
const ABBREV = { ors: 'oral rehydration salts' };

export function loadList(path) {
  const { entries } = JSON.parse(readFileSync(path, 'utf8'));
  const index = new Map();
  const add = (k, entry) => { k = k.trim(); if (k && !index.has(k)) index.set(k, entry); };
  // Single medicines only: a one-name prescription line must never match a combination product.
  for (const entry of entries.filter((e) => !e.includes(' + '))) {
    for (const part of [entry]) {
      const main = part.replace(/\(.*?\)/g, '').trim();
      add(main, entry);
      for (const m of part.matchAll(/\(([^)]+)\)/g)) add(m[1], entry);           // synonyms in brackets
      const words = main.split(' ');
      if (words.length > 1 && words.slice(1).every((w) => SALTS.has(w))) add(words[0], entry); // "zinc sulfate" → "zinc"
    }
  }
  return index;
}

/** The name part of what was written: "Tab Metformin 500 mg" → "metformin". */
export function namePart(asWritten) {
  return String(asWritten).toLowerCase()
    .replace(/\(.*?\)/g, ' ')                                   // "(250 mg/5 ml)"
    .replace(/\d+([.,]\d+)?\s*(mg|mcg|µg|g|ml|iu|%|units?)?(\/\s*\d*\s*(ml|g))?/g, ' ')
    .replace(FORMS, ' ').replace(/[^a-z\- ]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^-+|-+$/g, '').trim();
}

export function checkMedicine(asWritten, index) {
  const name = namePart(asWritten);
  const key = ABBREV[name] ?? name;
  const entry = index.get(key) ?? null;
  return { as_written: asWritten, name_read: name, status: entry ? 'on_list' : 'not_found', entry };
}
