// Google Cloud Vision as Abhilekh's second reader (DOCUMENT_TEXT_DETECTION: print and handwriting, Devanagari and Latin).
// Reused from the Chautari reader (github.com/zentrust-inc/chautari, reader/engine-vision.mjs): visionLines() is copied
// unchanged; the call is the same, but takes the image as bytes. A conventional OCR service from another company than
// Claude, so its mistakes are not Claude's. It returns text lines and word boxes, not fields: it confirms or disputes
// the fields Claude copied (see server/reading.mjs). The word boxes are the regions of the original (regions.mjs).
// Key: VISION_API_KEY (Azure app setting only). Price: first 1,000 pages a month free, then US$1.50 per 1,000 (2026-11-19).

export function visionLines(words) {
  const W = words.map(([t, v]) => {
    const [a, b, c, d] = v.map(([x, y]) => ({ x: x || 0, y: y || 0 }));
    return { t, a, b, c, d, w: Math.hypot(b.x - a.x, b.y - a.y), h: Math.hypot(d.x - a.x, d.y - a.y) };
  }).filter((w) => w.t);
  if (!W.length) return [];
  // the page's slant: median angle of the top edges of the longer words
  const angs = W.filter((w) => w.w > w.h).map((w) => Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x)).sort((p, q) => p - q);
  const th = angs.length ? angs[Math.floor(angs.length / 2)] : 0;
  const cos = Math.cos(th), sin = Math.sin(th);
  const rot = (p) => ({ x: p.x * cos + p.y * sin, y: -p.x * sin + p.y * cos });
  for (const w of W) {
    const pts = [w.a, w.b, w.c, w.d].map(rot);
    const ys = pts.map((p) => p.y), xs = pts.map((p) => p.x);
    w.y0 = Math.min(...ys); w.y1 = Math.max(...ys); w.ym = (w.y0 + w.y1) / 2; w.x0 = Math.min(...xs); w.x1 = Math.max(...xs);
    w.hh = w.y1 - w.y0;
  }
  // typical text height; much taller words (a slanted watermark) would join rows together, so they go
  const hs = W.map((w) => w.hh).sort((p, q) => p - q);
  const H = hs[Math.floor(hs.length / 2)] || 1;
  const T = W.filter((w) => w.hh <= 2.2 * H).sort((p, q) => p.ym - q.ym);
  const rows = [];
  for (const w of T) {
    let best = null, dist = Infinity;
    for (const r of rows) { const dd = Math.abs(r.ym - w.ym); if (dd <= 0.55 * H && dd < dist) { best = r; dist = dd; } }
    if (best) { best.w.push(w); best.ym = best.w.reduce((s, x) => s + x.ym, 0) / best.w.length; }
    else rows.push({ ym: w.ym, h: H, w: [w] });
  }
  rows.sort((p, q) => p.ym - q.ym);
  const num = /^[0-9०-९][0-9०-९,./-]*$/;
  return rows.map((r) => {
    r.w.sort((p, q) => p.x0 - q.x0);
    let out = '', prev = null;
    for (const w of r.w) {
      if (prev) {
        const gap = w.x0 - prev.x1;
        const glue = gap < r.h * 0.45 && ((num.test(prev.t) && num.test(w.t)) || /^[,/.:)-]/.test(w.t) || /[(/,-]$/.test(prev.t));
        out += glue ? '' : gap > r.h * 1.2 ? '  ' : ' ';
      }
      out += w.t; prev = w;
    }
    return out;
  });
}


export async function readVisionBytes(buf, fetchImpl = fetch) {
  const key = process.env.VISION_API_KEY;
  if (!key) throw new Error('VISION_API_KEY is not set');
  const body = { requests: [{ image: { content: buf.toString('base64') }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }], imageContext: { languageHints: ['ne', 'hi', 'en'] } }] };
  for (let attempt = 0; ; attempt++) {
    const res = await fetchImpl('https://vision.googleapis.com/v1/images:annotate', { method: 'POST', headers: { 'x-goog-api-key': key, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) {
      const resp = (await res.json()).responses?.[0] ?? {};
      if (resp.error) throw new Error(`vision: ${resp.error.message}`);
      const words = [];
      for (const p of resp.fullTextAnnotation?.pages ?? []) for (const bl of p.blocks) for (const pa of bl.paragraphs) for (const w of pa.words)
        words.push([w.symbols.map((s) => s.text).join(''), w.boundingBox.vertices.map((q) => [q.x || 0, q.y || 0])]);
      return { data: { words, lines: visionLines(words) }, usd: 0.0015, model: 'google-vision' };
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 3) { await new Promise((r) => setTimeout(r, 3000 * (attempt + 1))); continue; }
    throw new Error(`vision: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
}
