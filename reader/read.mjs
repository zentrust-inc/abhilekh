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
const read = { claude: readClaude, gemini: readGemini }[engine];
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
