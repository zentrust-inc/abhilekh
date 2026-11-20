# Reader (planning stage)

Copies a photographed prescription or lab report into JSON: date, facility, clinician, patient name, result rows (test, value, unit, printed range, printed flag), medicine lines as written, and printed notes. It copies; it never interprets, adds a range or flag, or maps a brand to a generic.

Reused from the Chautari reader (github.com/zentrust-inc/chautari, `reader/`, commit 1dcb947): the Claude and Gemini API calls, price tables and the rule that two readers from different companies must agree before a value is pre-ticked. New here: the medical-document prompt (`prompt.mjs`) and the scorer (`score.mjs`).

| File | What it does |
|---|---|
| `prompt.mjs` | The single instruction every reader gets |
| `engines.mjs` | `readClaude`, `readGemini` (keys from `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`; never commit a key). `read.mjs vision` reuses Chautari's Google Cloud Vision engine (`CHAUTARI_READER_DIR`, `VISION_API_KEY` from Key Vault) as the confirming second reader |
| `read.mjs` | Reads a folder of images with one engine into a readings cache; stops at a budget (default USD 1.00) |
| `medicine-check.mjs` | Checks a copied medicine name against `dda/nlem-2021.json` (DDA essential-medicines list 2021): exact match only, never a closest guess; not found means shown as written and flagged |
| `score.mjs` | Compares one or more readings caches with a test set's answer key; with two or more, applies the agreement rule and counts wrong ticks |

```bash
node reader/read.mjs claude samples/test-set-v1/clean samples/test-set-v1/photo --out samples/test-set-v1/readings/claude-opus-5-5.json
CHAUTARI_READER_DIR=../chautari/reader node reader/read.mjs vision samples/test-set-v1/clean samples/test-set-v1/photo --out samples/test-set-v1/readings/google-vision.json
node reader/score.mjs samples/test-set-v1 samples/test-set-v1/readings/claude-opus-5-5.json samples/test-set-v1/readings/google-vision.json --out samples/test-set-v1/SCORE.md
```

Only fictional SAMPLE pages may be sent to these services until the lawyer's review (see CLAUDE.md).
