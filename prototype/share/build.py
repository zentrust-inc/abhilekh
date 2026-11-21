#!/usr/bin/env python3
"""Rebuild prototype/share/index.html: inlines the QR library (MIT, qrcode-generator 2.0.4),
the sample results from the answer key (L21, L22) and crops of each result cell cut from the
original pages at the regions reader/regions.mjs finds in the saved Vision words.
Run from the repo root after `npm i --prefix /tmp/qr qrcode-generator`:  python3 prototype/share/build.py /tmp/qr/node_modules/qrcode-generator/dist/qrcode.js"""
import base64, io, json, subprocess, sys
from PIL import Image
S = 'samples/test-set-v3/'
lib = open(sys.argv[1], encoding='utf8').read()
key = {d['id']: d for d in json.load(open(S + 'answer_key.json'))['documents']} if isinstance(json.load(open(S + 'answer_key.json')), dict) and 'documents' in json.load(open(S + 'answer_key.json')) else {d['id']: d for d in json.load(open(S + 'answer_key.json'))}
node = r"""
import {readFileSync} from 'node:fs';
import {valueRegion} from './reader/regions.mjs';
const S='samples/test-set-v3/readings/';
const W=JSON.parse(readFileSync(S+'google-vision-words.json','utf8'));
const O=JSON.parse(readFileSync(S+'claude-opus-5-5.json','utf8'));
const out={};
for(const f of ['clean/L21-urine-text-results.png','clean/L22-thyroid-coffee-bleed.png']){out[f]={};
 for(const x of O[f].results){out[f][x.test]=valueRegion(W[f].words,x.test,x.value);}}
console.log(JSON.stringify(out));
"""
regs = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', node]))
def crop(page, box, how):
    im = Image.open(S + page).convert('RGB'); x0, y0, x1, y1 = box
    if how == 'column': x1 = max(x1, 900)  # handwriting can run past the Result column (e.g. Pale yellow)
    c = im.crop((max(0, int(x0 - 20)), max(0, int(y0 - 12)), min(im.width, int(x1 + 20)), min(im.height, int(y1 + 12))))
    b = io.BytesIO(); c.save(b, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()
titles = {'L21': 'Urine report', 'L22': 'Thyroid report'}
docs = []
for did in ('L21', 'L22'):
    d = key[did]; page = d['file_clean']
    rs = []
    for r in d['results']:
        reg = regs[page].get(r['test'])
        rs.append(dict(test=r['test'], value=r['value'], unit=r['unit'], range=r['reference_range'], flag=r['flag_printed'], img=crop(page, reg['box'], reg['how']) if reg else None))
    docs.append(dict(id=did, title=titles[did], facility=d['facility'], patient=d['patient']['name'], date=d['date']['as_written'], date_as_written=d['date']['as_written'], results=rs))
t = open('prototype/share/template.html', encoding='utf8').read()
t = t.replace('__QRLIB__', lib.replace('</script>', '<\\/script>')).replace('__DATA__', json.dumps(dict(docs=docs), ensure_ascii=False))
open('prototype/share/index.html', 'w', encoding='utf8').write(t)
print({d['id']: [(r['test'], bool(r['img'])) for r in d['results']] for d in docs})
# The share server (server/) serves the same invented sample record, so it is written next to the page.
open('server/data/sample-record.json', 'w', encoding='utf8').write(json.dumps(dict(docs=docs), ensure_ascii=False))
