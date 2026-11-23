"""Assemble film/story-v3/index.html: one self-contained page.

Inputs: src.html (layout, styles, timeline), the site's illustrations
(site-next/*.html, for the characters and props so they stay the same people),
the site's embedded fonts, and GSAP (npm package `gsap`, inlined).
Usage: python3 build.py [path/to/gsap.min.js]
"""
import os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(HERE, '..', '..', 'site-next')
GSAP = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'node_modules', 'gsap', 'dist', 'gsap.min.js')


def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


def balanced_g(s, start):
    depth = 0
    for m in re.finditer(r'<g\b[^>]*>|</g>', s[start:]):
        depth += -1 if m.group(0).startswith('</') else 1
        if depth == 0:
            return s[start:start + m.end()]
    raise ValueError('unbalanced')


def scene_svg(page, n):
    t = read(os.path.join(SITE, page))
    i = t.find(f'class="scene {n}"')
    return t[t.rfind('<svg', 0, i):t.find('</svg>', i) + 6]


def part(page, n, cls):
    svg = scene_svg(page, n)
    m = re.search(r'<g [^>]*class="%s"' % re.escape(cls), svg)
    return balanced_g(svg, m.start())


def inner(g):
    return g[g.find('>') + 1:g.rfind('</g>')]


def rig_arm(body):
    """Wrap the right arm (two strokes + hand) in a group that pivots at the shoulder."""
    i = body.find('<path d="M32 -222')
    if i < 0:
        return body
    j = body.find('<circle', i)
    j = body.find('/>', j) + 2
    arm = body[i:j]
    return (body[:i] + '<g transform="translate(32 -222)"><g class="arm" transform="rotate(0)">'
            '<g transform="translate(-32 222)">' + arm + '</g></g></g>' + body[j:])


def who(page, n, cls, x, y, s, flip=False, extra=''):
    body = rig_arm(inner(part(page, n, cls)))
    sx = -s if flip else s
    return (f'<g class="who {cls} {extra}" transform="translate({x} {y})">'
            f'<g class="breath"><g transform="scale({sx} {s})">{body}</g></g></g>')


def main():
    src = read(os.path.join(HERE, 'src.html'))
    fonts = '\n'.join(re.findall(r'@font-face\{[^}]*\}', read(os.path.join(SITE, 'site.css'))))
    s1 = scene_svg('index.html', 'scene-1')
    s1 = re.sub(r'<text[^>]*>A STORY · FICTIONAL FAMILY</text>', '', s1)
    s1 = s1.replace('class="scene scene-1"', 'class="s1art" width="1920" height="1280"')
    bag_defs = re.search(r'<defs>.*?</defs>', s1, re.S).group(0)
    bag = part('index.html', 'scene-1', 'bag')
    qr = read(os.path.join(SITE, 'media', 'qr.svg'))
    qr = qr[qr.find('<svg'):]
    parts = {
        'FONTS': fonts,
        'GSAP': read(GSAP),
        'SCENE1': s1,
        'BAGDEFS': bag_defs,
        'BAG': bag,
        'QR': qr,
        # clinic (Act I)
        'AAMA_CLINIC': who('index.html', 'scene-2', 'who-aama', 560, 880, 1.45),
        'DOC_CLINIC': who('index.html', 'scene-2', 'who-doctor', 1530, 880, 1.45, flip=True),
        # hospital gate
        'SITA_GATE': who('index.html', 'scene-3', 'who-sita', 640, 880, 1.45),
        'AAMA_GATE': who('index.html', 'scene-3', 'who-aama', 1040, 886, 1.25, flip=True),
        # Kathmandu
        'BIKASH': who('index.html', 'scene-4', 'who-bikash', 520, 880, 1.45),
        # Pokhara clinic
        'AAMA_PKR': who('index.html', 'scene-5', 'who-aama', 560, 880, 1.45),
        'DOC_PKR': who('doctors/index.html', 'scene-7', 'who-doctor', 1330, 880, 1.45, flip=True),
    }
    for k, v in parts.items():
        src = src.replace('{{%s}}' % k, v)
    left = re.findall(r'\{\{[A-Z_0-9]+\}\}', src)
    assert not left, left
    with open(os.path.join(HERE, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(src)
    print('index.html', len(src) // 1024, 'KB')


if __name__ == '__main__':
    main()
