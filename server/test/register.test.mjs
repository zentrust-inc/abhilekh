// The DDA register (brand index): exact names only, never a near name; Unresolved -> confirm only on an exact copy.
// Invented SAMPLE brands only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRegister, applyRegister } from '../register.mjs';
import { namePart } from '../../reader/medicine-check.mjs';
import { build, strengthOf, sameGeneric } from '../../reader/dda/build-register-index.mjs';

const row = (o) => ({ id: o.id || 'x', brand: o.brand, name_registered: o.reg, strength: o.s ?? '', strength_unit: o.u ?? 'MILLIGRAM', dosage_form: 'TABLET', system: o.system || 'ALLOPATHY - HUMAN',
  generics: o.g, primary_generic: o.g.split('|')[0], manufacturer: 'Namuna Pharma (SAMPLE)', registration_valid: o.valid ?? 'yes', in_dda_search: 'yes', atc_codes: o.atc || '' });
const ROWS = [
  row({ id: 'a1', brand: 'NAMUTEL', reg: 'NAMUTEL 4040 MILLIGRAM IP', s: '40', g: 'TELMISARTAN', atc: 'C09CA07' }),
  row({ id: 'a2', brand: 'NAMUTEL', reg: 'NAMUTEL 8080 MILLIGRAM IP', s: '80', g: 'TELMISARTAN', atc: 'C09CA07' }),
  row({ id: 'a3', brand: 'NAMUTEL-AM', reg: 'NAMUTEL-AM80/5 MILLIGRAM IP', s: '5', g: 'TELMISARTAN|AMLODIPINE' }),
  row({ id: 'a4', brand: 'MIXO', reg: 'MIXO 500500 MILLIGRAM IP', s: '500', g: 'METFORMIN HYDROCHLORIDE' }),
  row({ id: 'a5', brand: 'MIXO', reg: 'MIXO 500/2 MILLIGRAM IP', s: '2', g: 'METFORMIN HYDROCHLORIDE|GLIMEPIRIDE' }),
  row({ id: 'a6', brand: 'ASIMETX', reg: 'ASIMETX-25 XR0 MILLIGRAM USP', s: '25', g: '10% AMINO ACIDS SOLUTION WITH ELECTROLYTES' }),
  row({ id: 'a7', brand: 'VETO', reg: 'VETO 10 MILLIGRAM', s: '10', g: 'IVERMECTIN', system: 'ALLOPATHY - VETERINARY' }),
  row({ id: 'a8', brand: 'TESTPRODUCT11', reg: 'TESTPRODUCT11 1 MILLIGRAM', s: '1', g: 'X' }),
  row({ id: 'a9', brand: 'ACICLO', reg: 'ACICLO 400400 MILLIGRAM', s: '400', g: 'ACYCLOVIR' }),
  row({ id: 'b1', brand: 'ACICLO', reg: 'ACICLO 200200 MILLIGRAM', s: '200', g: 'ACICLOVIR' }),
];

test('the index: strength from the register column (combinations rebuilt), junk and mis-filed rows out, spellings not a conflict', () => {
  assert.equal(strengthOf(ROWS[0]), '40 mg');
  assert.equal(strengthOf(ROWS[2]), '80/5 mg');
  assert.equal(strengthOf({ strength: '0', strength_unit: 'MILLIGRAM', name_registered: 'ATOR 20 TABLETS0 MILLIGRAM' }), ''); // 0 stays unknown
  const I = build(ROWS, '2026-11-25');
  assert.deepEqual([I.cleaning.veterinary, I.cleaning.junk, I.cleaning.misfiled], [1, 1, 1]);
  assert.equal(I.entries.namutel.products.length, 2);
  assert.equal(I.entries.namutel.mixed, false);
  assert.equal(I.entries.mixo.mixed, true);                  // one name, two medicines
  assert.equal(I.entries.aciclo.mixed, false);               // ACYCLOVIR = ACICLOVIR
  assert.equal(sameGeneric('METFORMIN HYDROCHLORIDE'), sameGeneric('Metformin'));
});

test('lookup: exact name only; strength picks the product; never a near name', () => {
  const R = createRegister({ index: build(ROWS, '2026-11-25'), namePart });
  const t = R.lookup('T. Namutel 40mg');
  assert.equal(t.products.length, 1);
  assert.equal(t.products[0].strength, '40 mg');
  assert.deepEqual(t.products[0].atc, ['C09CA07']);           // the WHO ATC code is kept
  assert.equal(t.strengthMatched, true);
  assert.equal(R.lookup('Tab Namutel').products.length, 2);    // no strength written: all products of that name
  assert.equal(R.lookup('Namutal 40'), null);                  // one letter off: not found, never corrected
  assert.equal(R.lookup('Namutel-AM').products[0].strength, '80/5 mg');
  assert.equal(R.lookup('Mixo 500').mixed, true);
});

test('reading: agreed line gets its entry; an Unresolved copy on the register moves to confirm; agreed-but-missing names are listed without patient details', () => {
  const R = createRegister({ index: build(ROWS, '2026-11-25'), namePart });
  const F = (text, state, a) => state === 'unresolved' ? { text: '', state, a } : { text, state };
  const reading = { date: { state: 'confirm' }, facility: { state: 'empty' }, clinician: { state: 'empty' }, results: [],
    medicines: [
      { as_written: F('T. Namutel 40mg', 'agreed'), dose: { state: 'empty' }, duration: { state: 'empty' }, dda: 'not_found' },
      { as_written: F('', 'unresolved', 'Namutel-AM'), dose: { state: 'empty' }, duration: { state: 'empty' }, dda: 'not_found' },
      { as_written: F('', 'unresolved', 'Namutal 40'), dose: { state: 'empty' }, duration: { state: 'empty' }, dda: 'not_found' },
      { as_written: F('Tab Zorbo 10', 'agreed'), dose: { state: 'empty' }, duration: { state: 'empty' }, dda: 'not_found' }] };
  const missing = {};
  applyRegister(reading, R, missing);
  const [a, b, c, d] = reading.medicines;
  assert.equal(a.dda, 'on_register'); assert.equal(a.as_written.state, 'agreed');
  assert.equal(b.as_written.state, 'confirm'); assert.equal(b.as_written.text, 'Namutel-AM'); assert.equal(b.as_written.byRegister, true);
  assert.equal(c.as_written.state, 'unresolved'); assert.equal(c.register, null);  // near name: stays Unresolved
  assert.equal(d.register, null);
  assert.deepEqual(Object.keys(missing), ['zorbo']);                                 // the name only
  assert.equal(missing.zorbo.seen, 1);
  assert.equal(reading.summary.confirm, 2);                                          // date + the register-confirmed line
});
