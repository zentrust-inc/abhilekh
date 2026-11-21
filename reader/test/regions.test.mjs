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

test('real-page cases: a split colon, a watermark word and the same characters in the range column', () => {
  const W2 = [
    q('Date', 44, 306, 93, 330), q(':', 93, 308, 98, 330), q('24/11/2026', 235, 300, 420, 350),
    q('Result', 520, 440, 600, 470), q('Unit', 700, 440, 750, 470), q('Reference', 940, 440, 1040, 470),
    q('Sugar', 60, 740, 130, 764), q('Nil', 940, 742, 975, 762),                        // the handwritten Nil was not read, the printed range was
    q('Specific', 60, 676, 140, 700), q('gravity', 152, 680, 228, 704), q('1.005', 942, 681, 998, 698), q('1.030', 1026, 681, 1082, 698),
    q('SAMPLE', 700, 560, 1100, 760),                                                   // watermark: far taller than a row
  ];
  assert.deepEqual(dateRegion(W2).box, [235, 300, 420, 350]);                           // starts after the label, not on its colon
  assert.equal(valueRegion(W2, 'Sugar', 'Nil').how, 'column');                          // not the Nil in the range column
  assert.ok(valueRegion(W2, 'Sugar', 'Nil').box[2] <= 940);
  assert.deepEqual(rangeRegion(W2, 'Specific gravity').box, [942, 681, 1082, 698]);     // the watermark is not part of the row
});

test('a date with no readable label: the one word shaped like a date with a four-digit year', () => {
  const only = [q('Daze', 60, 300, 120, 330), q('2083/08/17', 235, 300, 420, 350), q('1-0-1', 300, 500, 380, 530), q('Rx', 60, 400, 90, 420)];
  assert.deepEqual(dateRegion(only).box, [235, 300, 420, 350]);
  assert.equal(dateRegion(only).how, 'shape');
  assert.equal(dateRegion([q('1-0-1', 300, 500, 380, 530), q('1/2-0-1/2', 300, 540, 420, 570)]), null);                 // doses are not dates
  assert.equal(dateRegion([q('22/11/2026', 235, 300, 420, 350), q('25/11/2026', 235, 800, 420, 850)]), null);           // two candidates: no guess
  const nep = [q('मिति', 60, 300, 120, 330), q('२०८३', 235, 300, 300, 350), q('मंसिर', 310, 300, 400, 350), q('५', 410, 300, 430, 350)];
  assert.deepEqual(dateRegion(nep).box, [235, 300, 430, 350]);                                                          // the Nepali label
});
test('a tilted photo: the row runs down the page, so the column box follows it', () => {
  // the page slopes 0.1 (10 px down per 100 px across); every word's top edge has that slope
  const tilt = (t, x, y, w, h) => [t, [[x, y], [x + w, y + 0.1 * w], [x + w, y + 0.1 * w + h], [x, y + h]]];
  const P = [
    tilt('Result', 520, 440, 80, 30), tilt('Unit', 700, 460, 50, 30), tilt('Reference', 940, 480, 100, 30),
    tilt('TSH', 60, 520, 50, 30), tilt('Protein', 60, 800, 70, 30),
  ];
  const r = valueRegion(P, 'TSH', '2.45');
  assert.equal(r.how, 'column');
  const rowAtResult = 520 + 0.1 * (520 - 85) + 15, rowAtUnit = 520 + 0.1 * (690 - 85) + 15;  // the label's middle, carried along the slope
  assert.ok(r.box[1] < rowAtResult && r.box[3] > rowAtUnit, JSON.stringify(r.box));
});
