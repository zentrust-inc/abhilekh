// Prompt v2: the full copy of a page, the check-screen fields taken from it, and every field checked against Vision.
// SAMPLE page only (invented): it has the patterns seen on real papers (two dated visits on one page, a Bikram Sambat date,
// a struck-through medicine, [Uncertain] handwriting, a lab row with "See Below", an echo form with blank cells).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legacy, checkCopy, SCHEMA } from '../copy.mjs';
import { PROMPT } from '../prompt.mjs';

const PAGE = {
  schema: SCHEMA,
  page: { document_type: 'opd_note', scripts: ['latin', 'devanagari'], handwritten: true, printed: true },
  issuer: { name: 'Namuna Clinic (SAMPLE)', phones: ['01-0000000'] },
  clinicians: [{ name: 'Dr. Sample Doctor', registration_as_printed: 'NMC No.: 0000', where: 'letterhead', signed: true },
    { name: 'Dr. SELF', where: 'referred_by' }],
  patient_as_written: { name: 'Aama Sample', name_variants: ['Ama Sampel'], age_as_written: '68 Y/F', ids: [{ label_as_printed: 'Hosp. No.', value: '000123' }] },
  dates: [{ as_written: '2-5-023', label_as_printed: 'Date:' }, { as_written: '19-1-080' }, { as_written: '3-5-023', near: 'FBS' }],
  encounters: [
    { date_as_written: '2-5-023', visit_label_as_written: 'F/U', history_as_written: ['HTN', 'DM-2'],
      examination: [{ label_as_written: 'BP', value_as_written: '120/60', unit_as_written: 'mmHg', qualifier_as_written: 'Rt' }],
      results_in_note: [{ test_as_written: 'FBS', value_as_written: '288', unit_as_written: 'mg/dl' }],
      medicines: [
        { number_as_written: '1)', form_as_written: 'Tab', name_as_written: 'Namunapril', strength_as_written: '5 mg', frequency_as_written: 'OD', line_as_written: '1) Tab Namunapril 5 mg OD' },
        { number_as_written: '2)', form_as_written: 'Tab', name_as_written: 'Strikol', strength_as_written: '10 mg', dose_as_written: '1-x-1', marks: ['struck_through'] },
        { number_as_written: '3)', form_as_written: 'Syp', name_as_written: 'Sita[Uncertain]', dose_as_written: '[Uncertain]', duration_as_written: '30 days' }],
      investigations_advised_as_written: ['FBS/PP/HbA1c'], follow_up_as_written: 'F/U 10 days', signed: true },
    { date_as_written: 'Sep 2023', medicines: [{ form_as_written: 'T.', name_as_written: 'Samplecard', timing_as_written: 'बिहान खाना अघि', duration_as_written: '4m' }] }],
  lab: { sections: [{ heading_as_printed: 'HBA1C', rows: [{ test_as_printed: 'HBA1C RESULT', result_as_printed: '5.9', unit_as_printed: '%', reference_range_as_printed: 'See Below' }],
    reference_table_as_printed: [['>6.5 %', 'Diabetes'], ['<5.7 %', 'Normal']], comments_as_printed: ['Printed comment of the lab (SAMPLE).'] }] },
  imaging: { measurements: [{ section_as_printed: 'Aortic Valve', parameter_as_printed: 'Max.Velocity', value_as_written: '121', unit_as_printed: 'cms/sec' },
    { section_as_printed: 'Aortic Valve', parameter_as_printed: 'Max PG', value_as_written: '' }], impression_as_written: ['Mild MR (SAMPLE)'] },
  marks: [{ kind: 'highlight', on_or_near: 'Namunapril' }, { kind: 'strike_through', on_or_near: 'Strikol' }],
  other_text: ['कृपया यो किताब लिएर आउनु होला'],
};

test('the prompt asks for everything visible and for [Uncertain], never a guess', () => {
  for (const s of ['EVERYTHING', '[Uncertain]', 'Never guess', 'struck_through', 'no calendar conversions', 'other_text']) assert.ok(PROMPT.includes(s), s);
  assert.ok(PROMPT.includes(SCHEMA));
});

test('check-screen fields come from the full copy without changing a character', () => {
  const L = legacy(PAGE);
  assert.equal(L.kind, 'prescription');
  assert.equal(L.date_as_printed, '2-5-023');                 // the first visit's date, exactly as written; no conversion
  assert.equal(L.facility, 'Namuna Clinic (SAMPLE)');
  assert.equal(L.clinician, 'Dr. Sample Doctor');             // not the "referred by" line
  assert.deepEqual(L.medicines.map(m => m.as_written), ['Tab Namunapril 5 mg', 'Syp Sita[Uncertain]', 'T. Samplecard']); // struck line left out
  assert.equal(L.medicines[0].dose, 'OD');                     // no dose written: the frequency as written
  assert.equal(L.medicines[1].dose, '[Uncertain]');
  assert.deepEqual(L.results.map(r => [r.test, r.value, r.range]), [['HBA1C RESULT', '5.9', 'See Below'], ['FBS', '288', null], ['Max.Velocity', '121', null]]); // blank cell left out
});

test('an older copy passes through unchanged', () => {
  const old = { kind: 'lab_report', date_as_printed: '2083-08-09', results: [], medicines: [] };
  assert.equal(legacy(old), old);
  assert.equal(checkCopy(old, []), null);
});

test('every field of the full copy is checked against Vision: agreed, one reader, or uncertain', () => {
  const lines = ['Namuna Clinic (SAMPLE)', 'Date: 2-5-023  19-1-080', 'HTN  DM-2  BP 120/60 Rt', '1) Tab Namunapril 5 mg OD', 'Syp Sita 30 days', 'FBS 288 mg/dl'];
  const c = checkCopy(PAGE, lines);
  assert.equal(c.data, PAGE);                                   // the copy itself is kept as it is
  assert.equal(c.states['issuer.name'], 'agreed');
  assert.equal(c.states['dates.1.as_written'], 'agreed');
  assert.equal(c.states['encounters.0.medicines.2.name_as_written'], 'uncertain');
  assert.equal(c.states['patient_as_written.name'], 'one_reader');   // not in Vision's lines: Unresolved, never guessed
  assert.equal(c.states['page.document_type'], undefined);           // the reader's own labels are not copies of the paper
  assert.equal(c.states['encounters.0.signed'], undefined);
  assert.equal(c.summary.fields, c.summary.agreed + c.summary.one_reader + c.summary.uncertain);
  const noVision = checkCopy(PAGE, null);
  assert.equal(noVision.summary.agreed, 0);                     // Vision failed: nothing can be agreed
});
