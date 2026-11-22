import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Load public/i18n.js with a tiny stand-in for the browser, language set to Nepali.
function load() {
  const store = { abhLang: 'ne' };
  const doc = { readyState: 'complete', documentElement: {}, body: { nodeType: 1, nodeName: 'BODY', childNodes: [], hasAttribute: () => false }, title: '', querySelectorAll: () => [], addEventListener() {} };
  const win = { dispatchEvent() {} };
  const ctx = { window: win, document: doc, localStorage: { getItem: k => store[k], setItem: (k, v) => { store[k] = v; } }, navigator: { language: 'en' }, MutationObserver: class { observe() {} }, Event: class {} };
  ctx.window = Object.assign(win, ctx);
  vm.runInNewContext(readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8'), ctx);
  return win.i18n;
}
const i18n = load();
const hasDevanagari = s => /[ऀ-ॿ]/.test(s);

test('exact lines are translated and keep their surrounding spaces', () => {
  assert.ok(hasDevanagari(i18n.tr('Sign out')));
  assert.equal(i18n.tr('  Sign out '), '  ' + i18n.tr('Sign out') + ' ');
});

test('lines with a number, name or time are translated and keep it', () => {
  const a = i18n.tr('Wrong PIN. 4 tries left before a 15-minute wait.');
  assert.ok(hasDevanagari(a) && a.includes('4') && a.includes('15'));
  assert.ok(i18n.tr('Papers of Aama').startsWith('Aama'));
  assert.ok(i18n.tr('3 active shares').startsWith('3'));
  assert.ok(i18n.tr('until Nov 23, 08:47 PM').startsWith('Nov 23, 08:47 PM'));
  assert.ok(hasDevanagari(i18n.tr('Nov 22, 08:47 PM · You stopped this share.')));
  assert.ok(i18n.tr('Nov 22, 08:47 PM · You stopped this share.').startsWith('Nov 22, 08:47 PM · '));
});

test('what the paper says is never translated', () => {
  for (const s of ['Urine report', 'Namuna Clinical Laboratory (fictional) · 24/11/2026', 'Pale yellow', '/HPF', 'H', 'SAMPLE']) assert.equal(i18n.tr(s), s);
});

test('every fixed error message the server can send to the patient has Nepali text', () => {
  const missing = [];
  for (const f of ['../server.mjs', '../auth.mjs', '../passkey.mjs']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    // only messages written as one plain string; messages built from parts are covered by patterns above
    for (const m of src.matchAll(/error: '((?:[^'\\]|\\.)*)'\s*[,}]/g)) {
      const msg = m[1].replace(/\\'/g, "'");
      if (/^(Passkey|Google sign-in failed)|refused|not found$|failed:/.test(msg)) continue; // diagnostics for the log
      if (!hasDevanagari(i18n.tr(msg))) missing.push(msg);
    }
  }
  assert.deepEqual(missing, []);
});

test('Nepali text has no stray joiners and no split words', () => {
  const src = readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8');
  assert.ok(!/[‌‍]/.test(src), 'zero-width joiner or non-joiner found');
  // a space right before a vowel sign or virama means a word was split, like "फे रि" or "के ही"
  assert.ok(!/[ऀ-ॿ] [ा-्]/.test(src), 'a Devanagari word is split by a space');
});

test('agreed terms are used', () => {
  assert.equal(i18n.tr('Active'), 'सक्रिय');
  assert.equal(i18n.tr('Time ran out'), 'म्याद सकियो');
  assert.equal(i18n.tr('Stopped by you'), 'तपाईंले रोक्नुभएको');
  assert.equal(i18n.tr('Try again'), 'पुनः प्रयास गर्नुहोस्');
  assert.equal(i18n.tr('My papers'), 'मेरा कागजात');
  assert.equal(i18n.tr('Photograph a paper'), 'कागजको फोटो खिच्नुहोस्');
  assert.ok(i18n.tr('3 papers').startsWith('3 कागजात'));
  assert.ok(!i18n.tr('Sign in and share with your fingerprint or face instead of typing a PIN. Your device does the check; Abhilekh never sees it.').includes('कागज'));
});
