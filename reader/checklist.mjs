// The required-field checklist and the gate (spec v1.0, C1 + C4), on a page.v2 copy.
//
//  - groupOf(documentType)            which rule set a paper type uses (schema/checklist.json).
//  - expand(copy)                     the paths that must have a state, built from the RULES, not from what the reader
//                                     happened to find; plus the row groups whose count the patient must confirm.
//  - gate(copy, decisions, lines)     what still blocks this paper from search and the doctor views:
//                                       pending required paths, unconfirmed row counts, unconfirmed person/type,
//                                       and Vision lines that ended up nowhere in the copy (coverage).
//  - needsOwnTap(path, value)         a date, or a value with a decimal point, is never confirmed by "confirm all".
//
// Nothing here changes the copy or judges a value. Paths match checkCopy() state keys (0-based, dot-separated).
import { readFileSync } from 'node:fs';
import { loose } from './normalise.mjs';

export const RULES = JSON.parse(readFileSync(new URL('../schema/checklist.json', import.meta.url), 'utf8'));
const STATES = new Set(['verified', 'absent', 'unreadable']);
const has = v => v != null && String(v).trim() !== '';

export function groupOf(documentType) {
  for (const [g, types] of Object.entries(RULES.type_groups)) if (types.includes(documentType)) return g;
  return 'other';
}

const get = (obj, parts) => parts.reduce((o, k) => (o == null ? undefined : o[k]), obj);

// "encounters[].medicines[].name_as_written" over the copy -> concrete paths, and the row groups met on the way.
function walkTemplate(copy, template) {
  const segs = template.split('.');
  let frontier = [{ parts: [] }];
  const groups = [];
  for (const seg of segs) {
    const isArr = seg.endsWith('[]');
    const key = isArr ? seg.slice(0, -2) : seg;
    const next = [];
    for (const f of frontier) {
      const parts = [...f.parts, key];
      if (!isArr) { next.push({ parts }); continue; }
      const arr = get(copy, parts);
      const n = Array.isArray(arr) ? arr.length : 0;
      groups.push({ group: parts.join('.'), rows: n });
      for (let i = 0; i < n; i++) next.push({ parts: [...parts, String(i)] });
    }
    frontier = next;
  }
  return { paths: frontier.map(f => f.parts.join('.')), groups };
}

export function expand(copy) {
  const type = copy?.page?.document_type ?? 'other';
  const rules = [...RULES.rules.all, ...RULES.rules[groupOf(type)]];
  const required = [], groups = new Map();
  for (const r of rules) {
    if (r.requirement === 'system') { required.push({ path: r.path, requirement: 'system', label: r.label }); continue; }
    const { paths, groups: gs } = walkTemplate(copy, r.path);
    gs.forEach((g, i) => {
      const isLast = i === gs.length - 1;
      const prev = groups.get(g.group);
      groups.set(g.group, { group: g.group, rows: g.rows, min_rows: Math.max(prev?.min_rows ?? 0, isLast ? r.min_rows ?? 0 : 0) });
    });
    for (const p of paths) {
      const present = has(get(copy, p.split('.')));
      if (r.requirement === 'if_present' && !present) continue;
      required.push({ path: p, requirement: r.requirement, label: r.label, present });
    }
  }
  return { group: groupOf(type), required, groups: [...groups.values()] };
}

// decisions: { states: {path: 'verified'|'absent'|'unreadable'}, counts: {group: n}, person_confirmed, type_confirmed }
// lines: Google Vision's lines of the same photo (optional) for the coverage check.
export function gate(copy, decisions = {}, lines = null) {
  const { required, groups } = expand(copy);
  const states = decisions.states ?? {}, counts = decisions.counts ?? {};
  const blocking = [];
  for (const r of required) {
    if (r.path === 'person.match') { if (!decisions.person_confirmed) blocking.push({ path: r.path, why: 'person not confirmed' }); continue; }
    if (r.path === 'page.document_type') { if (!decisions.type_confirmed) blocking.push({ path: r.path, why: 'type not confirmed' }); continue; }
    if (!STATES.has(states[r.path])) blocking.push({ path: r.path, why: r.present ? 'not confirmed' : 'not read: confirm it is not on the paper, or that it cannot be read' });
  }
  for (const g of groups) {
    if (counts[g.group] === undefined) blocking.push({ path: 'count:' + g.group, rows: g.rows, why: g.rows < g.min_rows ? `reader found ${g.rows}; expected at least ${g.min_rows}: confirm the count` : 'count not confirmed' });
    else if (counts[g.group] !== g.rows) blocking.push({ path: 'count:' + g.group, rows: g.rows, why: `patient says ${counts[g.group]}, copy has ${g.rows}: re-read or correct` });
  }
  const uncovered = lines ? coverage(copy, lines) : [];
  uncovered.forEach(i => blocking.push({ path: 'coverage:' + i, why: 'text on the photo is not in the copy' }));
  return { ok: blocking.length === 0, blocking, required: required.length, groups: groups.length, uncovered: uncovered.length };
}

// Indexes of Vision lines whose text appears nowhere in the copy (C4). Lines of only punctuation are ignored.
export function coverage(copy, lines) {
  const strings = [];
  const walk = v => { if (v == null) return; if (Array.isArray(v)) return v.forEach(walk);
    if (typeof v === 'object') return Object.values(v).forEach(walk); if (typeof v === 'string') strings.push(v); };
  walk(copy);
  const text = loose(strings.join('\n'));
  const out = [];
  lines.forEach((line, i) => {
    const words = String(line).split(/\s+/).map(loose).filter(w => w.length > 1 && /[\p{L}\p{N}]/u.test(w));
    if (words.length && !words.every(w => text.includes(w))) out.push(i);
  });
  return out;
}

const DATE_KEYS = /(^|\.)(as_written|date_as_written|date_of_birth_as_written)$/;
export function needsOwnTap(path, value) {
  if (/^dates\.\d+\.as_written$/.test(path) || /date/.test(path) && DATE_KEYS.test(path)) return true;
  return typeof value === 'string' && /\d[.,]\d|\.\d/.test(value);
}
