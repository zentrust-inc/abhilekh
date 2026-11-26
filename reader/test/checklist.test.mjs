// Checklist and gate (spec v1.0). SAMPLE pages only (invented).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expand, gate, coverage, groupOf, needsOwnTap, RULES } from '../checklist.mjs';
import { SCHEMA } from '../copy.mjs';

const RX = {
  schema: SCHEMA,
  page: { document_type: 'prescription' },
  issuer: { name: 'Namuna Clinic (SAMPLE)' },
  clinicians: [{ name: 'Dr. Sample Doctor', registration_as_printed: 'NMC No.: 0000' }],
  patient_as_written: { name: 'Aama Sample' },
  dates: [{ as_written: '2-5-023', label_as_printed: 'Date:' }],
  encounters: [{ date_as_written: '2-5-023', medicines: [
    { name_as_written: 'Namunapril', dose_as_written: '1-0-1', frequency_as_written: 'OD', duration_as_written: '30 days' },
    { name_as_written: 'Samplecard', frequency_as_written: 'BD' }] }],
};

const LAB = {
  schema: SCHEMA,
  page: { document_type: 'lab_report' },
  issuer: { name: 'Namuna Lab (SAMPLE)' },
  clinicians: [],
  dates: [{ as_written: '2083/08/08', label_as_printed: 'Collected' }, { as_written: '2083/08/09', label_as_printed: 'Reported' }],
  lab: { sections: [{ rows: [{ test_as_printed: 'HBA1C', result_as_printed: '5.9', unit_as_printed: '%' }] }] },
};

const allStates = (copy, state = 'verified') => Object.fromEntries(expand(copy).required.map(r => [r.path, state]));
const allCounts = copy => Object.fromEntries(expand(copy).groups.map(g => [g.group, g.rows]));
const full = copy => ({ states: allStates(copy), counts: allCounts(copy), person_confirmed: true, type_confirmed: true });

test('paper types map to rule groups; unknown types fall to "other"', () => {
  assert.equal(groupOf('opd_note'), 'prescription');
  assert.equal(groupOf('discharge_summary'), 'discharge');
  assert.equal(groupOf('something_new'), 'other');
  assert.equal(RULES.version, '1.0');
});

test('required paths come from the rules, so a field the reader missed still appears', () => {
  const paths = expand(RX).required.map(r => r.path);
  // medicine 1 has no dose and no duration on the copy: they are still required (each_row)
  assert.ok(paths.includes('encounters.0.medicines.1.dose_as_written'));
  assert.ok(paths.includes('encounters.0.medicines.1.duration_as_written'));
  const missed = expand(RX).required.find(r => r.path === 'encounters.0.medicines.1.dose_as_written');
  assert.equal(missed.present, false);
  // if_present fields that are absent are not required
  assert.ok(!paths.includes('encounters.0.follow_up_as_written'));
  // paths use the same 0-based keys as checkCopy()
  assert.ok(paths.includes('encounters.0.medicines.0.name_as_written'));
});

test('a fully confirmed paper passes the gate', () => {
  const g = gate(RX, full(RX));
  assert.deepEqual(g.blocking, []);
  assert.equal(g.ok, true);
});

test('a missed field blocks until the patient says it is not on the paper', () => {
  const d = full(RX);
  delete d.states['encounters.0.medicines.1.dose_as_written'];
  const g = gate(RX, d);
  assert.equal(g.ok, false);
  assert.deepEqual(g.blocking.map(b => b.path), ['encounters.0.medicines.1.dose_as_written']);
  assert.match(g.blocking[0].why, /not read/);
  d.states['encounters.0.medicines.1.dose_as_written'] = 'absent';
  assert.equal(gate(RX, d).ok, true);
});

test('person and paper type must be confirmed by a person', () => {
  const g = gate(RX, { ...full(RX), person_confirmed: false, type_confirmed: false });
  assert.deepEqual(g.blocking.map(b => b.path).sort(), ['page.document_type', 'person.match']);
});

test('row counts: unconfirmed or disagreeing counts block', () => {
  const d = full(RX);
  delete d.counts['encounters.0.medicines'];
  assert.ok(gate(RX, d).blocking.some(b => b.path === 'count:encounters.0.medicines'));
  d.counts['encounters.0.medicines'] = 3;                       // patient sees 3 medicines, copy has 2
  const b = gate(RX, d).blocking.find(x => x.path === 'count:encounters.0.medicines');
  assert.match(b.why, /patient says 3, copy has 2/);
});

test('a lab with no named doctor: count 0 is confirmed, not assumed', () => {
  const d = full(LAB);
  assert.equal(d.counts.clinicians, 0);
  assert.equal(gate(LAB, d).ok, true);
  delete d.counts.clinicians;
  assert.ok(gate(LAB, d).blocking.some(b => b.path === 'count:clinicians'));
});

test('lab rows: unit, range and flag are required on every row, even when not printed', () => {
  const paths = expand(LAB).required.map(r => r.path);
  for (const f of ['unit_as_printed', 'reference_range_as_printed', 'status_or_flag_as_printed'])
    assert.ok(paths.includes(`lab.sections.0.rows.0.${f}`), f);
});

test('min_rows: a lab report with no rows read must have its zero confirmed', () => {
  const empty = { ...LAB, lab: { sections: [{ rows: [] }] } };
  const b = gate(empty, { person_confirmed: true, type_confirmed: true }).blocking.find(x => x.path === 'count:lab.sections.0.rows');
  assert.match(b.why, /expected at least 1/);
});

test('coverage: a Vision line that is nowhere in the copy blocks', () => {
  const lines = ['Namuna Clinic (SAMPLE)', 'Namunapril 1-0-1 OD', 'Review after 2 weeks'];
  assert.deepEqual(coverage(RX, ['Tab Namunapril']), [0]);     // a missed word (the form "Tab") is caught
  assert.deepEqual(coverage(RX, lines), [2]);
  const g = gate(RX, full(RX), lines);
  assert.deepEqual(g.blocking.map(b => b.path), ['coverage:2']);
  assert.deepEqual(coverage(RX, ['---', '*']), []);             // punctuation-only lines are ignored
});

test('dates and decimals always need their own tap', () => {
  assert.equal(needsOwnTap('dates.0.as_written', '2-5-023'), true);
  assert.equal(needsOwnTap('encounters.0.date_as_written', '2-5-023'), true);
  assert.equal(needsOwnTap('lab.sections.0.rows.0.result_as_printed', '5.9'), true);
  assert.equal(needsOwnTap('lab.sections.0.rows.0.result_as_printed', '288'), false);
  assert.equal(needsOwnTap('encounters.0.medicines.0.name_as_written', 'Namunapril'), false);
});
