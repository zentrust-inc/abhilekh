// How a medicine line is shown (decided 25 Nov 2026): form word apart, generic only from an exact register match. SAMPLE brands.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const win = {};
vm.runInNewContext(readFileSync(new URL('../public/medline.js', import.meta.url), 'utf8'), { window: win });
const M = win.medline;
const reg = (o = {}) => ({ version: '2026-11-25', key: 'samplol', mixed: false, strengthMatched: true,
  products: [{ registered: 'SAMPLOL 5', generics: ['SAMPLOLOL HYDROCHLORIDE'], strength: '5 mg', form: 'TABLET', manufacturer: 'Namuna Pharma (SAMPLE)', valid: true }], ...o });

test('the form word in front is shown as the form; the rest is the medicine; nothing else changes', () => {
  assert.deepEqual({ ...M.split('T. Samplol 5 mg') }, { prefix: 'T.', form: 'Tablet', name: 'Samplol 5 mg' });
  assert.deepEqual({ ...M.split('Tab Samplol 5 mg') }, { prefix: 'Tab', form: 'Tablet', name: 'Samplol 5 mg' });
  assert.deepEqual({ ...M.split('Cap. Namunacap 20') }, { prefix: 'Cap.', form: 'Capsule', name: 'Namunacap 20' });
  assert.deepEqual({ ...M.split('Samplol 5 mg') }, { prefix: '', form: '', name: 'Samplol 5 mg' });
  assert.deepEqual({ ...M.split('Tamsample 0.4') }, { prefix: '', form: '', name: 'Tamsample 0.4' });   // a name that starts with T is not a form word
});

test('the generic comes only from an exact register match, with the strength only when it matched', () => {
  assert.equal(M.generic(reg()), 'Samplolol hydrochloride 5 mg');
  assert.equal(M.generic(reg({ strengthMatched: false })), 'Samplolol hydrochloride');
  assert.equal(M.generic(reg({ mixed: true })), '');
  assert.equal(M.generic(null), '');
  assert.equal(M.form(reg(), M.split('T. Samplol 5 mg')), 'Tablet');
  assert.equal(M.form(null, M.split('Syp. Namuna 5 ml')), 'Syrup');
});

test('how often: picked from the list as written, anything else goes under Other', () => {
  assert.equal(M.doseOption('od'), 'OD');
  assert.equal(M.doseOption('1 - 0 - 1'), '1-0-1');
  assert.equal(M.doseOption('1 tab at night'), '');
});
