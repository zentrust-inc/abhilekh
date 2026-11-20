import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sameDose, sameDur, durOf, same } from '../normalise.mjs';

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
