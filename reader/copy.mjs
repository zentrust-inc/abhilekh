// The full copy of a page (prompt v2, schema abhilekh.page.v2) and what the app does with it.
//
//  - legacy(copy): the fields the check screen already uses (kind, date, facility, clinician, results, medicines), taken
//    from the full copy without changing a character. A copy in the older shape is returned as it is.
//      * results = printed lab rows, results written inside a note, and imaging measurements that hold a value;
//      * medicines = every medicine line of every dated entry, except a line struck through on the paper (it stays in the
//        full copy, marked "struck_through", and is shown as such; it is never offered as a medicine to confirm).
//  - checkCopy(copy, lines): every text field of the full copy checked against Google Vision's lines of the same photo:
//      "agreed"     the same characters stand in Vision's text;
//      "one_reader" Vision does not show them (or Vision failed): shown as "Unresolved. Original document available.";
//      "uncertain"  the reader itself marked [Uncertain]: shown as written, with the original.
//    Nothing is changed; the states sit next to the copy, keyed by the field's path.
import { loose } from './normalise.mjs';

export const SCHEMA = 'abhilekh.page.v2';
export const UNCERTAIN = '[Uncertain]';
export const isFull = c => !!c && c.schema === SCHEMA;

const has = v => v != null && String(v).trim() !== '';
const join = (...p) => p.filter(has).map(s => String(s).trim()).join(' ');
const struck = m => (m.marks || []).includes('struck_through');

export function legacy(c) {
  if (!isFull(c)) return c;
  const page = c.page || {}, enc = c.encounters || [], lab = c.lab || {}, img = c.imaging || {};
  const medicines = enc.flatMap(e => e.medicines || []).filter(m => !struck(m)).map(m => ({
    as_written: join(m.form_as_written, m.name_as_written, m.strength_as_written) || m.line_as_written || '',
    dose: has(m.dose_as_written) ? m.dose_as_written : has(m.frequency_as_written) ? m.frequency_as_written : null,
    duration: has(m.duration_as_written) ? m.duration_as_written : null,
  }));
  const results = [
    ...(lab.sections || []).flatMap(s => (s.rows || []).map(r => ({ test: r.test_as_printed, value: r.result_as_printed, unit: r.unit_as_printed ?? null,
      range: r.reference_range_as_printed ?? null, flag: r.status_or_flag_as_printed ?? null }))),
    ...enc.flatMap(e => (e.results_in_note || []).map(r => ({ test: r.test_as_written, value: r.value_as_written, unit: r.unit_as_written ?? null, range: null, flag: null }))),
    ...(img.measurements || []).filter(m => has(m.value_as_written)).map(m => ({ test: m.parameter_as_printed, value: m.value_as_written, unit: m.unit_as_printed ?? null, range: null, flag: null })),
  ].filter(r => has(r.test) && has(r.value));
  const t = page.document_type;
  const kind = t === 'lab_report' ? 'lab_report' : ['prescription', 'opd_note'].includes(t) || medicines.length ? 'prescription' : 'other';
  const clin = c.clinicians || [];
  const doctor = clin.find(x => x.where !== 'referred_by') || clin[0] || {};
  const firstDate = enc.map(e => e.date_as_written).find(has) ?? (c.dates || []).map(d => d.as_written).find(has) ?? null;
  return {
    kind, date_as_printed: firstDate, facility: c.issuer?.name ?? null, clinician: doctor.name ?? null,
    patient_name: c.patient_as_written?.name ?? null, results, medicines,
    notes: enc.flatMap(e => [...(e.advice_as_written || []), ...(has(e.follow_up_as_written) ? [e.follow_up_as_written] : [])]),
  };
}

// Keys whose values are the reader's labels, not copies of the paper: not checked against Vision.
const LABEL_KEYS = new Set(['schema', 'document_type', 'scripts', 'where', 'kind', 'marks', 'handwritten', 'printed', 'signed']);

export function checkCopy(c, lines) {
  if (!isFull(c)) return null;
  const text = lines == null ? null : loose(lines.join('\n'));
  const states = {};
  const walk = (v, path, key) => {
    if (LABEL_KEYS.has(key) || v == null) return;
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, path + '.' + i, key));
    if (typeof v === 'object') return Object.entries(v).forEach(([k, x]) => walk(x, path ? path + '.' + k : k, k));
    if (typeof v !== 'string' || !has(v)) return;
    const l = loose(v);
    states[path] = v.includes(UNCERTAIN) ? 'uncertain' : text !== null && l && text.includes(l) ? 'agreed' : 'one_reader';
  };
  walk(c, '', '');
  const n = s => Object.values(states).filter(x => x === s).length;
  return { schema: SCHEMA, data: c, states, summary: { fields: Object.keys(states).length, agreed: n('agreed'), one_reader: n('one_reader'), uncertain: n('uncertain') } };
}
