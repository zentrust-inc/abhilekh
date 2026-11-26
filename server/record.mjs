// The record model, spec v1.0 (Drive › Kakani-3 › Abhilekh › core spec v1.0), over store.json. Data first; screens later.
//
// Per paper the store already holds the page.v2 copy and a state per field (p.reading.copy: { data, states }).
// This module adds, without changing any of that:
//   - consensus(p)      one result per path: agreed / one_reader / uncertain; a value is pre-filled only when agreed.
//   - p.log             ONE append-only list of decisions (never edited, never shortened). Every confirmation,
//                       correction, "not on the paper", "can't read", row count, person and paper type is an event.
//   - current(p)        the state of each path, read from the log by sequence number (the last event wins).
//   - gateOf(p)         what still blocks the paper (reader/checklist.mjs: rules per paper type, counts, coverage).
//   - itemsOf(p)        the confirmed copy as items (medicines, lab rows, dates, ...), built from the log; never stored,
//                       so a correction reaches everything built on it.
//   - reconcile(p, old) after a re-read: a decided path whose text changed is reopened by the system; the rest stand.
// Nothing here interprets a value, adds a range or a flag, or converts a date (dates are converted in derived/).
export const MODEL = 'abhilekh.record.v1';
export const UNRESOLVED = 'Unresolved. Original document available.';

const ACTIONS = new Set(['confirmed', 'corrected', 'marked_absent_on_paper', 'marked_unreadable', 'reopened',
  'count_confirmed', 'assigned_text_block', 'not_text_confirmed']);
const ACTORS = new Set(['patient', 'family', 'clinician', 'system']);
const TYPES = ['prescription', 'opd_note', 'lab_report', 'imaging_report', 'discharge_summary', 'notebook_page', 'booklet_cover', 'referral', 'bill', 'other'];
const STATE_OF = { confirmed: 'verified', corrected: 'verified', marked_absent_on_paper: 'absent', marked_unreadable: 'unreadable', reopened: 'pending' };
const MAX_VALUE = 500;

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
const has = v => v != null && String(v).trim() !== '';

export function createRecordModel({ expand, gate, needsOwnTap, loose = s => String(s ?? ''), now = () => Date.now() }) {
  const copyOf = p => p?.reading?.copy?.data ? p.reading.copy : null;
  const version = p => p?.reading?.at || null;

  // The paper type the checklist uses: the patient's correction wins over the reader's label.
  function typedCopy(p) {
    const c = copyOf(p).data;
    const t = lastOn(p, 'page.document_type');
    const type = t?.action === 'corrected' ? t.value : c.page?.document_type;
    return { ...c, page: { ...(c.page || {}), document_type: type } };
  }

  function consensus(p) {
    const c = copyOf(p); if (!c) return [];
    return Object.entries(c.states || {}).map(([path, agreement]) => {
      const value = get(c.data, path);
      return { path, value, agreement, prefill: agreement === 'agreed' ? value : null, needs_own_tap: needsOwnTap(path, value) };
    });
  }

  const log = p => (p.log = Array.isArray(p.log) ? p.log : []);
  const lastOn = (p, path) => { let e = null; for (const x of log(p)) if (x.path === path && (!e || x.seq > e.seq)) e = x; return e; };

  // Paths a decision may be made on: what the readers copied, what the rules require, the row groups, person, type, coverage.
  function knownPaths(p) {
    const ex = expand(typedCopy(p));
    const fields = new Set([...consensus(p).map(f => f.path), ...ex.required.map(r => r.path)]);
    fields.delete('person.match'); fields.delete('page.document_type');
    const groups = new Map(ex.groups.map(g => [g.group, g]));
    return { fields, groups };
  }

  // Validate one event against the paper; returns the event to append or throws { status: 400 }.
  function check(p, ev, actor) {
    const bad = m => { throw Object.assign(new Error(m), { status: 400 }); };
    if (!copyOf(p)) bad('This paper has no full copy yet.');
    if (!actor || !ACTORS.has(actor.kind)) bad('Unknown actor.');
    if (actor.kind === 'clinician' && !has(actor.name)) bad('A clinician who confirms must be named.');
    const { path, action } = ev || {};
    if (typeof path !== 'string' || !path || path.length > 300) bad('Bad path.');
    if (!ACTIONS.has(action)) bad('Unknown action.');
    if (actor.kind === 'system' && action !== 'reopened') bad('The system may only reopen.');
    const value = ev.value == null ? undefined : String(ev.value).replace(/\s+/g, ' ').trim().slice(0, MAX_VALUE);
    const out = { path, action, actor: { kind: actor.kind, ...(actor.person ? { person: actor.person } : {}), ...(actor.name ? { name: String(actor.name).slice(0, 120) } : {}) } };

    if (path === 'person.match') { if (action !== 'confirmed') bad('Whose paper it is can only be confirmed.'); return out; }
    if (path === 'page.document_type') {
      if (action === 'confirmed') return out;
      if (action === 'corrected' && TYPES.includes(value)) return { ...out, value };
      bad('Paper type: confirm it, or correct it to a known type.');
    }
    if (path.startsWith('count:')) {
      const g = knownPaths(p).groups.get(path.slice(6));
      if (!g) bad('No such row group on this paper.');
      if (action === 'reopened') return out;
      if (action !== 'count_confirmed' || !Number.isInteger(ev.value) || ev.value < 0 || ev.value > 500) bad('Give the number of rows on the paper.');
      return { ...out, value: ev.value };
    }
    if (path === 'coverage:all') {
      if (Array.isArray(p.reading?.vision_lines)) bad('This reading has Vision\'s lines: decide line by line.');
      if (!['not_text_confirmed', 'reopened'].includes(action)) bad('Confirm that nothing else is written on the paper.');
      return out;
    }
    if (path.startsWith('coverage:')) {
      const lines = p.reading?.vision_lines;
      const i = Number(path.slice(9));
      if (!Array.isArray(lines) || !Number.isInteger(i) || i < 0 || i >= lines.length) bad('No such line on this paper.');
      if (!['assigned_text_block', 'not_text_confirmed', 'reopened'].includes(action)) bad('A line is kept as text, or confirmed not to be text.');
      return out;
    }
    if (!knownPaths(p).fields.has(path)) bad('No such field on this paper.');
    if (['count_confirmed', 'assigned_text_block', 'not_text_confirmed'].includes(action)) bad('Not an action for a field.');
    const f = consensus(p).find(x => x.path === path);
    if (action === 'confirmed') {
      if (!f || f.agreement !== 'agreed') bad('Only a value both readers agree on can be confirmed as shown; type it from the paper instead.');
      if (ev.bulk && f.needs_own_tap) bad('A date or a value with a decimal point needs its own tick.');
      return { ...out, ...(ev.bulk ? { bulk: true } : {}) };
    }
    if (action === 'corrected') { if (!has(value)) bad('Type the value exactly as it is on the paper.'); return { ...out, value }; }
    return out;
  }

  // Append events atomically: all are checked first; none is added if one is wrong.
  function append(p, events, actor) {
    const list = (Array.isArray(events) ? events : [events]).map(e => check(p, e, actor));
    const L = log(p), at = new Date(now()).toISOString(), copy_at = version(p);
    let seq = L.reduce((m, e) => Math.max(m, e.seq), 0);
    const added = list.map(e => ({ seq: ++seq, at, copy_at, ...e }));
    L.push(...added);
    return added;
  }

  // State of every decided or required path.
  function current(p) {
    const out = {};
    for (const f of consensus(p)) out[f.path] = { ...f, state: 'pending', current: f.prefill };
    for (const e of [...log(p)].sort((a, b) => a.seq - b.seq)) {
      if (!(e.action in STATE_OF) || e.path.includes(':') || e.path === 'person.match' || e.path === 'page.document_type') continue;
      const f = out[e.path] || (out[e.path] = { path: e.path, value: undefined, agreement: null, prefill: null, needs_own_tap: false });
      f.state = STATE_OF[e.action];
      f.current = e.action === 'corrected' ? e.value : e.action === 'confirmed' ? f.prefill : e.action === 'marked_unreadable' ? UNRESOLVED : e.action === 'marked_absent_on_paper' ? null : f.prefill;
    }
    return out;
  }

  function decisions(p) {
    const cur = current(p), states = {}, counts = {};
    for (const [path, f] of Object.entries(cur)) if (f.state !== 'pending') states[path] = f.state;
    for (const g of knownPaths(p).groups.keys()) { const e = lastOn(p, 'count:' + g); if (e && e.action === 'count_confirmed') counts[g] = e.value; }
    return { states, counts, person_confirmed: lastOn(p, 'person.match')?.action === 'confirmed', type_confirmed: ['confirmed', 'corrected'].includes(lastOn(p, 'page.document_type')?.action) };
  }

  function gateOf(p) {
    if (!copyOf(p)) return { ok: false, blocking: [{ path: 'copy', why: 'not read with the full copy yet' }], model: MODEL };
    const lines = p.reading?.vision_lines;
    const g = gate(typedCopy(p), decisions(p), Array.isArray(lines) ? lines : null);
    let blocking = g.blocking.filter(b => {
      if (!b.path.startsWith('coverage:')) return true;
      const e = lastOn(p, b.path); return !(e && ['assigned_text_block', 'not_text_confirmed'].includes(e.action));
    });
    if (!Array.isArray(lines)) { // read before Vision's lines were kept: a person confirms nothing else is on the paper
      const e = lastOn(p, 'coverage:all');
      if (!(e && e.action === 'not_text_confirmed')) blocking.push({ path: 'coverage:all', why: 'coverage not checked for this reading: confirm nothing else is written on the paper, or read it again' });
    }
    return { ok: blocking.length === 0, blocking, required: g.required, groups: g.groups, model: MODEL, copy_at: version(p) };
  }

  // The confirmed copy as items. Empty until the gate passes. Every item names the paths it came from.
  function itemsOf(p) {
    if (!gateOf(p).ok) return null;
    const cur = current(p), data = typedCopy(p);
    const val = path => { const f = cur[path]; return f ? f.current ?? null : null; };
    const pick = (base, keys) => Object.fromEntries(keys.map(k => [k, val(base + '.' + k)]));
    const items = [];
    (data.dates || []).forEach((d, i) => items.push({ kind: 'date', paths: ['dates.' + i], printed_text: val(`dates.${i}.as_written`), label_as_printed: d.label_as_printed ?? null }));
    (data.encounters || []).forEach((e, ei) => {
      const b = 'encounters.' + ei;
      (e.medicines || []).forEach((m, mi) => items.push({ kind: 'medicine', paths: [`${b}.medicines.${mi}`], encounter: ei,
        struck_through: (m.marks || []).includes('struck_through'),
        ...pick(`${b}.medicines.${mi}`, ['form_as_written', 'name_as_written', 'strength_as_written', 'dose_as_written', 'frequency_as_written', 'timing_as_written', 'duration_as_written', 'line_as_written']) }));
      (e.diagnosis_or_impression_as_written || []).forEach((_, i) => items.push({ kind: 'diagnosis', paths: [`${b}.diagnosis_or_impression_as_written.${i}`], encounter: ei, text_as_written: val(`${b}.diagnosis_or_impression_as_written.${i}`) }));
      (e.investigations_advised_as_written || []).forEach((_, i) => items.push({ kind: 'investigation', paths: [`${b}.investigations_advised_as_written.${i}`], encounter: ei, text_as_written: val(`${b}.investigations_advised_as_written.${i}`) }));
      if (has(val(`${b}.follow_up_as_written`))) items.push({ kind: 'instruction', paths: [`${b}.follow_up_as_written`], encounter: ei, text_as_written: val(`${b}.follow_up_as_written`) });
    });
    (data.lab?.sections || []).forEach((s, si) => (s.rows || []).forEach((_, ri) => {
      const b = `lab.sections.${si}.rows.${ri}`;
      items.push({ kind: 'lab_result', paths: [b], ...pick(b, ['test_as_printed', 'result_as_printed', 'unit_as_printed', 'reference_range_as_printed', 'status_or_flag_as_printed']) });
    }));
    (data.imaging?.impression_as_written || []).forEach((_, i) => items.push({ kind: 'text_block', paths: ['imaging.impression_as_written.' + i], text_as_written: val('imaging.impression_as_written.' + i) }));
    (data.other_text || []).forEach((_, i) => items.push({ kind: 'text_block', paths: ['other_text.' + i], text_as_written: val('other_text.' + i) }));
    for (const e of log(p)) if (e.action === 'assigned_text_block' && lastOn(p, e.path) === e) {
      const i = Number(e.path.slice(9)); items.push({ kind: 'text_block', paths: [e.path], text_as_written: p.reading.vision_lines[i] });
    }
    return items;
  }

  // After a re-read: keep decisions whose text did not change; reopen the rest (system events, appended).
  function reconcile(p, oldCopy) {
    if (!oldCopy?.data || !copyOf(p) || !log(p).length) return [];
    const newData = copyOf(p).data, reopen = [];
    const decided = new Map();
    for (const e of log(p)) decided.set(e.path, e);
    for (const [path, e] of decided) {
      if (e.action === 'reopened') continue;
      if (path === 'person.match') continue;
      if (path === 'page.document_type') { if (oldCopy.data.page?.document_type !== newData.page?.document_type) reopen.push(path); continue; }
      if (path.startsWith('coverage:')) { reopen.push(path); continue; } // line numbers belong to one reading
      if (path.startsWith('count:')) { const g = path.slice(6); const n = v => (Array.isArray(get(v, g)) ? get(v, g).length : 0); if (n(oldCopy.data) !== n(newData)) reopen.push(path); continue; }
      if (loose(get(oldCopy.data, path) ?? '') !== loose(get(newData, path) ?? '')) reopen.push(path);
    }
    if (!reopen.length) return [];
    return append(p, reopen.map(path => ({ path, action: 'reopened' })), { kind: 'system' });
  }

  return { consensus, current, decisions, append, gateOf, itemsOf, reconcile, typedCopy };
}
