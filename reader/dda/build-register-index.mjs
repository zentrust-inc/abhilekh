// Builds the brand index Abhilekh reads from the DDA register crawl (abhilekh-nepal-drugs/drugs.csv, 25 Nov 2026).
// Decisions (Dr. Shrestha, 25 Nov 2026): exact names only; save the WHO ATC code with each entry; prices, conditions,
// importers and FHIR are not kept. The full crawl stays in the Google shared drive, not in this public repository.
//
//   node reader/dda/build-register-index.mjs path/to/drugs.csv out.json
//
// Cleaning (each counted in the output's "cleaning" block):
//   - veterinary products and junk rows (TESTPRODUCT, names under 3 letters) are left out;
//   - known mis-filed rows are left out: products filed under "10% AMINO ACIDS SOLUTION WITH ELECTROLYTES" that are
//     not amino-acid solutions (found by inspection; other generics were not checked one by one);
//   - strength: the DDA strength column, with the first part of a combination put back ("TELMA 80-AM80/5" -> 80/5);
//     a strength of 0 stays unknown (never read from the product name);
//   - a name whose products disagree on the generic is kept but marked "mixed": the app then says only that the name is
//     on the register, never which medicine it is.
import { readFileSync, writeFileSync } from 'node:fs';
import { namePart } from '../medicine-check.mjs';

function csv(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; } else if (c !== '\r') f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [h, ...rest] = rows;
  return rest.filter(r => r.length === h.length).map(r => Object.fromEntries(h.map((k, i) => [k, r[i]])));
}

const UNITS = { MILLIGRAM: 'mg', MICROGRAM: 'mcg', GRAM: 'g', MILLILITER: 'ml', IU: 'IU', UNIT: 'unit' };
// The registered name is the product name with the strength column glued on, then the unit ("TELMA 80" + "80" + " MILLIGRAM").
// The strength column is kept; for a combination it holds only the last part ("TELMA 80-AM80/5" -> column "5"), so the
// glued "80/" before it is put back -> "80/5". A strength of 0 stays unknown: never read from the product name.
export function strengthOf(row) {
  const s = String(row.strength || '').trim(), unit = String(row.strength_unit || '').trim().toUpperCase();
  if (!s || /^0+(\.0+)?$/.test(s)) return '';
  const reg = String(row.name_registered);
  const i = unit ? reg.lastIndexOf(s + unit) >= 0 ? reg.lastIndexOf(s + unit) : reg.lastIndexOf(s + ' ' + unit) : reg.lastIndexOf(s);
  const pre = i > 0 ? reg.slice(0, i) : '';
  const combo = pre.match(/((?:[\d.]+\/)+)$/);
  return (combo ? combo[1] : '') + s + (unit ? ' ' + (UNITS[unit] || unit.toLowerCase()) : '');
}

// Two spellings of one generic are not a disagreement: salt and water forms, brackets and spacing are set aside only to
// compare; the entry keeps the register's own words.
const SALTS = /\b(ANHYDROUS|MONOHYDRATE|DIHYDRATE|TRIHYDRATE|HYDROCHLORIDE|HCL|HYDROBROMIDE|SODIUM|POTASSIUM|CALCIUM|MAGNESIUM|TROMETHAMINE|TROMETAMOL|MALEATE|BESYLATE|BESILATE|MESYLATE|MESILATE|SUCCINATE|TARTRATE|CITRATE|PHOSPHATE|SULPHATE|SULFATE|ACETATE|FUMARATE|BROMIDE|CHLORIDE|DISODIUM|USP|BP|IP)\b/g;
export const sameGeneric = g => String(g).toUpperCase().replace(/\(.*?\)/g, ' ').replace(SALTS, ' ').replace(/ACYCLOVIR/g, 'ACICLOVIR').replace(/[^A-Z]/g, '');

const MISFILED_GENERIC = '10% AMINO ACIDS SOLUTION WITH ELECTROLYTES';
const GENUINE = /AMINO|CELEMIN|OLICLINOMEL|KABIVEN|AMINOVEN/i;

export function build(rows, version) {
  const cleaning = { rows: rows.length, veterinary: 0, junk: 0, misfiled: 0, strength_reread: 0, strength_unknown: 0 };
  const byKey = new Map();
  for (const r of rows) {
    if (/VETERINARY/i.test(r.system)) { cleaning.veterinary++; continue; }
    if (/TESTPRODUCT/i.test(r.name_registered) || namePart(r.brand).replace(/[^a-z]/g, '').length < 3) { cleaning.junk++; continue; }
    if (r.primary_generic === MISFILED_GENERIC && !GENUINE.test(r.name_registered)) { cleaning.misfiled++; continue; }
    const strength = strengthOf(r);
    if (strength && strength.split(' ')[0] !== String(r.strength)) cleaning.strength_reread++;
    if (!strength) cleaning.strength_unknown++;
    const key = namePart(r.brand);
    const e = { id: r.id, registered: r.name_registered, generics: r.generics.split('|').filter(Boolean), strength, form: r.dosage_form.toLowerCase(),
      manufacturer: r.manufacturer, system: r.system, valid: r.registration_valid === 'yes', inSearch: r.in_dda_search === 'yes', atc: r.atc_codes.split('|').filter(Boolean) };
    (byKey.get(key) || byKey.set(key, []).get(key)).push(e);
  }
  const entries = {};
  let mixed = 0;
  for (const [k, list] of byKey) {
    const sets = new Set(list.map(e => e.generics.map(sameGeneric).sort().join('+')));
    if (sets.size > 1) mixed++;
    entries[k] = { mixed: sets.size > 1, products: list };
  }
  return { version, source: 'DDA Nepal registered-drug search (dams.dda.gov.np/manLogin/publicInfo), crawled 25 Nov 2026; cleaned by build-register-index.mjs', cleaning: { ...cleaning, names: byKey.size, mixed }, entries };
}

if (process.argv[1] && process.argv[1].endsWith('build-register-index.mjs')) {
  const out = build(csv(readFileSync(process.argv[2], 'utf8')), process.argv[4] || '2026-11-25');
  writeFileSync(process.argv[3], JSON.stringify(out));
  console.log(JSON.stringify(out.cleaning));
}
