// The DDA register of medicines (brand index), used by the readers (decided 25 Nov 2026):
//   - exact names only: a medicine line is looked up by its name part exactly as copied; a near name is never used;
//   - an exact match confirms a line the readers agreed on, or moves an Unresolved line to "check against the paper"
//     (the readers' own copy matched the register exactly); what is written is never changed;
//   - the WHO ATC code is kept with each entry; prices, conditions and importers are not;
//   - a name both readers agreed on that is not on the register goes on the "not yet on the register" list: the name
//     only, never who it belongs to. A person reviews that list; the register is refreshed from the DDA each month.
// The index (reader/dda/build-register-index.mjs) lives in the Google shared drive, folder "register", newest
// abhilekh-register-index-*.json; it is loaded at start-up. Without it, nothing is looked up.

export function createRegister({ index = null, namePart }) {
  let R = index;
  const key = text => namePart(String(text || '').replace(/^(t|tab|cap|inj|syp|syr)\.?\s+/i, ''));
  function lookup(text) {
    if (!R || !text) return null;
    const k = key(text), e = R.entries[k];
    if (!k || !e) return null;
    const num = (String(text).match(/\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?/) || [])[0];
    const same = num ? e.products.filter(p => p.strength && p.strength.split(' ')[0] === num) : [];
    const products = (same.length ? same : e.products).slice(0, 6).map(p => ({ id: p.id, registered: p.registered, generics: p.generics, strength: p.strength, form: p.form, manufacturer: p.manufacturer, valid: p.valid, atc: p.atc }));
    return { version: R.version, key: k, mixed: !!e.mixed, strengthMatched: same.length > 0, products };
  }
  return { lookup, key, loaded: () => !!R, version: () => R && R.version, set: i => { R = i; } };
}

// Medicine lines of one reading: add the register entry, and move Unresolved lines whose copy is on the register
// exactly to "confirm". Names both readers agreed on that are not on the register are counted in missing (name only).
export function applyRegister(reading, register, missing, now = () => Date.now()) {
  if (!reading || !register.loaded()) return reading;
  for (const m of reading.medicines || []) {
    const copy = m.as_written.text || m.as_written.a || '';
    const hit = register.lookup(copy);
    m.register = hit;
    if (hit) {
      m.dda = 'on_register';
      if (m.as_written.state === 'unresolved' && m.as_written.a) m.as_written = { text: m.as_written.a, state: 'confirm', byRegister: true };
    } else if (m.as_written.state === 'agreed' && missing) {
      const k = register.key(copy);
      if (k) { const e = missing[k] || (missing[k] = { seen: 0, first: new Date(now()).toISOString() }); e.seen++; e.last = new Date(now()).toISOString(); }
    }
  }
  reading.registerVersion = register.version();
  const fs = [reading.date, reading.facility, reading.clinician, ...reading.results.flatMap(r => [r.test, r.value, r.unit, r.range, r.flag]), ...reading.medicines.flatMap(m => [m.as_written, m.dose, m.duration])].filter(f => f && f.state !== 'empty');
  reading.summary = { fields: fs.length, agreed: fs.filter(f => f.state === 'agreed').length, confirm: fs.filter(f => f.state === 'confirm').length, unresolved: fs.filter(f => f.state === 'unresolved').length };
  return reading;
}
