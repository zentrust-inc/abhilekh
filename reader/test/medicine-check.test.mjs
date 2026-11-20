import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadList, checkMedicine, namePart } from '../medicine-check.mjs';

const list = loadList(new URL('../dda/nlem-2021.json', import.meta.url).pathname);

test('form and strength are removed, the name is kept as written', () => {
  assert.equal(namePart('Tab Metformin 500 mg'), 'metformin');
  assert.equal(namePart('Syp Paracetamol (250 mg/5 ml)'), 'paracetamol');
  assert.equal(namePart('Cap. Neurozen-Forte'), 'neurozen');
});
test('a single name never matches a combination product', () => {
  assert.equal(checkMedicine('T. Losartan 50', list).entry, 'losartan');
});
test('invented or unlisted names are not found, never mapped to something close', () => {
  for (const n of ['T. Glucozen 500', 'Cap. Neurozen-Forte', 'Tab Glucoze 500', 'Tab Metformen 500 mg']) {
    assert.equal(checkMedicine(n, list).status, 'not_found', n);
  }
});
test('salt and synonym forms on the list are found', () => {
  assert.equal(checkMedicine('Zinc 20 mg dispersible tab', list).entry, 'zinc sulfate');
  assert.equal(checkMedicine('Tab Aspirin 75 mg', list).entry, 'acetylsalicylic acid (aspirin)');
  assert.equal(checkMedicine('ORS', list).entry, 'oral rehydration salts');
});
