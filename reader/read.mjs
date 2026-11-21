// Read every image in a folder with one engine and save the readings (a JSON cache, so scoring can be
// re-run without calling the service again). Stops before spending more than BUDGET_USD.
// Usage: node read.mjs <claude|gemini> <images dir...> --out <readings.json> [--budget 1.00]
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { readClaude, readGemini, usage } from './engines.mjs';

const args = process.argv.slice(2);
const engine = args.shift();
const out = args[args.indexOf('--out') + 1];
const budget = args.includes('--budget') ? +args[args.indexOf('--budget') + 1] : 1.0;
const dirs = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out' && args[i - 1] !== '--budget');
// 'vision' reuses the Chautari reader's Google Cloud Vision engine (text lines and word boxes, no JSON):
// CHAUTARI_READER_DIR points to a checkout of zentrust-inc/chautari/reader; key VISION_API_KEY.
async function readVision(file) {
  const v = await import(`${process.env.CHAUTARI_READER_DIR}/engine-vision.mjs`);
  // words with their four corners are kept next to the lines: they are the regions of the original (rule 3), see regions.mjs
  const words = await v.readWords(file);
  return { lines: v.visionLines(words), words };
}
const read = { claude: readClaude, gemini: readGemini, vision: readVision }[engine];
if (!read || !out) { console.error('usage: node read.mjs <claude|gemini> <dir...> --out file.json'); process.exit(1); }

const cache = existsSync(out) ? JSON.parse(await readFile(out, 'utf8')) : {};
const spent = () => usage.reduce((s, u) => s + u.usd, 0);
for (const dir of dirs) {
  for (const f of (await readdir(dir)).filter((n) => /\.(png|jpe?g)$/i.test(n)).sort()) {
    const keyName = `${basename(dir)}/${f}`;
    if (cache[keyName]) continue;
    if (spent() >= budget) { console.error(`budget ${budget} reached, stopping`); break; }
    try { cache[keyName] = await read(join(dir, f)); console.log('read', keyName); }
    catch (e) { cache[keyName] = { error: String(e.message).slice(0, 200) }; console.log('FAILED', keyName, e.message.slice(0, 120)); }
    await writeFile(out, JSON.stringify(cache, null, 1));
  }
}
console.log(`spent about USD ${spent().toFixed(3)} on ${usage.length} pages`);
