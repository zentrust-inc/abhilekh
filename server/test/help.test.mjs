// Help (26 Nov 2026): every line of help.js and the new screens has Nepali; no answer gives advice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const store = { abhLang: 'ne' };
const doc = { readyState: 'complete', documentElement: {}, body: { nodeType: 1, nodeName: 'BODY', childNodes: [], hasAttribute: () => false }, title: '', querySelectorAll: () => [], addEventListener() {} };
const win = { dispatchEvent() {} };
const ctx = { window: win, document: doc, localStorage: { getItem: k => store[k], setItem: (k, v) => { store[k] = v; } }, navigator: { language: 'en' }, MutationObserver: class { observe() {} }, Event: class {} };
ctx.window = Object.assign(win, ctx);
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../public/help.js', import.meta.url), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('../public/i18n.js', import.meta.url), 'utf8'), ctx);
const H = ctx.window.HELP, tr = ctx.window.i18n.tr;
const lines = [...H.faq.flatMap(f => [f.q, ...f.a]), ...H.tips];
const dev = s => /[ऀ-ॿ]/.test(s);

test('every question, answer and photo tip has Nepali text', () => {
  assert.deepEqual(lines.filter(l => !dev(tr(l))), []);
});

test('the new screens have Nepali text', () => {
  const ui = ['Help and questions', 'Delete my account', 'Help', 'Questions and answers', 'How to take a good photo', 'Contact us',
    'Write to us on WhatsApp', 'Type DELETE', 'Delete this paper', 'Remove this SAMPLE page', 'Type DELETE to confirm.',
    'It is gone from the app at once, and from every copy within 30 days. This cannot be undone.',
    'Allergies you told Abhilekh', 'Allergic to (as you would say it)', 'What happened (optional)', 'Shown as told by you, not from a paper', 'None added.', 'Remove',
    'Type what you are allergic to.', 'Told by you on 26 Nov, 08:00'];
  assert.deepEqual(ui.filter(l => !dev(tr(l))), []);
});

test('no answer gives medical advice or interprets a result', () => {
  const advice = /\b(should take|you should|normal range|is normal|is high|is low|consult|recommend|safe to|dangerous|stop taking|dose)\b/i;
  const answers = [...H.faq.flatMap(f => f.a), ...H.tips];       // a question may name the topic; an answer never interprets
  assert.deepEqual(answers.filter(l => advice.test(l)), []);
  const normal = H.faq.find(f => f.id === 'normal').a.join(' ');
  assert.match(normal, /never says what a result means/);
});

test('the answers say what the app really does', () => {
  const all = lines.join(' ');
  assert.match(all, /15 minutes/);                 // share length (server: ALLOWED_MINUTES)
  assert.match(all, /within 30 days/);             // deletion (backup.mjs keepDays)
  assert.match(all, /not kept in Nepal/);          // CLAUDE.md: never claim data stays in Nepal
  assert.match(all, /up to 6 people/);             // family limit (server)
  assert.match(all, /24 hours/);                   // share hold after a PIN reset (auth)
});
