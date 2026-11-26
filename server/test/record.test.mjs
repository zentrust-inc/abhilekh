// Record model v1.0 (record.mjs) on a SAMPLE page (invented). No server, no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRecordModel, UNRESOLVED } from '../record.mjs';
import { expand, gate, needsOwnTap } from '../../reader/checklist.mjs';
import { checkCopy, SCHEMA } from '../../reader/copy.mjs';
import { loose } from '../../reader/normalise.mjs';

const PAGE = {
  schema: SCHEMA,
  page: { document_type: 'prescription' },
  issuer: { name: 'Namuna Clinic (SAMPLE)' },
  clinicians: [{ name: 'Dr. Sample Doctor' }],
  dates: [{ as_written: '2-5-023', label_as_printed: 'Date:' }],
  encounters: [{ date_as_written: '2-5-023', medicines: [
    { name_as_written: 'Namunapril', dose_as_written: '1-0-1', frequency_as_written: 'OD', duration_as_written: '30 days' },
    { name_as_written: 'Samplecard', frequency_as_written: 'BD' }] }],
};
const LINES = ['Namuna Clinic (SAMPLE)', 'Dr. Sample Doctor', 'Date: 2-5-023', 'Namunapril 1-0-1 OD 30 days', 'Samplecard'];

let t0 = Date.parse('2026-11-26T09:00:00Z');
const M = createRecordModel({ expand, gate, needsOwnTap, loose, now: () => (t0 += 1000) });
const paper = (data = PAGE, lines = LINES) => ({ id: 'p1', status: 'ready', reading: { at: '2026-11-26T08:00:00Z', vision_lines: lines, copy: checkCopy(data, lines) } });
const ME = { kind: 'patient', person: 'u1' };

// Everything a patient would do on this SAMPLE page.
function finish(p) {
  const evs = [{ path: 'person.match', action: 'confirmed' }, { path: 'page.document_type', action: 'confirmed' }];
  for (const r of expand(M.typedCopy(p)).required) {
    if (r.requirement === 'system') continue;
    const f = M.consensus(p).find(x => x.path === r.path);
    evs.push(f?.agreement === 'agreed' ? { path: r.path, action: 'confirmed' } : f ? { path: r.path, action: 'corrected', value: String(f.value) } : { path: r.path, action: 'marked_absent_on_paper' });
  }
  for (const g of expand(M.typedCopy(p)).groups) evs.push({ path: 'count:' + g.group, action: 'count_confirmed', value: g.rows });
  return M.append(p, evs, ME);
}

test('consensus: only an agreed value is pre-filled; dates need their own tap', () => {
  const p = paper(PAGE, LINES.filter(l => !l.startsWith('Samplecard')));
  const c = Object.fromEntries(M.consensus(p).map(f => [f.path, f]));
  assert.equal(c['encounters.0.medicines.0.name_as_written'].prefill, 'Namunapril');
  assert.equal(c['encounters.0.medicines.1.name_as_written'].agreement, 'one_reader');
  assert.equal(c['encounters.0.medicines.1.name_as_written'].prefill, null);
  assert.equal(c['dates.0.as_written'].needs_own_tap, true);
});

test('a fresh paper is blocked; a fully worked paper passes and gives items', () => {
  const p = paper();
  assert.equal(M.gateOf(p).ok, false);
  assert.equal(M.itemsOf(p), null);
  finish(p);
  const g = M.gateOf(p);
  assert.deepEqual(g.blocking, []);
  const items = M.itemsOf(p);
  const meds = items.filter(i => i.kind === 'medicine');
  assert.deepEqual(meds.map(m => m.name_as_written), ['Namunapril', 'Samplecard']);
  assert.equal(meds[1].dose_as_written, null);                 // "not on the paper": null, never invented
  assert.deepEqual(items.find(i => i.kind === 'date'), { kind: 'date', paths: ['dates.0'], printed_text: '2-5-023', label_as_printed: 'Date:' });
});

test('the log is append-only and ordered; the last decision wins', () => {
  const p = paper(); finish(p);
  const n = p.log.length;
  M.append(p, { path: 'encounters.0.medicines.0.dose_as_written', action: 'corrected', value: '1-0-0' }, ME);
  assert.equal(p.log.length, n + 1);
  assert.deepEqual(p.log.map(e => e.seq), p.log.map((_, i) => i + 1));
  assert.equal(M.current(p)['encounters.0.medicines.0.dose_as_written'].current, '1-0-0');
  assert.equal(M.itemsOf(p).find(i => i.kind === 'medicine').dose_as_written, '1-0-0'); // a correction reaches the items
  M.append(p, { path: 'encounters.0.medicines.0.dose_as_written', action: 'marked_unreadable' }, ME);
  assert.equal(M.itemsOf(p).find(i => i.kind === 'medicine').dose_as_written, UNRESOLVED);
});

test('rules enforced on every decision', () => {
  const p = paper(PAGE, LINES.filter(l => !l.startsWith('Samplecard')));
  const no = (ev, actor, re) => assert.throws(() => M.append(p, ev, actor), re);
  no({ path: 'encounters.0.medicines.1.name_as_written', action: 'confirmed' }, ME, /both readers agree/);
  no({ path: 'dates.0.as_written', action: 'confirmed', bulk: true }, ME, /own tick/);
  no({ path: 'encounters.0.medicines.0.name_as_written', action: 'corrected', value: '  ' }, ME, /Type the value/);
  no({ path: 'encounters.0.medicines.0.name_as_written', action: 'confirmed' }, { kind: 'clinician' }, /must be named/);
  no({ path: 'encounters.0.medicines.0.name_as_written', action: 'confirmed' }, { kind: 'system' }, /only reopen/);
  no({ path: 'nothing.here', action: 'confirmed' }, ME, /No such field/);
  no({ path: 'count:encounters.0.medicines', action: 'count_confirmed', value: -1 }, ME, /number of rows/);
  no({ path: 'page.document_type', action: 'corrected', value: 'horoscope' }, ME, /known type/);
  // atomic: one bad event, nothing added
  no([{ path: 'person.match', action: 'confirmed' }, { path: 'nothing.here', action: 'confirmed' }], ME, /No such field/);
  assert.equal((p.log || []).length, 0);
  // a named clinician may confirm
  assert.equal(M.append(p, { path: 'encounters.0.medicines.0.name_as_written', action: 'confirmed' }, { kind: 'clinician', name: 'Dr. Sample' }).length, 1);
});

test('a missed required field blocks until marked not on the paper', () => {
  const p = paper(); finish(p);
  M.append(p, { path: 'encounters.0.medicines.1.duration_as_written', action: 'reopened' }, { kind: 'system' });
  assert.deepEqual(M.gateOf(p).blocking.map(b => b.path), ['encounters.0.medicines.1.duration_as_written']);
});

test('the patient\'s paper-type correction changes the checklist', () => {
  const p = paper(); finish(p);
  M.append(p, { path: 'page.document_type', action: 'corrected', value: 'lab_report' }, ME);
  const b = M.gateOf(p).blocking.map(x => x.path);
  assert.ok(b.includes('count:lab.sections'), b.join());          // lab rules now apply
});

test('coverage: a Vision line missing from the copy blocks until kept as text or ruled out', () => {
  const p = paper(PAGE, [...LINES, 'Review after two weeks']);
  finish(p);
  assert.deepEqual(M.gateOf(p).blocking.map(b => b.path), ['coverage:5']);
  M.append(p, { path: 'coverage:5', action: 'assigned_text_block' }, ME);
  assert.equal(M.gateOf(p).ok, true);
  assert.equal(M.itemsOf(p).find(i => i.paths[0] === 'coverage:5').text_as_written, 'Review after two weeks');
});

test('a paper read before Vision lines were kept needs coverage confirmed by a person', () => {
  const p = paper(); delete p.reading.vision_lines; finish(p);
  assert.deepEqual(M.gateOf(p).blocking.map(b => b.path), ['coverage:all']);
  M.append(p, { path: 'coverage:all', action: 'not_text_confirmed' }, ME);
  assert.equal(M.gateOf(p).ok, true);
});

test('re-read: unchanged decisions stand, changed ones are reopened by the system', () => {
  const p = paper(); finish(p);
  const old = p.reading.copy;
  const next = structuredClone(PAGE); next.encounters[0].medicines[0].dose_as_written = '1-1-1';
  const lines2 = LINES.map(l => l.replace('1-0-1', '1-1-1'));
  p.reading = { at: '2026-11-27T08:00:00Z', vision_lines: lines2, copy: checkCopy(next, lines2) };
  const r = M.reconcile(p, old);
  assert.deepEqual(r.map(e => [e.path, e.action, e.actor.kind]), [['encounters.0.medicines.0.dose_as_written', 'reopened', 'system']]);
  assert.deepEqual(M.gateOf(p).blocking.map(b => b.path), ['encounters.0.medicines.0.dose_as_written']);
});
