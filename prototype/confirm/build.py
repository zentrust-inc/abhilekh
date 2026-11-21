#!/usr/bin/env python3
"""Rebuild index.html's CARDS from the real regions (reader/regions.mjs on the
saved Vision words). Run from the repo root: python3 prototype/confirm/build.py
Crops are cut from the original page images (never modified) with padding.
A region that is null makes the card show the whole page row band instead, and says so."""
import base64, io, json, re, subprocess, sys
from PIL import Image
S = 'samples/test-set-v3/'
PAD = 14
node = r"""
import {readFileSync} from 'node:fs';
import {valueRegion,rangeRegion,dateRegion} from './reader/regions.mjs';
const S='samples/test-set-v3/readings/';
const W=JSON.parse(readFileSync(S+'google-vision-words.json','utf8'));
const O=JSON.parse(readFileSync(S+'claude-opus-5-5.json','utf8'));
const want={'clean/L21-urine-text-results.png':['Specific gravity'],'clean/L22-thyroid-coffee-bleed.png':['TSH','Free T4'],'clean/P27-devanagari-weeks-months.png':[]};
const out={};
for(const [f,tests] of Object.entries(want)){const words=W[f].words;out[f]={date:dateRegion(words),values:[]};
 for(const t of tests){const x=O[f].results.find(r=>r.test===t);out[f].values.push({test:t,reading:x.value,v:valueRegion(words,t,x.value),r:rangeRegion(words,t)});}}
console.log(JSON.stringify(out));
"""
regs = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', node]))
def crop(page, box, wide=0, vpad=PAD):
    im = Image.open(S + page).convert('RGB')
    x0, y0, x1, y1 = box
    b = (max(0, int(x0 - PAD - wide)), max(0, int(y0 - vpad)), min(im.width, int(x1 + PAD + wide)), min(im.height, int(y1 + vpad)))
    c = im.crop(b)
    buf = io.BytesIO(); c.save(buf, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode(), b
names = {'clean/L21-urine-text-results.png': ('L21', 'urine'), 'clean/L22-thyroid-coffee-bleed.png': ('L22', 'thyroid'), 'clean/P27-devanagari-weeks-months.png': ('P27', 'rx')}
cards, log = [], []
for page, r in regs.items():
    tag, doc = names[page]
    d = r['date']
    if d:
        img, b = crop(page, d['box'], wide=16)
        cards.append(dict(id=tag + '-date', doc=doc, label='date', kind='date', reading='', img=img)); log.append((tag, 'date', d['how'], b))
    else: sys.exit('no date region for ' + page)
    for v in r['values']:
        if not (v['v'] and v['r']): sys.exit('missing region for ' + v['test'])
        i1, b1 = crop(page, v['v']['box'], wide=40, vpad=PAD); i2, b2 = crop(page, v['r']['box'], wide=40)
        cards.append(dict(id=tag + '-' + re.sub(r'\W+', '', v['test']).lower(), doc=doc, label=v['test'], kind='value', reading=v['reading'], img=i1, img2=i2, approx=(v['v']['how'] != 'matched')))
        log.append((tag, v['test'], v['v']['how'] + '/' + v['r']['how'], b1))
html = open('prototype/confirm/index.html', encoding='utf8').read()
html = re.sub(r'const CARDS=\[.*?\];\n', lambda m: 'const CARDS=' + json.dumps(cards, ensure_ascii=False) + ';\n', html, count=1, flags=re.S)
html = html.replace('The crops were cut by hand for this prototype; the reader does not save regions yet.', 'Each crop is cut from the original page at the region the reader found (word boxes), with a margin.')
open('prototype/confirm/index.html', 'w', encoding='utf8').write(html)
for l in log: print(l)
