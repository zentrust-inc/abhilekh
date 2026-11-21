// Where on the original a value sits (rule 3: every value links to its region of the image). Works on the word boxes
// the Vision engine returns: [[text, [[x,y] x4]], ...], in the pixel coordinates of the original image.
// It only locates; it never reads or changes a value. A region that cannot be found is null: the screen then shows
// the whole page and says so, it never guesses a crop.
import { loose } from './normalise.mjs';

const boxOf = ([text, pts]) => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  return { text, l: loose(text), x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};
const union = (ws) => [Math.min(...ws.map((w) => w.x0)), Math.min(...ws.map((w) => w.y0)), Math.max(...ws.map((w) => w.x1)), Math.max(...ws.map((w) => w.y1))];
const cy = (w) => (w.y0 + w.y1) / 2;

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
// words to the right of a label, on its row. Handwriting sits lower or higher than the printed label, so the row is
// the label's height either side of its middle.
const rowRight = (W, label) => {
  const L = { x1: Math.max(...label.map((w) => w.x1)), cy: label.reduce((s, w) => s + cy(w), 0) / label.length, h: Math.max(...label.map((w) => w.y1 - w.y0)) };
  return { L, ws: W.filter((w) => w.x0 >= L.x1 - 2 && Math.abs(cy(w) - L.cy) <= 1.1 * L.h && !label.includes(w)).sort((a, b) => a.x0 - b.x0) };
};
// the first printed header word of a table column ("Result", "Unit", "Reference"), above the row
const header = (W, name, above) => W.find((w) => w.l === name && cy(w) < above);

// The region of a result value. By its characters when the service read them on the test's row; otherwise by the table's
// own column (between the "Result" and "Unit" headers) on that row. { box:[x0,y0,x1,y1], how } or null.
export function valueRegion(words, test, value) {
  const W = words.map(boxOf);
  const label = findRun(W, test);
  if (!label) return null;
  const { L, ws } = rowRight(W, label);
  const hit = value ? findRun(ws, value) : null;
  if (hit) return { box: union(hit), how: 'matched' };
  const hr = header(W, 'result', L.cy), hu = header(W, 'unit', L.cy) ?? header(W, 'reference', L.cy);
  if (hr && hu) return { box: [hr.x0 - 10, L.cy - 1.4 * L.h, hu.x0 - 10, L.cy + 1.4 * L.h], how: 'column' };
  return null;
}
// The printed range of the same row: the words under or after the "Reference" header, on that row.
export function rangeRegion(words, test) {
  const W = words.map(boxOf);
  const label = findRun(W, test);
  if (!label) return null;
  const { L, ws } = rowRight(W, label);
  const hr = header(W, 'reference', L.cy);
  const r = hr ? ws.filter((w) => w.x1 > hr.x0 - 10) : [];
  return r.length ? { box: union(r), how: 'column' } : null;
}
// The region of the date: the words on the row after the "Date" label, handwritten or printed.
export function dateRegion(words) {
  const W = words.map(boxOf);
  const label = W.find((w) => /^date:?$/.test(w.l) || w.l === 'date');
  if (!label) return null;
  const { ws } = rowRight(W, [label]);
  return ws.length ? { box: union(ws), how: 'label-row' } : null;
}
