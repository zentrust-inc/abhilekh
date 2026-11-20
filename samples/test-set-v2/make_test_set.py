#!/usr/bin/env python3
"""Abhilekh fictional test set v2: harder hand-writing. Every document is invented and stamped SAMPLE / नमूना.

Ten documents (7 prescriptions, 3 hand-filled lab forms), each as a clean scan (clean/*.png) and a phone
photo (photo/*.jpg). Compared with v1 (one tidy hand-writing font with a little tilt) the writing here is
drawn letter by letter with its own slant, size, baseline wobble and pressure, in six different hands, and
the pages carry the faults real prescriptions have:

  P11 crowded, slanted, fast writing on a small pad       P15 Nepali hand-writing with Devanagari digits
  P12 doses and durations corrected by over-writing       P16 neat-ish Rx photographed crumpled
  P13 5/6 and 9/3 look-alike digits                       P17 a stamp over the writing, two invented brands
  P14 an ink smudge that hides a duration                 L11 hand-filled CBC form, look-alike digits
  L12 all-hand-written slip, crumpled photo               L13 lipid form: over-written value, smudged value

Ground truth is what the writer MEANT. A look-alike digit is the intended digit drawn together with its
look-alike (marker [5~6] in the source below: intended 5, look-alike 6); an over-written digit is the old
digit drawn light and the new one drawn over it (marker [6>5]: old 6, final 5). The smudged value in P14
and L13 cannot be read by anyone; the key leaves it empty and a reader must too.

No real patient, doctor, clinic or lab. Names use Namuna / Udaharan ("sample", "example"). Namucef and
Udarol-SR are invented brands: the DDA drug-name check must flag them as not found.

Run:  python3 make_test_set.py <out_dir> <font_dir>      (fonts: ./fetch-fonts.sh)
"""
import json, csv, os, sys, re, random, math
import numpy as np
from scipy.ndimage import gaussian_filter, map_coordinates, zoom
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance, ImageChops

OUT = sys.argv[1] if len(sys.argv) > 1 else "out"
FD = sys.argv[2] if len(sys.argv) > 2 else "fonts"
random.seed(2084)
RNG = np.random.default_rng(2084)

_fc = {}
def F(name, size):
    k = (name, size)
    if k not in _fc:
        _fc[k] = ImageFont.truetype(os.path.join(FD, name), size, layout_engine=ImageFont.Layout.RAQM)
    return _fc[k]

SANS = lambda s: F("noto-sans-devanagari-400.ttf", s)
SANSB = lambda s: F("noto-sans-devanagari-700.ttf", s)
MUKB = lambda s: F("mukta-700.ttf", s)
UNIT = lambda s: ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", s, layout_engine=ImageFont.Layout.RAQM)
HANDS = {  # six Latin hands + Kalam (Devanagari too); name: (file, size factor so the hands look equally big)
    "caveat": ("caveat-400.ttf", 1.0), "beanie": ("reenie-beanie-400.ttf", 1.15),
    "grace": ("covered-by-your-grace-400.ttf", 0.95), "shadows": ("shadows-into-light-two-400.ttf", 0.95),
    "gochi": ("gochi-hand-400.ttf", 0.9), "nanum": ("nanum-pen-script-400.ttf", 1.2), "kalam": ("kalam-400.ttf", 0.9),
}
BIRO = (25, 35, 100)     # blue ball pen
GEL = (12, 12, 22)       # black gel pen
PENCIL = (70, 72, 82)    # soft pencil
BLACK = (20, 20, 20)
GREY = (110, 110, 110)
A4 = (1240, 1754)
A5 = (874, 1240)

# ------------------------------------------------------------------ hand-writing

TOK = re.compile(r"\[(\d)([~>])(\d)\]")
def final(t):
    """What the writer meant: [5~6] -> 5, [6>5] -> 5."""
    return TOK.sub(lambda m: m.group(1) if m.group(2) == "~" else m.group(3), t)

def has_dev(s):
    return any("ऀ" <= c <= "ॿ" for c in s)

def glyph(s, font, color, alpha, rot, shear, scale):
    bb = font.getbbox(s)
    pad = 24 + int(0.6 * font.size)
    lay = Image.new("RGBA", (bb[2] + 2 * pad, bb[3] + 2 * pad), (0, 0, 0, 0))
    ImageDraw.Draw(lay).text((pad, pad), s, font=font, fill=tuple(color) + (alpha,))
    if shear:
        y0 = pad + font.size * 0.75
        lay = lay.transform(lay.size, Image.AFFINE, (1, shear, -shear * y0, 0, 1, 0), resample=Image.BICUBIC)
    if scale != 1:
        lay = lay.resize((max(1, int(lay.width * scale)), max(1, int(lay.height * scale))), Image.BICUBIC)
    lay = lay.rotate(rot, resample=Image.BICUBIC, expand=True)
    return lay, pad * scale

def hw(im, x, y, text, hand, size, color=BIRO, slant=0.18, jit=1.0, track=1.0, drift=0.0, alpha=238, slope=0.0, wobble=1.0):
    """Hand-written text, one letter (or one Devanagari word) at a time. Returns (end_x, bbox)."""
    fname, k = HANDS[hand]
    font = F(fname, int(size * k))
    x0, phase = x, random.uniform(0, 6.28)
    box = [x, y, x, y + size]
    parts = [p for p in re.split(r"(\[\d[~>]\d\])", text) if p != ""]
    for part in parts:
        m = TOK.fullmatch(part)
        if m:
            a, op, b = m.groups()
            seq = [(b, 0.6, False), (a, 1.0, True)] if op == "~" else [(a, 0.5, False), (b, 1.0, True)]
            # ~ : intended a, look-alike b drawn beside it, lighter; > : old a drawn light, final b over it
            if op == "~": seq = [(b, 0.36, False), (a, 1.0, True)]
            adv0 = font.getlength(a) * track
            for ch, al, main in seq:
                yy = y + slope * (x - x0) + drift * math.sin((x - x0) / 70 + phase) + random.uniform(-2, 2) * jit
                lay, off = glyph(ch, font, color if main else (color if op == "~" else tuple(min(255, c + 70) for c in color)),
                                 int(alpha * al), random.uniform(-5, 5) * jit * wobble, slant + random.uniform(-.05, .05) * jit, random.uniform(0.95, 1.05) if main else 1.0)
                im.paste(lay, (int(x - off + (random.uniform(-3, 3) if not main else 0) + (3 if (op == ">" and main) else 0)), int(yy - off)), lay)
            x += adv0
            box[2] = x
            continue
        units = part.split(" ") if has_dev(part) else list(part)
        for i, u in enumerate(units):
            if has_dev(part):
                u2 = u + (" " if i < len(units) - 1 else "")
            else:
                u2 = u
            if u2.strip() == "":
                x += font.getlength("n") * 0.75 * track * (1 + random.uniform(-.2, .3)); continue
            yy = y + slope * (x - x0) + drift * math.sin((x - x0) / 70 + phase) + random.uniform(-3, 3) * jit
            sc = random.uniform(0.9, 1.1) if jit else 1.0
            lay, off = glyph(u2.rstrip(), font, color, int(alpha * random.uniform(0.82, 1.0)), random.uniform(-6, 6) * jit * wobble,
                             slant + random.uniform(-.07, .07) * jit, sc)
            im.paste(lay, (int(x - off), int(yy - off)), lay)
            x += font.getlength(u2) * sc * track * random.uniform(0.94, 1.06)
        box[2] = x
    box[3] = y + size * 1.1
    return x, tuple(int(v) for v in box)

# ------------------------------------------------------------------ faults

def smudge(im, box, strength=1.0, seed=0, opacity=1.0):
    """Wet-ink smear: the region dragged sideways and under a dark ink blot."""
    r = random.Random(seed)
    pad = 26
    x0, y0, x1, y1 = box
    b = (max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad))
    reg = im.crop(b).convert("RGB")
    acc = np.zeros((reg.height, reg.width, 3), np.float32)
    n = 0
    for dx in range(-int(80 * strength), int(80 * strength) + 1, 4):
        dy = int(dx * 0.25)
        acc += np.asarray(ImageChops.offset(reg, dx, dy), np.float32); n += 1
    sm = Image.fromarray((acc / n).astype(np.uint8))
    w, h = reg.size
    blot = Image.new("L", (w, h), 0)
    bd = ImageDraw.Draw(blot)
    for _ in range(14):
        cx, cy = r.uniform(0.15 * w, 0.85 * w), r.uniform(0.2 * h, 0.8 * h)
        rx, ry = r.uniform(0.12, 0.28) * w, r.uniform(0.25, 0.5) * h
        bd.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=int(150 * strength))
    blot = blot.filter(ImageFilter.GaussianBlur(10))
    ink = Image.new("RGB", (w, h), (38, 46, 105))
    sm = Image.composite(ink, sm, blot)
    feather = Image.new("L", (w, h), 0)
    ImageDraw.Draw(feather).ellipse([4, 4, w - 4, h - 4], fill=255)
    feather = feather.filter(ImageFilter.GaussianBlur(12))
    im.paste(sm, b[:2], feather.point(lambda v: int(v * opacity)))

def stamp_round(im, cx, cy, r, text_top, text_bot, color=(120, 40, 140)):
    """Hospital rubber stamp, semi-transparent, overlapping whatever is written beneath."""
    lay = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=color + (170,), width=6)
    d.ellipse([cx - r + 14, cy - r + 14, cx + r - 14, cy + r - 14], outline=color + (150,), width=2)
    d.text((cx, cy - 24), text_top, font=SANSB(26), fill=color + (190,), anchor="mm")
    d.text((cx, cy + 22), text_bot, font=SANS(22), fill=color + (190,), anchor="mm")
    lay = lay.filter(ImageFilter.GaussianBlur(0.8))
    base = im.convert("RGBA"); base.alpha_composite(lay)
    im.paste(base.convert("RGB"))

def crumple(im, seed=1, creases=26, depth=1.0):
    """Paper that was crumpled and flattened: folds shift the writing sideways and catch the light."""
    rng = np.random.default_rng(seed)
    w, h = im.size
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    ht = np.zeros((h, w), np.float32)
    for _ in range(creases):
        px, py, th = rng.uniform(0, w), rng.uniform(0, h), rng.uniform(0, math.pi)
        dist = (xx - px) * math.cos(th) + (yy - py) * math.sin(th)
        ht += rng.uniform(-1, 1) * 26 * depth * np.tanh(dist / rng.uniform(14, 40))
    lo = gaussian_filter(rng.normal(size=(h // 16 + 1, w // 16 + 1)).astype(np.float32), 3.0)
    ht += zoom(lo, 16, order=3)[:h, :w] * 90 * depth
    ht = gaussian_filter(ht, 3.0)
    gy, gx = np.gradient(ht)
    a = np.asarray(im.convert("RGB"), np.float32)
    out = np.empty_like(a)
    for c in range(3):
        out[..., c] = map_coordinates(a[..., c], [yy + gy * 7, xx + gx * 7], order=1, mode="nearest")
    shade = 1.0 - 0.45 * (gx * 0.7 + gy * 0.7) / (1 + np.abs(gx) + np.abs(gy))
    out *= np.clip(shade, 0.72, 1.12)[..., None]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))

def perspective(im, strength):
    w, h = im.size
    j = lambda: random.uniform(-0.05, 0.05) * strength
    dst = [(w * j(), h * j()), (w * (1 + j()), h * j()), (w * (1 + j()), h * (1 + j())), (w * j(), h * (1 + j()))]
    src = [(0, 0), (w, 0), (w, h), (0, h)]
    A = []
    for (X, Y), (x, y) in zip(dst, src):
        A += [[X, Y, 1, 0, 0, 0, -x * X, -x * Y], [0, 0, 0, X, Y, 1, -y * X, -y * Y]]
    coef = np.linalg.solve(np.array(A, float), np.array(src, float).reshape(8))
    return im.convert("RGBA").transform(im.size, Image.PERSPECTIVE, tuple(coef), Image.BICUBIC)

def phone_photo(im, strength=1.0, faded=False, crumpled=0.0, seed=0):
    if crumpled:
        im = crumple(im, seed=seed, depth=crumpled)
    if faded:
        im = ImageEnhance.Contrast(im).enhance(0.55); im = ImageEnhance.Brightness(im).enhance(1.1)
    w, h = im.size
    bg = Image.new("RGB", (int(w * 1.2), int(h * 1.14)), (96, 78, 60))
    rot = perspective(im, strength).rotate(random.uniform(-6, 6) * strength, expand=True, resample=Image.BICUBIC, fillcolor=(0, 0, 0, 0))
    bg.paste(rot, ((bg.width - rot.width) // 2 + random.randint(-20, 20), (bg.height - rot.height) // 2), rot)
    sh = Image.new("L", bg.size, 0); sd = ImageDraw.Draw(sh)
    for i in range(0, bg.width, 6):
        sd.line([i, 0, i, bg.height], fill=int(120 * max(0, 1 - i / (bg.width * 0.55)) * strength))
    bg = Image.composite(Image.new("RGB", bg.size, (0, 0, 0)), bg, sh.filter(ImageFilter.GaussianBlur(40)))
    bg = bg.filter(ImageFilter.GaussianBlur(1.0 * strength))
    bg = ImageEnhance.Color(bg).enhance(0.9)
    return bg.resize((int(bg.width * 0.8), int(bg.height * 0.8)), Image.LANCZOS)

def stamp(im):
    """Diagonal SAMPLE watermark + corner stamp. Never removed from any test file."""
    w, h = im.size
    k = w / 1240
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    f = SANSB(int(150 * k)); txt = "SAMPLE · नमूना"
    tw = d.textlength(txt, font=f)
    t = Image.new("RGBA", (int(tw) + 40, int(260 * k)), (0, 0, 0, 0))
    ImageDraw.Draw(t).text((20, 20), txt, font=f, fill=(200, 30, 30, 60))
    t = t.rotate(32, expand=True, resample=Image.BICUBIC)
    layer.paste(t, ((w - t.width) // 2, (h - t.height) // 2), t)
    d.rectangle([30, h - int(125 * k), 30 + int(400 * k), h - 15], outline=(200, 30, 30, 220), width=5)
    d.text((50, h - int(117 * k)), "SAMPLE · नमूना", font=SANSB(int(44 * k)), fill=(200, 30, 30, 230))
    d.text((50, h - int(57 * k)), "fictional test document", font=SANS(int(24 * k)), fill=(200, 30, 30, 230))
    base = im.convert("RGBA"); base.alpha_composite(layer)
    return base.convert("RGB")

def page(size=A4, bg=(255, 255, 255), lines=None):
    im = Image.new("RGB", size, bg); d = ImageDraw.Draw(im)
    if lines:
        for yy in range(lines, size[1], 54): d.line([0, yy, size[0], yy], fill=(205, 215, 235), width=1)
    return im, d

def head(d, size, name, sub, nep=None, color=(20, 90, 60), small=False):
    w = size[0]
    d.rectangle([0, 0, w, 8], fill=color); y = 34
    if nep: d.text((50, y), nep, font=MUKB(36 if small else 44), fill=color); y += 50 if small else 60
    d.text((50, y), name, font=SANSB(30 if small else 38), fill=color); y += 46 if small else 54
    for line in sub: d.text((50, y), line, font=SANS(21 if small else 24), fill=GREY); y += 30
    d.line([50, y + 8, w - 50, y + 8], fill=color, width=3)
    return y + 26

# ------------------------------------------------------------------ answer-key helpers

def med(written, generic, strength, form, dose, dose_w, duration, dur_w, timing=None, dda="registered generic"):
    return {"as_written": final(written), "generic": generic, "strength": strength, "form": form,
            "dose": dose, "dose_as_written": final(dose_w) if dose_w else None, "timing": timing,
            "duration": duration, "duration_as_written": final(dur_w) if dur_w else None, "dda_expected": dda}
INVENTED = "NOT FOUND — invented brand; must be flagged for a person to confirm, never guessed"

def res(test, value, unit, rng=None, flag=None):
    return {"test": test, "value": final(value) if value else "", "unit": unit, "reference_range": rng, "flag_printed": flag}

def pat(name, age, sex, address=None):
    return {"name": name, "age": age, "sex": sex, "address": address}

# ------------------------------------------------------------------ prescriptions

def rx_line(im, x, y, name, dose, dur, hand, size, color, slant, gx=(560, 760), jit=1.0, track=1.0, drift=2.0, slope=0.0, num=None):
    """One medicine line in three parts; returns the three boxes (name, dose, duration)."""
    ex, b1 = hw(im, x, y, (num + " " if num else "") + name, hand, size, color, slant, jit, track, drift, slope=slope)
    _, b2 = hw(im, max(gx[0], ex + 18), y + random.uniform(-3, 3), dose, hand, size, color, slant, jit, track, drift, slope=0)
    b3 = None
    if dur: _, b3 = hw(im, gx[1], y + random.uniform(-3, 3), dur, hand, size, color, slant, jit, track, drift, slope=0)
    return b1, b2, b3

def p11(doc):
    """P11: crowded, slanted, fast writing on a small prescription pad."""
    im, d = page(A5, (251, 249, 238))
    y = head(d, A5, "Dr. F. Namuna  MBBS", ["Example Medical Hall, Butwal  ·  Reg. 00000 (fictional)"], color=(30, 70, 120), small=True)
    c = BIRO
    hw(im, 60, y + 4, "Kamala Devi Udaharan  52/F", "caveat", 46, c, 0.32, 1.1, 0.92, 2, slope=-0.012)
    hw(im, 600, y + 52, "2083/08/10", "caveat", 46, c, 0.32, 1.1, 0.92, 2)
    hw(im, 60, y + 56, "burning epigastric pain x 2 wk", "caveat", 42, c, 0.34, 1.2, 0.9, 2, slope=-0.012)
    y += 130
    hw(im, 50, y, "Rx", "caveat", 72, c, 0.3, 1.0)
    y += 68
    items = [("Tab Pantoprazole 40 mg", "1-0-0", "x 14 days"), ("Tab Domperidone 10 mg", "1-1-1", "x 5 days"),
             ("Tab Ondansetron 4 mg", "SOS", None), ("Tab Paracetamol 500 mg", "SOS", None)]
    for i, (n, ds, du) in enumerate(items):
        rx_line(im, 60, y, n, ds, du, "caveat", 46, c, 0.34, gx=(470, 600), jit=1.25, track=0.9, drift=3, slope=-0.02, num=f"{i+1})")
        y += 52   # tight: lines nearly touch
    hw(im, 60, y + 8, "bland diet, no spicy / tea", "caveat", 42, c, 0.34, 1.2, 0.9, 2, slope=-0.012)
    hw(im, 60, y + 56, "F/U 2 wk", "caveat", 42, c, 0.34, 1.2, 0.9, 2)
    hw(im, 540, y + 120, "F. Namuna", "caveat", 56, c, 0.4, 1.3, 0.8, 3)
    doc.update(kind="prescription", style="small pad, crowded fast slanted hand (Caveat, 18-20° lean), lines nearly touching",
        facility="Example Medical Hall, Butwal", clinician="Dr. F. Namuna", clinician_reg=None,
        patient=pat("Kamala Devi Udaharan", "52 y", "F"), date={"as_written": "2083/08/10", "calendar": "BS"},
        diagnosis_as_written="burning epigastric pain x 2 wk",
        medicines=[med("Tab Pantoprazole 40 mg", "pantoprazole", "40 mg", "tablet", "1-0-0", "1-0-0", "14 days", "14 days", "morning"),
                   med("Tab Domperidone 10 mg", "domperidone", "10 mg", "tablet", "1-1-1", "1-1-1", "5 days", "5 days"),
                   med("Tab Ondansetron 4 mg", "ondansetron", "4 mg", "tablet", "SOS (when needed)", "SOS", None, None),
                   med("Tab Paracetamol 500 mg", "paracetamol", "500 mg", "tablet", "SOS (when needed)", "SOS", None, None)],
        advice=["bland diet, no spicy / tea", "F/U 2 wk"],
        traps=["crowded lines touching, 1-1-1 vs 1-0-1", "numbered list with ')' glued to the name", "no duration on SOS lines: leave empty"])
    return im

def p12(doc):
    """P12: doses and durations corrected by writing over the old digit."""
    im, d = page(A4)
    y = head(d, A4, "Dr. G. Udaharan, MBBS MD", ["Example Health Centre, Dhulikhel  ·  Reg. 00000 (fictional)"], nep="उदाहरण स्वास्थ्य केन्द्र", color=(110, 40, 40))
    c = GEL
    hw(im, 70, y + 10, "Bishnu Prasad Namuna  66/M", "beanie", 58, c, 0.12, 1.2, 1.0, 3)
    hw(im, 70, y + 90, "Date 2083/08/11", "beanie", 58, c, 0.12, 1.2, 1.0, 3)
    hw(im, 70, y + 170, "DM-2, HTN, IHD", "beanie", 58, c, 0.12, 1.2, 1.0, 3)
    y += 290
    hw(im, 70, y, "Rx", "beanie", 90, c, 0.1, 1.0); y += 120
    items = [("Tab Metformin 500 mg", "1-[1>0]-1", "x [2>1] month"), ("Tab Enalapril 5 mg", "1-0-[1>0]", "x [3>2] months"),
             ("Tab Atorvastatin 20 mg", "0-0-1", "x 1 month"), ("Tab Aspirin 75 mg", "0-1-0", "x 1 month")]
    for i, (n, ds, du) in enumerate(items):
        rx_line(im, 80, y, n, ds, du, "beanie", 62, c, 0.12, gx=(620, 860), jit=1.1, num=f"{i+1}.")
        y += 100
    hw(im, 70, y + 30, "Review with HbA1c, lipids", "beanie", 58, c, 0.12, 1.2, 1.0, 3)
    hw(im, 760, 1520, "G. Udaharan", "beanie", 66, c, 0.1, 1.3, 1.0, 3)
    doc.update(kind="prescription", style="tall narrow hand (Reenie Beanie); three corrections written over the first digit",
        facility="Example Health Centre, Dhulikhel", clinician="Dr. G. Udaharan", clinician_reg=None,
        patient=pat("Bishnu Prasad Namuna", "66 y", "M"), date={"as_written": "2083/08/11", "calendar": "BS"},
        diagnosis_as_written="DM-2, HTN, IHD",
        medicines=[med("Tab Metformin 500 mg", "metformin", "500 mg", "tablet", "1-0-1", "1-[1>0]-1", "1 month", "[2>1] month", "after meals"),
                   med("Tab Enalapril 5 mg", "enalapril", "5 mg", "tablet", "1-0-0", "1-0-[1>0]", "2 months", "[3>2] months"),
                   med("Tab Atorvastatin 20 mg", "atorvastatin", "20 mg", "tablet", "0-0-1", "0-0-1", "1 month", "1 month", "night"),
                   med("Tab Aspirin 75 mg", "aspirin", "75 mg", "tablet", "0-1-0", "0-1-0", "1 month", "1 month")],
        advice=["Review with HbA1c, lipids"],
        traps=["corrected digits: the FINAL (darker) digit is the dose, the light digit under it is not", "1-1-1 under 1-0-1, 1-0-1 under 1-0-0", "duration 2 over 3 months"])
    return im

def p13(doc):
    """P13: 5/6 and 9/3 look-alikes."""
    im, d = page(A4)
    y = head(d, A4, "Dr. H. Namuna", ["Example Clinic, Dharan  ·  NMC 00000 (fictional)"], color=(20, 90, 90))
    c = BIRO
    hw(im, 70, y + 10, "Maya Kumari Udaharan  45/F", "grace", 56, c, 0.2, 1.1, 1.0, 3)
    hw(im, 70, y + 90, "Date 2083/08/[5~6]", "grace", 56, c, 0.2, 1.1, 1.0, 3)
    hw(im, 70, y + 170, "URTI, ? allergic", "grace", 56, c, 0.2, 1.1, 1.0, 3)
    y += 300
    hw(im, 70, y, "Rx", "grace", 90, c, 0.2, 1.0); y += 120
    items = [("Tab Azithromycin 500 mg", "1-0-0", "x [3~9] days"), ("Tab Prednisolone 5 mg", "2-1-0", "x [5~6] days"),
             ("Tab Cetirizine 10 mg", "0-0-1", "x [5~6] days"), ("Tab Paracetamol [6~5][5~6]0 mg", "SOS", None)]
    for i, (n, ds, du) in enumerate(items):
        rx_line(im, 80, y, n, ds, du, "grace", 54, c, 0.2, gx=(640, 860), jit=1.1, num=f"{i+1}.")
        y += 100
    hw(im, 70, y + 30, "Come back if fever > 3 days", "grace", 52, c, 0.2, 1.1, 1.0, 3)
    hw(im, 780, 1520, "H. Namuna", "grace", 60, c, 0.2, 1.3, 1.0, 3)
    doc.update(kind="prescription", style="round hand (Covered By Your Grace); 5/6 and 9/3 written so they look alike (intended digit drawn with its look-alike)",
        facility="Example Clinic, Dharan", clinician="Dr. H. Namuna", clinician_reg="NMC 00000 (fictional)",
        patient=pat("Maya Kumari Udaharan", "45 y", "F"), date={"as_written": "2083/08/5", "calendar": "BS"},
        diagnosis_as_written="URTI, ? allergic",
        medicines=[med("Tab Azithromycin 500 mg", "azithromycin", "500 mg", "tablet", "1-0-0", "1-0-0", "3 days", "[3~9] days"),
                   med("Tab Prednisolone 5 mg", "prednisolone", "5 mg", "tablet", "2-1-0", "2-1-0", "5 days", "[5~6] days"),
                   med("Tab Cetirizine 10 mg", "cetirizine", "10 mg", "tablet", "0-0-1", "0-0-1", "5 days", "[5~6] days", "bedtime"),
                   med("Tab Paracetamol [6~5][5~6]0 mg", "paracetamol", "650 mg", "tablet", "SOS (when needed)", "SOS", None, None)],
        advice=["Come back if fever > 3 days"],
        traps=["3 written like 9 (azithromycin x 3 days)", "5 written like 6 (prednisolone and cetirizine x 5 days, date day 5, written 2083/08/5 without a leading zero)", "650 mg: 6 and 5 both look-alikes", "a reader that cannot tell must leave the field empty, not guess"])
    return im

def p14(doc):
    """P14: an ink smudge over the duration of the first medicine (unreadable) and a lighter one elsewhere."""
    im, d = page(A4, (253, 251, 246))
    y = head(d, A4, "Dr. I. Udaharan  MBBS", ["Example Clinic, Hetauda  ·  NMC 00000 (fictional)"], color=(90, 60, 30))
    c = BIRO
    hw(im, 70, y + 10, "Rajan Namuna  38/M", "shadows", 58, c, 0.16, 1.1, 1.0, 3)
    hw(im, 70, y + 90, "Date 2083/08/12", "shadows", 58, c, 0.16, 1.1, 1.0, 3)
    hw(im, 70, y + 170, "gastritis, H. pylori +ve (stool Ag)", "shadows", 54, c, 0.16, 1.1, 1.0, 3)
    y += 300
    hw(im, 70, y, "Rx", "shadows", 88, c, 0.16, 1.0); y += 120
    items = [("Tab Pantoprazole 40 mg", "1-0-1", "x 14 days"), ("Tab Clarithromycin 500 mg", "1-0-1", "x 14 days"),
             ("Cap Amoxicillin 500 mg", "1-0-1", "x 14 days")]
    boxes = []
    for i, (n, ds, du) in enumerate(items):
        boxes.append(rx_line(im, 80, y, n, ds, du, "shadows", 54, c, 0.16, gx=(600, 820), jit=1.0, num=f"{i+1}."))
        y += 110
    hw(im, 70, y + 40, "Review after 2 weeks", "shadows", 54, c, 0.16, 1.1, 1.0, 3)
    hw(im, 780, 1520, "I. Udaharan", "shadows", 60, c, 0.16, 1.3, 1.0, 3)
    smudge(im, boxes[0][2], 1.0, seed=3)      # first duration: unreadable
    smudge(im, boxes[1][0], 0.3, seed=4, opacity=0.5)     # second name: wet but legible
    doc.update(kind="prescription", style="hand (Shadows Into Light Two); wet-ink smudge over one duration (unreadable) and a light smear over another line",
        facility="Example Clinic, Hetauda", clinician="Dr. I. Udaharan", clinician_reg="NMC 00000 (fictional)",
        patient=pat("Rajan Namuna", "38 y", "M"), date={"as_written": "2083/08/12", "calendar": "BS"},
        diagnosis_as_written="gastritis, H. pylori +ve (stool Ag)",
        medicines=[med("Tab Pantoprazole 40 mg", "pantoprazole", "40 mg", "tablet", "1-0-1", "1-0-1", None, None),
                   med("Tab Clarithromycin 500 mg", "clarithromycin", "500 mg", "tablet", "1-0-1", "1-0-1", "14 days", "14 days"),
                   med("Cap Amoxicillin 500 mg", "amoxicillin", "500 mg", "capsule", "1-0-1", "1-0-1", "14 days", "14 days")],
        advice=["Review after 2 weeks"], illegible=[{"item": "Tab Pantoprazole 40 mg", "field": "duration"}],
        traps=["the pantoprazole duration is smudged and cannot be read by anyone: the key leaves it empty (it was meant to be 14 days like the others); any reader value there is a guess and must not be ticked",
               "light smear over the clarithromycin name: still readable"])
    return im

def p15(doc):
    """P15: Devanagari hand-writing and Devanagari digits."""
    im, d = page(A4)
    y = head(d, A4, "Dr. J. Namuna", ["Example Hospital, Pokhara  ·  NMC 00000 (fictional)"], nep="उदाहरण अस्पताल", color=(40, 100, 60))
    c = BIRO
    hw(im, 70, y + 8, "Sunita Namuna  29/F", "gochi", 56, c, 0.1, 1.1, 1.0, 3)
    hw(im, 70, y + 88, "मिति २०८३/०८/१३", "kalam", 52, c, 0.1, 1.0, 1.0, 3)
    hw(im, 70, y + 168, "पिसाबमा पोल्ने, ज्वरो", "kalam", 50, c, 0.1, 1.0, 1.0, 3)
    y += 300
    hw(im, 70, y, "Rx", "gochi", 86, c, 0.1, 1.0); y += 120
    items = [("Tab Ciprofloxacin 500 mg", "१-०-१", "५ दिन"), ("Tab Paracetamol 500 mg", "SOS", None), ("ORS", "दिनमा ३ पटक", None)]
    for i, (n, ds, du) in enumerate(items):
        ex, _ = hw(im, 80, y, f"{i+1}. {n}", "gochi", 54, c, 0.1, 1.0, 1.0, 3)
        hw(im, max(640, ex + 20), y, ds, "kalam" if has_dev(ds) else "gochi", 50, c, 0.1, 1.0, 1.0, 3)
        if du: hw(im, 880, y, du, "kalam", 50, c, 0.1, 1.0, 1.0, 3)
        y += 100
    y += 30
    hw(im, 70, y, "धेरै पानी पिउने", "kalam", 50, c, 0.1, 1.0, 1.0, 3); y += 78
    hw(im, 70, y, "३ दिनमा नघटे फेरि आउने", "kalam", 50, c, 0.1, 1.0, 1.0, 3)
    hw(im, 780, 1520, "J. Namuna", "gochi", 60, c, 0.1, 1.3, 1.0, 3)
    doc.update(kind="prescription", style="mixed English / Devanagari hand-writing (Gochi Hand, Kalam) with Devanagari digits in the date, dose and duration",
        facility="Example Hospital, Pokhara", clinician="Dr. J. Namuna", clinician_reg="NMC 00000 (fictional)",
        patient=pat("Sunita Namuna", "29 y", "F"), date={"as_written": "२०८३/०८/१३", "calendar": "BS"},
        diagnosis_as_written="पिसाबमा पोल्ने, ज्वरो",
        medicines=[med("Tab Ciprofloxacin 500 mg", "ciprofloxacin", "500 mg", "tablet", "1-0-1", "१-०-१", "5 days", "५ दिन"),
                   med("Tab Paracetamol 500 mg", "paracetamol", "500 mg", "tablet", "SOS (when needed)", "SOS", None, None),
                   med("ORS", "oral rehydration salts", None, "powder", "3 times a day", "दिनमा ३ पटक", None, None)],
        advice=["धेरै पानी पिउने (drink plenty of water)", "३ दिनमा नघटे फेरि आउने (return if not better in 3 days)"],
        traps=["Devanagari digits kept as Devanagari (१-०-१, ५ दिन)", "Devanagari ५ and ६ and ३ in hand-writing", "dose written in words (दिनमा ३ पटक)"])
    return im

def p16(doc):
    """P16: a fairly legible Rx; the phone photo is of crumpled paper."""
    im, d = page(A4, (250, 248, 240))
    y = head(d, A4, "Dr. K. Udaharan  MBBS MD (Med)", ["Namuna Polyclinic, Janakpur  ·  NMC 00000 (fictional)"], color=(30, 60, 130))
    c = BIRO
    hw(im, 70, y + 10, "Devi Prasad Namuna  71/M", "gochi", 54, c, 0.12, 0.8, 1.0, 2)
    hw(im, 70, y + 88, "Date 2083/08/14", "gochi", 54, c, 0.12, 0.8, 1.0, 2)
    hw(im, 70, y + 166, "HTN, CCF, on diuretics", "gochi", 52, c, 0.12, 0.8, 1.0, 2)
    y += 300
    hw(im, 70, y, "Rx", "gochi", 86, c, 0.12, 0.8); y += 120
    items = [("Tab Ramipril 5 mg", "1-0-0", "x 1 month"), ("Tab Metoprolol 25 mg", "1-0-1", "x 1 month"),
             ("Tab Furosemide 40 mg", "1-0-0", "x 7 days"), ("Tab Spironolactone 25 mg", "1-0-0", "x 7 days")]
    for i, (n, ds, du) in enumerate(items):
        rx_line(im, 80, y, n, ds, du, "gochi", 54, c, 0.12, gx=(600, 820), jit=0.8, num=f"{i+1}.")
        y += 100
    hw(im, 70, y + 30, "Wt daily, low salt", "gochi", 52, c, 0.12, 0.8, 1.0, 2)
    hw(im, 70, y + 108, "Review 1 week", "gochi", 52, c, 0.12, 0.8, 1.0, 2)
    hw(im, 780, 1520, "K. Udaharan", "gochi", 58, c, 0.12, 1.0, 1.0, 2)
    doc.update(kind="prescription", style="fairly legible hand (Gochi Hand); the PHOTO is of crumpled paper: creases shift and shade the writing",
        facility="Namuna Polyclinic, Janakpur", clinician="Dr. K. Udaharan", clinician_reg="NMC 00000 (fictional)",
        patient=pat("Devi Prasad Namuna", "71 y", "M"), date={"as_written": "2083/08/14", "calendar": "BS"},
        diagnosis_as_written="HTN, CCF, on diuretics",
        medicines=[med("Tab Ramipril 5 mg", "ramipril", "5 mg", "tablet", "1-0-0", "1-0-0", "1 month", "1 month"),
                   med("Tab Metoprolol 25 mg", "metoprolol", "25 mg", "tablet", "1-0-1", "1-0-1", "1 month", "1 month"),
                   med("Tab Furosemide 40 mg", "furosemide", "40 mg", "tablet", "1-0-0", "1-0-0", "7 days", "7 days"),
                   med("Tab Spironolactone 25 mg", "spironolactone", "25 mg", "tablet", "1-0-0", "1-0-0", "7 days", "7 days")],
        advice=["Wt daily, low salt", "Review 1 week"],
        traps=["crumpled photo: creases cut through strokes; the clean scan is the easy version of the same page"])
    return im

def p17(doc):
    """P17: pencil-soft hand, a round hospital stamp over the writing, two invented brands."""
    im, d = page(A5, (250, 248, 242))
    y = head(d, A5, "Dr. L. Namuna  MBBS", ["Example Nursing Home, Birgunj  ·  Reg. 00000 (fictional)"], color=(100, 50, 20), small=True)
    c = PENCIL
    hw(im, 60, y + 4, "Anita Udaharan  31/F", "nanum", 52, c, 0.22, 1.1, 0.95, 2)
    hw(im, 560, y + 52, "14/11/2026", "nanum", 52, c, 0.22, 1.1, 0.95, 2)
    y += 130
    hw(im, 50, y, "Rx", "nanum", 80, c, 0.2, 1.0); y += 76
    items = [("Tab Namucef 500", "1-0-1", "x 5 d"), ("Cap Udarol-SR 150", "0-0-1", "x 10 d"),
             ("Tab Pantoprazole 40 mg", "1-0-0", "x 10 d"), ("Tab Paracetamol 500 mg", "SOS", None)]
    for i, (n, ds, du) in enumerate(items):
        rx_line(im, 60, y, n, ds, du, "nanum", 52, c, 0.22, gx=(470, 620), jit=1.0, num=f"{i+1})")
        y += 70
    hw(im, 60, y + 20, "Rpt CBC after course", "nanum", 48, c, 0.22, 1.1, 0.95, 2)
    hw(im, 520, y + 100, "L. Namuna", "nanum", 58, c, 0.25, 1.3, 0.9, 2)
    stamp_round(im, 560, 600, 130, "EXAMPLE NURSING HOME", "BIRGUNJ · reg 00000")
    doc.update(kind="prescription", style="soft pencil-like hand (Nanum Pen Script) on a small pad; a round rubber stamp over the end of line 3 and all of line 4; two invented brands",
        facility="Example Nursing Home, Birgunj", clinician="Dr. L. Namuna", clinician_reg=None,
        patient=pat("Anita Udaharan", "31 y", "F"), date={"as_written": "14/11/2026", "calendar": "AD"},
        diagnosis_as_written=None,
        medicines=[med("Tab Namucef 500", None, "500 (unit not written)", "tablet", "1-0-1", "1-0-1", "5 days", "5 d", dda=INVENTED),
                   med("Cap Udarol-SR 150", None, "150 (unit not written)", "capsule", "0-0-1", "0-0-1", "10 days", "10 d", dda=INVENTED),
                   med("Tab Pantoprazole 40 mg", "pantoprazole", "40 mg", "tablet", "1-0-0", "1-0-0", "10 days", "10 d"),
                   med("Tab Paracetamol 500 mg", "paracetamol", "500 mg", "tablet", "SOS (when needed)", "SOS", None, None)],
        advice=["Rpt CBC after course"],
        traps=["Namucef and Udarol-SR are invented: shown as written and flagged, never mapped to a real drug", "stamp ink over the duration of line 3 and the whole of line 4", "duration written as '5 d' / '10 d'", "no dx line"])
    return im

# ------------------------------------------------------------------ hand-filled lab forms

def form(im, d, y, rows, hand, size, color, slant, jit=1.0, title=None, cols=(60, 520, 700, 940)):
    """Printed lab form: test, unit and range printed; result (and any flag) written by hand."""
    if title: d.text((60, y), title, font=SANSB(28), fill=(130, 20, 40)); y += 46
    d.rectangle([55, y - 6, im.width - 55, y + 38], fill=(238, 238, 244))
    for x, h in zip(cols, ["Test", "Result", "Unit", "Reference range"]): d.text((x, y), h, font=SANSB(23), fill=BLACK)
    y += 54
    boxes = {}
    for name, val, unit, rng, flag in rows:
        d.text((cols[0], y), name, font=SANS(24), fill=BLACK)
        d.text((cols[2], y), unit, font=UNIT(21), fill=BLACK)
        d.text((cols[3], y), rng, font=SANS(24), fill=BLACK)
        d.line([cols[1] - 6, y + 40, cols[2] - 20, y + 40], fill=(180, 180, 190), width=1)
        ex, bx = hw(im, cols[1], y - 12, val, hand, size, color, slant, jit, 1.0, 2)
        boxes[name] = bx
        if flag: hw(im, ex + 14, y - 12, flag, hand, size, color, slant, jit)
        y += 62
    return y + 20, boxes

def l11(doc):
    """L11: hand-filled CBC form, look-alike digits."""
    im, d = page(A4)
    y = head(d, A4, "Udaharan Pathology Laboratory (fictional)", ["Example Road, Itahari  ·  Complete blood count"], nep="उदाहरण प्याथोलोजी प्रयोगशाला", color=(120, 30, 60))
    for k in ["Name", "Age/Sex", "Date"]:
        d.text((60, y), k + ":", font=SANSB(26), fill=BLACK); d.line([230, y + 36, 1150, y + 36], fill=GREY); y += 52
    hw(im, 250, y - 52 * 3 - 14, "Sita Kumari Namuna", "caveat", 54, BIRO, 0.14, 1.0, 1.0, 2)
    hw(im, 250, y - 52 * 2 - 14, "34 y / F", "caveat", 54, BIRO, 0.14, 1.0, 1.0, 2)
    hw(im, 250, y - 52 * 1 - 14, "2083/08/0[9~3]", "caveat", 54, BIRO, 0.14, 1.0, 1.0, 2)
    y += 30
    rows = [("Haemoglobin", "11.[8~6]", "g/dL", "12.0 – 15.5", "L"), ("Total WBC count", "7,[6~5]00", "/µL", "4,000 – 11,000", None),
            ("Neutrophils", "62", "%", "40 – 75", None), ("Lymphocytes", "3[1~7]", "%", "20 – 45", None),
            ("Platelet count", "2,[5~6]6,000", "/µL", "1,50,000 – 4,50,000", None), ("RBC count", "4.2", "million/µL", "3.8 – 5.2", None),
            ("MCV", "86", "fL", "80 – 100", None), ("ESR (1st hour)", "2[8~3]", "mm", "0 – 20", "H")]
    y, _ = form(im, d, y, rows, "caveat", 54, BIRO, 0.14, 0.9, title="COMPLETE BLOOD COUNT")
    hw(im, 760, 1500, "Lab Tech.", "caveat", 50, BIRO, 0.25, 1.2)
    doc.update(kind="lab_report", style="printed form (test, unit, range), results and flags written by hand in a fast slanted hand (Caveat); look-alike digits in five values",
        facility="Udaharan Pathology Laboratory (fictional)", patient=pat("Sita Kumari Namuna", "34 y", "F"),
        date={"as_written": "2083/08/09", "calendar": "BS"}, ordered_by=None,
        results=[res(n, v, u, r, f) for n, v, u, r, f in rows], comment=None, critical_values=[],
        traps=["flags L and H are hand-written next to the value: copy them as written", "9/3 in the date, 8/6 in haemoglobin, 6/5 in WBC, 1/7 in lymphocytes, 5/6 in platelets, 8/3 in ESR",
               "lakh grouping 2,56,000", "ranges are printed, so they are copied, never supplied"])
    doc["date"]["as_written"] = "2083/08/09"
    return im

def l12(doc):
    """L12: a lab slip written entirely by hand; the phone photo is of crumpled paper."""
    im, d = page(A5, (252, 250, 240), lines=150)
    hw(im, 60, 36, "Namuna Lab & Diagnostic", "beanie", 80, GEL, 0.1, 1.0)
    hw(im, 60, 118, "Gita Namuna  41/F", "beanie", 62, GEL, 0.12, 1.2, 1.0, 2)
    hw(im, 560, 118, "2083/08/15", "beanie", 62, GEL, 0.12, 1.2, 1.0, 2)
    y = 240
    rows = [("FBS", "112", "mg/dl", "70-110"), ("PPBS", "164", "mg/dl", "80-140"), ("Urea", "31", "mg/dl", "15-45"),
            ("Creatinine", "0.9", "mg/dl", "0.6-1.2"), ("Sodium", "138", "mmol/L", None), ("Potassium", "4.1", "mmol/L", None)]
    for n, v, u, r in rows:
        hw(im, 60, y, n, "beanie", 60, GEL, 0.12, 1.2, 1.0, 2)
        hw(im, 330, y, v, "beanie", 60, GEL, 0.12, 1.2, 1.0, 2)
        hw(im, 450, y, u, "beanie", 56, GEL, 0.12, 1.2, 1.0, 2)
        if r: hw(im, 650, y, r, "beanie", 56, GEL, 0.12, 1.2, 1.0, 2)
        y += 80
    hw(im, 520, y + 40, "Lab Tech", "beanie", 56, GEL, 0.12, 1.2)
    doc.update(kind="lab_report", style="slip written entirely by hand (Reenie Beanie), units and some ranges written by the technician; the PHOTO is crumpled",
        facility="Namuna Lab & Diagnostic", patient=pat("Gita Namuna", "41 y", "F"), date={"as_written": "2083/08/15", "calendar": "BS"},
        ordered_by=None, results=[res(n, "09" if n == "Creatinine" else v, u, r, None) for n, v, u, r in rows], comment=None, critical_values=[],
        traps=["creatinine: the decimal point was lost in the drawing, the page shows 09; copy it as written, never repair it from the range (0.6-1.2)", "units written as mg/dl (lower case)", "ranges written for four tests and absent for sodium and potassium: none may be added", "no flags: none may be added", "crumpled photo"])
    return im

def l13(doc):
    """L13: hand-filled lipid form with one over-written value and one smudged value."""
    im, d = page(A4, (252, 251, 247))
    y = head(d, A4, "Example Diagnostic Centre (fictional)", ["Tel 00-0000000  ·  Lipid profile"], nep="उदाहरण डायग्नोस्टिक सेन्टर", color=(20, 90, 110))
    for k in ["Name", "Age/Sex", "Date"]:
        d.text((60, y), k + ":", font=SANSB(26), fill=BLACK); d.line([230, y + 36, 1150, y + 36], fill=GREY); y += 52
    hw(im, 250, y - 52 * 3 - 14, "Hari Prasad Namuna", "shadows", 52, BIRO, 0.16, 1.0, 1.0, 2)
    hw(im, 250, y - 52 * 2 - 14, "62 y / M", "shadows", 52, BIRO, 0.16, 1.0, 1.0, 2)
    hw(im, 250, y - 52 * 1 - 14, "2083/08/16", "shadows", 52, BIRO, 0.16, 1.0, 1.0, 2)
    y += 30
    rows = [("Total cholesterol", "19[8>6]", "mg/dL", "< 200", None), ("Triglycerides", "180", "mg/dL", "< 150", "H"),
            ("HDL cholesterol", "42", "mg/dL", "> 40", None), ("LDL cholesterol", "118", "mg/dL", "< 100", "H"),
            ("VLDL cholesterol", "36", "mg/dL", "< 30", "H"), ("Non-HDL cholesterol", "154", "mg/dL", "< 130", "H")]
    y, boxes = form(im, d, y, rows, "shadows", 54, BIRO, 0.16, 1.0, title="LIPID PROFILE")
    hw(im, 60, y + 30, "Fasting 12 hr", "shadows", 50, BIRO, 0.16, 1.0)
    hw(im, 760, 1500, "Lab Tech.", "shadows", 52, BIRO, 0.16, 1.2)
    smudge(im, boxes["VLDL cholesterol"], 0.9, seed=7)
    rr = []
    for n, v, u, r, f in rows:
        t = res(n, v, u, r, f)
        if n == "VLDL cholesterol": t["value"] = ""
        rr.append(t)
    doc.update(kind="lab_report", style="printed form, values hand-written (Shadows Into Light Two); total cholesterol corrected by over-writing; the VLDL value smudged",
        facility="Example Diagnostic Centre (fictional)", patient=pat("Hari Prasad Namuna", "62 y", "M"), date={"as_written": "2083/08/16", "calendar": "BS"},
        ordered_by=None, results=rr, comment="Fasting 12 hr", critical_values=[], illegible=[{"item": "VLDL cholesterol", "field": "value"}],
        traps=["total cholesterol: the final (darker) 6 over an 8 is the value: 196", "VLDL value smudged beyond reading: the key leaves it empty; unit, range and the printed H stay readable", "flags H are hand-written next to the values"],
        links_to="P03/L03 of test set v1 (same fictional patient name)")
    return im

# ------------------------------------------------------------------ build

DOCS = [  # id, slug, function, photo strength, faded, crumpled depth
    ("P11", "pad-crowded-slanted", p11, 1.0, False, 0),
    ("P12", "overwritten-doses", p12, 1.2, False, 0),
    ("P13", "five-six-nine-three", p13, 1.0, False, 0),
    ("P14", "ink-smudge-duration", p14, 1.1, False, 0),
    ("P15", "nepali-hand-devanagari-digits", p15, 1.0, False, 0),
    ("P16", "crumpled-photo-cardiac", p16, 1.0, False, 1.0),
    ("P17", "pencil-stamp-invented-brands", p17, 1.2, False, 0),
    ("L11", "handfilled-cbc-lookalike-digits", l11, 1.0, False, 0),
    ("L12", "handwritten-slip-crumpled", l12, 1.0, False, 1.2),
    ("L13", "lipid-overwritten-smudged", l13, 1.1, False, 0.6),
]

def main():
    os.makedirs(f"{OUT}/clean", exist_ok=True); os.makedirs(f"{OUT}/photo", exist_ok=True)
    key = []
    for n, (did, slug, fn, strength, faded, crump) in enumerate(DOCS):
        doc = {"id": did, "file_clean": f"clean/{did}-{slug}.png", "file_photo": f"photo/{did}-{slug}.jpg",
               "fictional": True, "stamp": "SAMPLE · नमूना"}
        im = stamp(fn(doc))
        im.save(f"{OUT}/{doc['file_clean']}", optimize=True)
        phone_photo(im, strength, faded, crump, seed=100 + n).save(f"{OUT}/{doc['file_photo']}", quality=72)
        key.append(doc)
    with open(f"{OUT}/answer_key.json", "w", encoding="utf-8") as f:
        json.dump({"set": "Abhilekh fictional test set v2 (harder hand-writing)", "made": "2026-11-20",
                   "note": "Every person, clinician, clinic, lab and registration number is invented. Namucef and Udarol-SR are invented brands. "
                           "Ground truth is what the writer meant; fields smudged beyond reading are empty. dose_as_written and duration_as_written are the exact copies a reader should return.",
                   "documents": key}, f, ensure_ascii=False, indent=2)
    with open(f"{OUT}/answer_key.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["doc", "kind", "item", "as_written / test", "value / dose", "unit / strength", "range / duration", "DDA expected / flag printed"])
        for d in key:
            for m in d.get("medicines", []):
                w.writerow([d["id"], "medicine", m["generic"] or "(unknown)", m["as_written"], m["dose"], m["strength"], m["duration"], m["dda_expected"]])
            for r in d.get("results", []):
                w.writerow([d["id"], "result", r["test"], r["test"], r["value"], r["unit"], r["reference_range"], r["flag_printed"] or ""])
    print("ok", len(key))

if __name__ == "__main__":
    main()
