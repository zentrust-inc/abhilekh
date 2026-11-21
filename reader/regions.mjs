// Where on the original a value sits (rule 3: every value links to its region of the image). Works on the word boxes
// the Vision engine returns: [[text, [[x,y] x4]], ...], in the pixel coordinates of the original image.
// It only locates; it never reads or changes a value. A region that cannot be found, or that could be one of several,
// is null: the screen then shows the whole page and says so, it never guesses a crop.
import { loose, ascii } from './normalise.mjs';

const boxOf = ([text, pts]) => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { text, l: loose(text), x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};
const union = (ws) => [Math.min(...ws.map((w) => w.x0)), Math.min(...ws.map((w) => w.y0)), Math.max(...ws.map((w) => w.x1)), Math.max(...ws.map((w) => w.y1))];
const cy = (w) => (w.y0 + w.y1) / 2, cx = (w) => (w.x0 + w.x1) / 2;
// a word with letters or digits in it: the service gives a colon or a dash as a word of its own
const real = (w) => w.l !== '';
// a phone photo is tilted: a row runs down (or up) the page. Slope = median slope of the top edges of the longer words.
const slopeOf = (words) => {
  const a = words.map(([, p]) => ({ w: Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]), h: Math.hypot(p[3][0] - p[0][0], p[3][1] - p[0][1]), ang: Math.atan2(p[1][1] - p[0][1], p[1][0] - p[0][0]) }))
    .filter((x) => x.w > x.h).map((x) => x.ang).sort((p, q) => p - q);
  return a.length ? Math.tan(a[Math.floor(a.length / 2)]) : 0;
};
const prep = (words) => ({ W: words.map(boxOf).filter(real), slope: slopeOf(words) });

// consecutive words whose characters, joined, are the wanted text (a label the service split into words)
function findRun(W, wanted, from = 0) {
  const t = loose(wanted);
  if (!t) return null;
  for (let i = from; i < W.length; i++) {
    let acc = '';
    for (let j = i; j < W.length && acc.length < t.length; j++) {
      acc += W[j].l;
      if (acc === t) return W.slice(i, j + 1);
      if (!t.startsWith(acc)) break;
    }
  }
  return null;
}
// The row of a label: its middle height at the label, running down the page by the slope. Handwriting sits lower or
// higher than the printed label, so the row is the label's height either side of that line. A word much taller than the
// label (the diagonal SAMPLE watermark) is not part of any row.
function rowOf(label, slope) {
  const x = label.reduce((s, w) => s + cx(w), 0) / label.length;
  const y = label.reduce((s, w) => s + cy(w), 0) / label.length;
  return { x1: Math.max(...label.map((w) => w.x1)), h: Math.max(...label.map((w) => w.y1 - w.y0)), yAt: (px) => y + slope * (px - x) };
}
const rowRight = (W, label, slope) => {
  const L = rowOf(label, slope);
  return { L, ws: W.filter((w) => w.x0 >= L.x1 - 2 && Math.abs(cy(w) - L.yAt(cx(w))) <= 1.1 * L.h && (w.y1 - w.y0) <= 3.2 * L.h && !label.includes(w)).sort((a, b) => a.x0 - b.x0) };
};
// the first printed header word of a table column ("Result", "Unit", "Reference"), above the row
const header = (W, name, L) => W.find((w) => w.l === name && cy(w) < L.yAt(cx(w)));

// The region of a result value. By its characters when the service read them on the test's row, left of the Reference
// column (the same characters in the printed range are not the value); otherwise by the table's own column (between
// the "Result" and "Unit" headers) on that row. { box:[x0,y0,x1,y1], how } or null.
export function valueRegion(words, test, value) {
  const { W, slope } = prep(words);
  const label = findRun(W, test);
  if (!label) return null;
  const { L, ws } = rowRight(W, label, slope);
  const ref = header(W, 'reference', L);
  const hit = value ? findRun(ref ? ws.filter((w) => w.x1 <= ref.x0 - 5) : ws, value) : null;
  if (hit) return { box: union(hit), how: 'matched' };
  const hr = header(W, 'result', L), hu = header(W, 'unit', L) ?? ref;
  if (hr && hu) {
    const xa = hr.x0 - 10, xb = hu.x0 - 10;
    return { box: [xa, Math.min(L.yAt(xa), L.yAt(xb)) - 1.4 * L.h, xb, Math.max(L.yAt(xa), L.yAt(xb)) + 1.4 * L.h], how: 'column' };
  }
  return null;
}
// The printed range of the same row: the words under or after the "Reference" header, on that row.
export function rangeRegion(words, test) {
  const { W, slope } = prep(words);
  const label = findRun(W, test);
  if (!label) return null;
  const { L, ws } = rowRight(W, label, slope);
  const hr = header(W, 'reference', L);
  const r = hr ? ws.filter((w) => w.x1 > hr.x0 - 10) : [];
  return r.length ? { box: union(r), how: 'column' } : null;
}
// The region of the date. By its label ("Date", "मिति") when the service read the label: the words after it on its row.
// Otherwise the one word shaped like a date with a four-digit year (22/11/2026, 2083/08/17); more than one such word, or
// none, is null. A dose such as 1-0-1 has no four-digit group, so it is never taken for a date.
const isDateLabel = (w) => /^(date|dt)$/.test(w.l.replace(/:$/, '')) || w.text.replace(/[:：]$/, '') === 'मिति'; // loose() drops Devanagari vowel signs, so the Nepali label is compared as written
const DATE_SHAPE = /^\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}$/;
export function dateRegion(words) {
  const { W, slope } = prep(words);
  const label = W.find(isDateLabel);
  if (label) {
    const { ws } = rowRight(W, [label], slope);
    if (ws.length) return { box: union(ws), how: 'label-row' };
  }
  const shaped = W.filter((w) => { const t = ascii(w.text).replace(/\s/g, ''); return DATE_SHAPE.test(t) && /\d{4}/.test(t); });
  return shaped.length === 1 ? { box: union(shaped), how: 'shape' } : null;
}
