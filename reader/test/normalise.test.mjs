import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sameDose, sameDur, durOf, same, hasDecimalPoint, mustConfirmValue } from '../normalise.mjs';

test('doses: spacing, dashes and a bracketed gloss do not matter; a different dose does', () => {
  assert.ok(sameDose('1 - 0 - 1', '1-0-1'));
  assert.ok(sameDose('1–0–1', '1-0-1'));
  assert.ok(sameDose('TDS (3 times a day)', 'tds'));
  assert.ok(sameDose('१-०-१', '1-0-1'));          // Devanagari digits are the same digits
  assert.ok(!sameDose('1-0-1', '1-1-1'));
  assert.ok(!sameDose('1-0-0', '0-0-1'));
  assert.ok(!sameDose('TDS', '1-1-1'));            // a rewrite of one notation into another is interpretation
  assert.ok(!sameDose('SOS', ''));
});
test('durations: the number must match; usual spellings of the unit are one unit', () => {
  assert.ok(sameDur('x 14 days', '14 days'));
  assert.ok(sameDur('5 d', '5 days'));
  assert.ok(sameDur('2 mo', '2 months'));
  assert.ok(sameDur('x 1 month', '1 month'));
  assert.ok(sameDur('५ दिन', '5 days'));
  assert.ok(sameDur('५ दिन', '५ दिन'));
  assert.ok(!sameDur('5 days', '6 days'));
  assert.ok(!sameDur('3 days', '9 days'));
  assert.ok(!sameDur('2 months', '2 weeks'));
  assert.ok(!sameDur('14 days', ''));
});
test('durations: text that is not number + unit is compared as written', () => {
  assert.equal(durOf('till review'), 'tillreview');
  assert.ok(!sameDur('till review', '5 days'));
});
test('values still compare as numbers or characters (unchanged from v1)', () => {
  assert.ok(same('2,56,000', '256000'));
  assert.ok(same('6.6', '6.60'));
  assert.ok(!same('11.8', '11.6'));
});

import { doseSlots, confirmsDose } from '../normalise.mjs';
test('dose confirmation: lost or merged dashes are fine, the digits must be the same in the same order', () => {
  assert.equal(doseSlots('1 - 0 - 1'), '101');
  assert.equal(doseSlots('१-०-१'), '101');
  assert.equal(doseSlots('SOS'), null);
  assert.equal(doseSlots('0.5-0-0.5'), null);
  assert.ok(confirmsDose('1. Tab Metformin 500 mg 1-01  X 1 month', '1-0-1'));
  assert.ok(confirmsDose('2. Tab Enalapril 5 mg 1-00  x 2 months', '1-0-0'));
  assert.ok(confirmsDose('1. Tab Azithromycin 500 mg 100  x3days', '1-0-0'));
  assert.ok(confirmsDose('1. Tab Ramipril 5 mg  10-0  X1 month', '1-0-0'));
  assert.ok(confirmsDose('2. Tab Clarithromycin 500 mg 1-0-1  x 14 days', '1-0-1'));
  assert.ok(confirmsDose('2. Tab Prednisolone 5 mg  2 + 1 + 0  X5 days', '2-1-0'));
});
test('dose confirmation: a different dose, a strength or a duration never confirms', () => {
  assert.ok(!confirmsDose('3. Tab cetirizine 10 mg  0-04  x 5 days', '0-0-1'));   // 4 is not 1
  assert.ok(!confirmsDose('1. Tab ciprofloxacin 500 mg 2-0-2  5 days', '1-0-1'));
  assert.ok(!confirmsDose('1. Tab Pantoprazole 40 mg 1-0-  x 14 days', '1-0-1')); // digit lost
  assert.ok(!confirmsDose('Tab Paracetamol 100 mg  x 5 days', '1-0-0'));        // 100 is the strength
  assert.ok(!confirmsDose('Tab Foo 500 mg  x 10 1', '5-0-0'));                    // strength is not a dose
  assert.ok(!confirmsDose('Tab Foo  x 1-0-1 days', '1-0-1'));                     // after x: a duration
  assert.ok(!confirmsDose('Tab Foo 500 mg  for 101 days', '1-0-1'));
  assert.ok(!confirmsDose('Tab Foo 100d', '1-0-0'));                              // stuck to a letter
  assert.ok(!confirmsDose('Tab Foo 500 mg 1-0-1', 'TDS'));                        // not a digit dose
  assert.ok(!confirmsDose('', '1-0-1'));
});

test('a fraction in a dose is not its digits run together: 1/2-0-1/2 is not 12-0-12', () => {
  assert.ok(!sameDose('1/2-0-1/2', '12-0-12'));
  assert.ok(sameDose('1/2 - 0 - 1/2', '1/2-0-1/2'));
  assert.ok(sameDose('1/2-0-1/2', '१/२-०-१/२'));
  assert.ok(same('2083/08/10', '20830810'));   // dates and values are compared as before
});

test('must confirm: a decimal point in the value or in the printed range, not only in the reading', () => {
  assert.ok(hasDecimalPoint('1.020') && hasDecimalPoint('2.45') && hasDecimalPoint('.5') && hasDecimalPoint('१.५'));
  assert.ok(!hasDecimalPoint('1020') && !hasDecimalPoint('2-4') && !hasDecimalPoint('7,500') && !hasDecimalPoint('Nil') && !hasDecimalPoint(''));
  assert.ok(mustConfirmValue('1.020', '1.020'));
  assert.ok(mustConfirmValue('1020', '1.005 - 1.030'));     // the v3 miss: both readers lost the dot, the printed range still shows one
  assert.ok(mustConfirmValue('1020', '1020', undefined, '1.005-1.030'));
  assert.ok(!mustConfirmValue('140', '135 - 145'));
  assert.ok(!mustConfirmValue('Nil', undefined, ''));
});
