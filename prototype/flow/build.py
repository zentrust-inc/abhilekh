#!/usr/bin/env python3
"""Rebuild prototype/flow/index.html. Run from the repo root:
   python3 prototype/flow/build.py <path to qrcode.js>
Uses the saved readings (Claude Opus + Google Vision) and the saved Vision word boxes of test set v3.
Nothing is read live. Crops are cut from the original pages, which are never changed."""
import base64, io, json, subprocess, sys
from PIL import Image
S = 'samples/test-set-v3/'
PAGES = [('L21c', 'clean/L21-urine-text-results.png', 'Urine report', 'Sample page, clean scan'),
         ('L22c', 'clean/L22-thyroid-coffee-bleed.png', 'Thyroid report', 'Sample page, clean scan'),
         ('L22p', 'photo/L22-thyroid-coffee-bleed.jpg', 'Thyroid report (phone photo)', 'Sample page, harder: coffee ring over two values')]
fields = json.loads(subprocess.check_output(['node', 'prototype/flow/decide.mjs'] + [p[1] for p in PAGES]))
lib = open(sys.argv[1], encoding='utf8').read()
def b64(im, fmt='PNG', **kw):
    b = io.BytesIO(); im.save(b, fmt, **kw); return 'data:image/%s;base64,%s' % (fmt.lower().replace('jpeg', 'jpeg'), base64.b64encode(b.getvalue()).decode())
def crop(im, reg, wide=20, vpad=12):
    if not reg: return None
    x0, y0, x1, y1 = reg['box']
    if reg['how'] == 'column': x1 = max(x1, 900)
    return b64(im.crop((max(0, int(x0 - wide)), max(0, int(y0 - vpad)), min(im.width, int(x1 + wide)), min(im.height, int(y1 + vpad)))), 'PNG', optimize=True)
O = json.load(open(S + 'readings/claude-opus-5-5.json'))
pages = []
for (pid, f, title, note), fl in zip(PAGES, fields):
    im = Image.open(S + f).convert('RGB')
    small = im.copy(); small.thumbnail((640, 900))
    th = im.copy(); th.thumbnail((140, 190))
    o = O[f]
    tests = []
    for t in fl['tests']:
        tests.append(dict(test=t['test'], value=t['value'], unit=t['unit'], range=t['range'], flag=t['flag'],
                          vimg=crop(im, t['vregion']), vapprox=bool(t['vregion'] and t['vregion']['how'] != 'matched'), rimg=crop(im, t['rregion'], vpad=8)))
    d = fl['date']
    pages.append(dict(id=pid, title=title, note=note, facility=o.get('facility') or '', patient=o.get('patient_name') or '',
                      thumb=b64(th, 'JPEG', quality=60), full=b64(small, 'JPEG', quality=72), tests=tests,
                      date=dict(img=crop(im, d['region'], wide=16, vpad=14))))
t = open('prototype/flow/template.html', encoding='utf8').read()
t = t.replace('__QRLIB__', lib.replace('</script>', '<\\/script>')).replace('__DATA__', json.dumps(dict(pages=pages), ensure_ascii=False))
open('prototype/flow/index.html', 'w', encoding='utf8').write(t)
for p in pages:
    print(p['id'], [(x['test'], x['value']['state'], x['unit']['state'], x['range']['state'], x['flag']['state'], bool(x['vimg'])) for x in p['tests']], bool(p['date']['img']))
