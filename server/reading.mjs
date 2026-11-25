// Reading the photos (build plan M2). The two readers from reader/engines.mjs (Claude and Gemini, two companies) each copy
// the paper into JSON on their own; then every field is compared. Nothing here interprets a result.
//
//   - Both readers give the same text            -> "agreed"   (pre-ticked later, in the confirm screen, M3)
//   - The date, or a value with a decimal point   -> "confirm"  (the patient always checks it herself, even when they agree)
//   - The readers differ, or only one saw it       -> "unresolved": "Unresolved. Original document available." Never guessed.
//   - A medicine name not exactly on the DDA list  -> shown as written, flagged.
//
// The original is never changed. The readers get a smaller JPEG copy made in memory (long side at most 2000 px), because a
// phone photo is often larger than a reader accepts; the copy is not kept.
//
// Cost (decided 25 Nov 2026): at most US$0.10 a page and US$20 a month. A page is only started when the month still has
// US$0.10 left; when the month is used up, photos wait ("paused") and are read next month. Spend is kept in the store.
import { createHash } from 'node:crypto';
import jpeg from 'jpeg-js';

const MAX_SIDE = 2000;

// A smaller copy for the readers. Non-JPEG photos (PNG, WebP, HEIC) are sent as they are.
export function readingCopy(buf, mime) {
  if (mime !== 'image/jpeg') return { buf, mime };
  const img = jpeg.decode(buf, { useTArray: true, maxMemoryUsageInMB: 1024, maxResolutionInMP: 200 });
  const f = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  if (f === 1 && buf.length < 3.5 * 1024 * 1024) return { buf, mime };
  const w = Math.max(1, Math.round(img.width * f)), h = Math.max(1, Math.round(img.height * f));
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) { // box filter: average the source pixels that fall in each target pixel
    const y0 = Math.floor(y / f), y1 = Math.min(img.height, Math.max(y0 + 1, Math.floor((y + 1) / f)));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x / f), x1 = Math.min(img.width, Math.max(x0 + 1, Math.floor((x + 1) / f)));
      let r = 0, g = 0, b = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const i = (yy * img.width + xx) * 4; r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++; }
      const o = (y * w + x) * 4; out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = 255;
    }
  }
  return { buf: Buffer.from(jpeg.encode({ data: out, width: w, height: h }, 85).data), mime: 'image/jpeg' };
}

export function createReading({ store, save, keep, readers, rules, now = () => Date.now(), monthCapUsd = 20, pageCapUsd = 0.10, logger = console }) {
  const { same, mustConfirmValue, checkMedicine, ddaIndex, loose } = rules;
  const queue = [];
  let running = false;
  store.reading = store.reading || { spend: {} };
  const month = () => new Date(now()).toISOString().slice(0, 7);
  const spent = () => store.reading.spend[month()] || 0;

  const all = () => Object.values(store.records || {}).flatMap(r => (r.people || []).flatMap(p => p.papers || []));
  const find = id => all().find(p => p.id === id);

  function enqueue(id) { if (!queue.includes(id)) queue.push(id); pump(); }
  // At start-up: everything not yet read (and anything a restart interrupted) goes back in the queue.
  function resume() { for (const p of all()) if (['waiting', 'reading', 'paused'].includes(p.status)) { p.status = 'waiting'; enqueue(p.id); } }

  async function pump() {
    if (running) return;
    running = true;
    try {
      while (queue.length) {
        const id = queue.shift(), p = find(id);
        if (!p || p.status === 'ready') continue;
        if (spent() + pageCapUsd > monthCapUsd) { p.status = 'paused'; save(); logger.log('Reading paused: monthly limit reached'); continue; }
        p.status = 'reading'; save();
        try {
          const orig = await keep.get(p.ref);
          if (createHash('sha256').update(orig).digest('hex') !== p.sha256) throw new Error('original does not match its SHA-256');
          const copy = readingCopy(orig, p.mime);
          const [a, b] = await Promise.allSettled([readers.a(copy.buf, copy.mime), readers.b(copy.buf, copy.mime)]);
          const usd = [a, b].reduce((s, r) => s + (r.status === 'fulfilled' ? r.value.usd || 0 : 0), 0);
          store.reading.spend[month()] = spent() + usd;
          if (usd > pageCapUsd) logger.error('Reading: one page cost US$' + usd.toFixed(3) + ', above the page limit');
          if (a.status === 'rejected' && b.status === 'rejected') throw new Error('both readers failed: ' + String(a.reason?.message).slice(0, 80) + ' / ' + String(b.reason?.message).slice(0, 80));
          p.reading = compare(a.status === 'fulfilled' ? a.value.data : null, b.status === 'fulfilled' ? b.value.data : null);
          p.reading.at = new Date(now()).toISOString();
          p.reading.usd = Math.round(usd * 10000) / 10000;
          p.reading.readers = [a, b].map(r => r.status === 'fulfilled' ? r.value.model : 'failed');
          p.status = 'ready'; delete p.error;
          logger.log('Read ' + p.id + ': ' + p.reading.summary.fields + ' fields, ' + p.reading.summary.agreed + ' agreed, US$' + usd.toFixed(3));
        } catch (e) {
          p.status = 'failed'; p.error = String(e.message).slice(0, 200);
          logger.error('Reading failed for ' + p.id + ': ' + p.error);
        }
        save();
      }
    } finally { running = false; }
  }

  // ---- comparing two copies of the paper, field by field ----
  const blank = v => v == null || String(v).trim() === '' || String(v).trim() === '-';
  function field(va, vb, { confirm = false } = {}) {
    const both = va !== undefined && vb !== undefined;
    const agree = both && (blank(va) ? blank(vb) : !blank(vb) && same(va, vb));
    const text = !blank(va) ? String(va) : !blank(vb) ? String(vb) : '';
    if (agree && blank(va)) return { text: '', state: 'empty' };
    if (!agree) return { text: '', state: 'unresolved', a: blank(va) ? '' : String(va), b: blank(vb) ? '' : String(vb) };
    return { text, state: confirm ? 'confirm' : 'agreed' };
  }
  const matchBy = (list, key, wanted) => { const t = loose(wanted); return (list || []).find(x => loose(x[key]) === t) || (list || []).find(x => { const k = loose(x[key]); return k && t && (k.includes(t) || t.includes(k)); }); };

  function compare(A, B) {
    const one = !A || !B; // only one reader answered: nothing can be agreed
    A = A || {}; B = B || {};
    const out = {
      kind: field(A.kind, one ? undefined : B.kind).text || (A.kind || B.kind || 'other'),
      date: { ...field(A.date_as_printed, one ? undefined : B.date_as_printed, { confirm: true }), typed: true }, // the patient types the date
      facility: field(A.facility, one ? undefined : B.facility),
      clinician: field(A.clinician, one ? undefined : B.clinician),
      results: [], medicines: [], notes: (A.notes || B.notes || []).map(String),
      oneReader: one,
    };
    const seen = new Set();
    for (const [X, Y, first] of [[A, B, true], [B, A, false]]) {
      for (const r of X.results || []) {
        const o = one ? undefined : matchBy(Y.results, 'test', r.test);
        const key = loose(r.test) + '|' + loose(o?.test || '');
        if (!first && o && seen.has(loose(o.test) + '|' + loose(r.test))) continue;
        seen.add(key);
        const ra = first ? r : o, rb = first ? o : r;
        const must = mustConfirmValue(ra?.value, rb?.value, ra?.range, rb?.range);
        out.results.push({
          test: field(ra?.test, rb?.test),
          value: field(ra?.value, rb?.value, { confirm: must }),
          unit: field(ra?.unit, rb?.unit), range: field(ra?.range, rb?.range), flag: field(ra?.flag, rb?.flag),
        });
      }
    }
    const medSeen = new Set();
    for (const [X, Y, first] of [[A, B, true], [B, A, false]]) {
      for (const m of X.medicines || []) {
        const o = one ? undefined : matchBy(Y.medicines, 'as_written', m.as_written);
        if (!first && o && medSeen.has(loose(o.as_written))) continue;
        medSeen.add(loose(m.as_written));
        const ma = first ? m : o, mb = first ? o : m;
        const name = field(ma?.as_written, mb?.as_written);
        const dda = checkMedicine(name.text || m.as_written, ddaIndex).status; // 'on_list' | 'not_found': shown as written either way
        out.medicines.push({ as_written: name, dose: field(ma?.dose, mb?.dose), duration: field(ma?.duration, mb?.duration), dda });
      }
    }
    const fs = [out.date, out.facility, out.clinician, ...out.results.flatMap(r => [r.test, r.value, r.unit, r.range, r.flag]), ...out.medicines.flatMap(m => [m.as_written, m.dose, m.duration])].filter(f => f.state !== 'empty');
    out.summary = { fields: fs.length, agreed: fs.filter(f => f.state === 'agreed').length, confirm: fs.filter(f => f.state === 'confirm').length, unresolved: fs.filter(f => f.state === 'unresolved').length };
    return out;
  }

  return { enqueue, resume, pump, compare, spent, idle: () => !running && !queue.length };
}
