"""Abhilekh story film, draft 2 (rebuilt 23 Nov 2026).

Camera moves over the site's own illustrations (rendered at 4x in stills/),
cut to the Nepali narration. Each shot is its own mp4; join with concat.
Usage: python3 render.py [shot letters]   (default: all)
"""
import math, os, subprocess, sys
from PIL import Image

FPS, OW, OH = 30, 1920, 1080
IVORY = (246, 241, 231)
OV = {n: Image.open(f'ov/{n}.png').convert('RGBA') for n in ('story', 'planned')}
END = Image.open('ov/end.png').convert('RGB')

# (id, scene, start, end, keyframes[(t_rel, cx, cy, w)], planned_from or None)
SHOTS = [
    ('A', 'scene-1', 0.0, 7.5, [(0, .50, .50, 1.0), (7.5, .57, .64, .58)], None),
    ('B', 'scene-2', 7.5, 17.0, [(0, .50, .50, 1.0), (4.8, .55, .52, .86), (6.4, .76, .55, .48), (9.5, .78, .55, .44)], None),
    ('C', 'scene-3', 17.0, 26.5, [(0, .50, .50, 1.0), (9.5, .34, .55, .70)], 3.6),
    ('D', 'scene-7', 26.5, 31.6, [(0, .80, .56, .76), (5.1, .83, .56, .68)], None),
    ('E', 'scene-3', 31.6, 42.5, [(0, .78, .52, .78), (2.0, .83, .51, .70), (6.4, .83, .51, .70), (7.6, .83, .52, .40), (10.9, .83, .52, .37)], None),
    ('F', 'scene-4', 42.5, 48.8, [(0, .50, .50, 1.0), (6.3, .72, .52, .72)], 0.4),
    ('G', 'scene-5', 48.8, 53.7, [(0, .33, .58, .62), (4.9, .40, .56, .54)], None),
    ('H', 'scene-7', 53.7, 60.4, [(0, .35, .58, .76), (6.7, .68, .55, .72)], None),
    ('I', 'scene-5', 60.4, 66.2, [(0, .50, .84, .54), (5.8, .50, .88, .44)], 1.0),
    ('J', 'scene-8', 66.2, 70.8, [(0, .50, .50, 1.0), (4.6, .56, .50, .80)], None),
    ('K', None, 70.8, 79.0, None, None),
]

def ease(x):
    return 0.5 - 0.5 * math.cos(math.pi * max(0.0, min(1.0, x)))

def cam(kf, t):
    if t <= kf[0][0]:
        return kf[0][1:]
    for a, b in zip(kf, kf[1:]):
        if t <= b[0]:
            e = ease((t - a[0]) / (b[0] - a[0]))
            return tuple(a[i] + (b[i] - a[i]) * e for i in (1, 2, 3))
    return kf[-1][1:]

def frame(src, cx, cy, w):
    W, H = src.size
    cw = w * W
    ch = cw * OH / OW
    if ch > H:
        ch = H; cw = ch * OW / OH
    x0 = min(max(cx * W - cw / 2, 0), W - cw)
    y0 = min(max(cy * H - ch / 2, 0), H - ch)
    return src.resize((OW, OH), Image.BICUBIC, box=(x0, y0, x0 + cw, y0 + ch), reducing_gap=2.0)

def alpha_paste(base, ov, a):
    if a <= 0:
        return
    o = ov
    if a < 1:
        o = ov.copy(); o.putalpha(ov.getchannel('A').point(lambda v: int(v * a)))
    base.paste(o, (0, 0), o)

def render(shot):
    sid, scene, t0, t1, kf, planned = shot
    dur = t1 - t0
    n = round(dur * FPS)
    tmp, out = f'shots/{sid}.tmp.mp4', f'shots/{sid}.mp4'
    p = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
                          '-s', f'{OW}x{OH}', '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast',
                          '-crf', '18', '-pix_fmt', 'yuv420p', '-r', str(FPS), tmp], stdin=subprocess.PIPE)
    src = Image.open(f'stills/{scene}.png').convert('RGB') if scene else None
    fin = 0.8 if sid == 'A' else 0.35
    for i in range(n):
        t = i / FPS
        if src is None:
            img = END.copy()
        else:
            img = frame(src, *cam(kf, t))
            alpha_paste(img, OV['story'], 1.0)
            if planned is not None:
                alpha_paste(img, OV['planned'], min(1.0, max(0.0, (t - planned) / 0.4)))
        fade = min(1.0, t / fin, (dur - t) / 0.35) if sid != 'K' else min(1.0, t / 0.5)
        if fade < 1:
            img = Image.blend(Image.new('RGB', (OW, OH), IVORY), img, max(0.0, fade))
        p.stdin.write(img.tobytes())
    p.stdin.close()
    if p.wait() == 0:
        os.replace(tmp, out)
        print(sid, n, 'frames ok', flush=True)
    else:
        print(sid, 'FAILED', flush=True)

if __name__ == '__main__':
    os.makedirs('shots', exist_ok=True)
    want = set(sys.argv[1:])
    for s in SHOTS:
        if not want or s[0] in want:
            render(s)
