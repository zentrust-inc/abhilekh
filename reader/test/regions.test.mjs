import { test } from 'node:test';
import assert from 'node:assert/strict';
import { valueRegion, rangeRegion, dateRegion } from '../regions.mjs';

// Synthetic words laid out like test-set-v3 L21 (labels and range as the service reads printed text; the handwritten
// words where it would put them). Not a real Vision response: a real one is needed before trusting this on photos.
const q = (t, x0, y0, x1, y1) => [t, [[x0, y0], [x1, y0], [x1, y1], [x0, y1]]];
const WORDS = [
  q('Date:', 62, 308, 127, 344), q('24/11/2026', 235, 300, 420, 350),
  q('Test', 60, 440, 110, 470), q('Result', 520, 440, 600, 470), q('Unit', 700, 440, 750, 470), q('Reference', 940, 440, 1040, 470), q('range', 1050, 440, 1120, 470),
  q('Specific', 60, 676, 140, 700), q('gravity', 152, 680, 228, 704), q('1020', 535, 676, 620, 722), q('1.005', 942, 681, 998, 698), q('–', 1004, 688, 1016, 692), q('1.030', 1026, 681, 1082, 698),
  q('Protein', 60, 740, 130, 764), q('Trace', 530, 735, 610, 775), q('Nil', 940, 742, 975, 762),
];
test('a value is found by its characters on the test row, handwriting lower than the label included', () => {
  const r = valueRegion(WORDS, 'Specific gravity', '1020');
  assert.equal(r.how, 'matched');
  assert.deepEqual(r.box, [535, 676, 620, 722]);
});
test('when the service did not read the value, the Result column on that row is used', () => {
  const r = valueRegion(WORDS, 'Specific gravity', '1.020');
  assert.equal(r.how, 'column');
  assert.ok(r.box[0] < 535 && r.box[2] > 620 && r.box[2] <= 700);
});
test('the printed range is the words after the Reference header on the same row, and not the neighbouring row', () => {
  const r = rangeRegion(WORDS, 'Specific gravity');
  assert.deepEqual(r.box, [942, 681, 1082, 698]);
  assert.deepEqual(rangeRegion(WORDS, 'Protein').box, [940, 742, 975, 762]);
});
test('the date is the words after the Date label on its row', () => {
  assert.deepEqual(dateRegion(WORDS).box, [235, 300, 420, 350]);
});
test('no label found means no region, never a guess', () => {
  assert.equal(valueRegion(WORDS, 'Haemoglobin', '12.1'), null);
  assert.equal(rangeRegion(WORDS, 'Haemoglobin'), null);
  assert.equal(dateRegion([q('Name:', 10, 10, 60, 30)]), null);
  assert.equal(valueRegion([q('Specific', 60, 676, 140, 700), q('gravity', 152, 680, 228, 704)], 'Specific gravity', '1.020'), null);
});
