// Two readers from two companies, adapted from the Chautari reader
// (github.com/zentrust-inc/chautari, reader/engine-claude.mjs and engine-gemini.mjs, commit 1dcb947).
// The API calls and price tables are the same; the prompt asks for a copy of a medical document as JSON.
// Keys come from the environment only: ANTHROPIC_API_KEY, GEMINI_API_KEY. Never commit a key.
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { PROMPT } from './prompt.mjs';
import { legacy } from './copy.mjs';

// USD per million tokens [input, output], as listed in the Chautari reader on 2026-11-19 (cost report only)
export const PRICES = { 'claude-opus-5-5': [4, 20], 'claude-sonnet-5-5': [2, 10], 'gemini-3.8-flash': [0.75, 3.75] };
export const usage = [];
const media = (f) => ({ '.png': 'image/png', '.webp': 'image/webp' }[extname(f).toLowerCase()] || 'image/jpeg');
const cost = (model, i, o) => { const [pi, po] = PRICES[model] ?? [0, 0]; return (i * pi + o * po) / 1e6; };

export function parseJson(text) {
  const s = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  return JSON.parse(s);
}

async function retry(fn) {
  for (let a = 0; ; a++) {
    const r = await fn();
    if (r.ok) return r.json();
    if ((r.status === 429 || r.status >= 500) && a < 4) { await new Promise((ok) => setTimeout(ok, 4000 * (a + 1))); continue; }
    throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  }
}

// Bytes versions, used by the app (server/reading.mjs): the image is passed in memory, never written to disk.
// Each returns { data, usd }: the copy of the paper and what that one call cost.
export async function readClaudeBytes(buf, mime, model = 'claude-opus-5-5', fetchImpl = fetch) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set');
  const j = await retry(() => fetchImpl('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 8000, messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', media_type: mime, data: buf.toString('base64') } }, { type: 'text', text: PROMPT }] }] }),
  }));
  const u = j.usage ?? {};
  const usd = cost(model, u.input_tokens ?? 0, u.output_tokens ?? 0);
  usage.push({ model, usd });
  const full = parseJson((j.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('\n'));
  return { data: legacy(full), full, usd, model }; // data: the check-screen fields; full: the whole copy of the page (copy.mjs)
}

export async function readGeminiBytes(buf, mime, model = 'gemini-3.8-flash', fetchImpl = fetch) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const j = await retry(() => fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: mime, data: buf.toString('base64') } }, { text: PROMPT }] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' } }),
  }));
  const u = j.usageMetadata ?? {};
  const usd = cost(model, u.promptTokenCount ?? 0, (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0));
  usage.push({ model, usd });
  const full = parseJson((j.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('\n'));
  return { data: legacy(full), full, usd, model };
}

export async function readClaude(file, model = 'claude-opus-5-5') {
  return (await readClaudeBytes(await readFile(file), media(file), model)).data;
}

export async function readGemini(file, model = 'gemini-3.8-flash') {
  return (await readGeminiBytes(await readFile(file), media(file), model)).data;
}
