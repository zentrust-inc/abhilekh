#!/usr/bin/env python3
"""Abhilekh fictional test set v3: pages the reader has not been tuned on. Every document is invented and stamped SAMPLE / नमूना.

v1 and v2 were used to build and tune the reader and the scorer. v3 is the held-out set: new hands, new ways of
writing a dose, new damage. It is read once with the rules as they stand on main; nothing is changed after the scores
are seen (a key error found later is disclosed, as in v2).

Ten documents (7 prescriptions, 3 lab forms), each as a clean scan (clean/*.png) and a phone photo (photo/*.jpg):

  P21 doses as abbreviations (OD, BD, "1 tab BD", HS) and "continue"    P25 folded in four, a torn corner, a crease through the durations
  P22 child's syrup and zinc: ml doses, 2.5 ml, weight on the page        P26 narrow capitals; 1/7, 4/9, 0/6 look-alikes; glare + low light
  P23 fractions and decimals: 1/2-0-1/2, 0.5-0-0.5; 1/7, 4/9 look-alikes  P27 Devanagari doses and durations in weeks / months
  P24 faded carbon copy photographed at a steep angle                     L21 urine report: text results (Nil, Trace, Clear), SG 1.020
  L22 thyroid form: coffee ring, ink bleeding through from the back       L23 printed liver panel received as a fax

Differences from v2 that matter to the scorer: doses that are not digits in slots (OD, BD, 1 tab BD, ml, fractions,
decimals, Devanagari words), so the dash-tolerant rule must leave them alone; and a fraction that must not be read
as its digits run together (1/2-0-1/2 is not 12-0-12).

Ground truth is what the writer MEANT; a look-alike digit is the intended digit drawn with its look-alike (marker
[1~7]: intended 1, look-alike 7). No real patient, doctor, clinic or lab. Names use Namuna / Udaharan. The invented brand
Amoxinepa must be flagged by the DDA check as not found.

Run:  python3 make_test_set.py <out_dir> <font_dir>      (fonts: ../test-set-v2/fetch-fonts.sh then ./fetch-fonts.sh)
"""
import sys, os, re, json, csv, math, random, importlib.util
import numpy as np
from scipy.ndimage import gaussian_filter
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageChops, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("v2gen", os.path.join(HERE, "..", "test-set-v2", "make_test_set.py"))
g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)   # the v2 helpers: hw, smudge, crumple, form, med, res ...
OUT, FD = g.OUT, g.FD
random.seed(3085); g.random.seed(3085)

g.HANDS.update({
    "apple": ("homemade-apple-400.ttf", 0.78), "zeyada": ("zeyada-400.ttf", 1.55), "mansalva": ("mansalva-400.ttf", 1.0),
    "nothing": ("nothing-you-could-do-400.ttf", 1.0), "jah": ("just-another-hand-400.ttf", 1.45),
    "sue": ("sue-ellen-francisco-400.ttf", 1.3), "rock": ("rock-salt-400.ttf", 0.72), "amita": ("amita-400.ttf", 0.95),
})
_hw2 = g.hw
_DOT = re.compile(r"(?<=\d)\.(?=\d)")
def hw3(im, x, y, text, hand, size, color=g.BIRO, slant=0.18, jit=1.0, track=1.0, drift=0.0, alpha=238, slope=0.0, wobble=1.0):
    """g.hw, with a decimal point drawn as a visible dot: the hand fonts make the full stop of '2.5' almost vanish,
    and the key must describe what the page shows."""
    parts = _DOT.split(text)
    if len(parts) == 1:
        return _hw2(im, x, y, text, hand, size, color, slant, jit, track, drift, alpha, slope, wobble)
    k = g.HANDS[hand][1]; box = None; d = ImageDraw.Draw(im)
    for i, part in enumerate(parts):
        x, b = _hw2(im, x, y, part, hand, size, color, slant, jit, track, drift, alpha, slope, wobble)
        box = b if box is None else (box[0], min(box[1], b[1]), b[2], max(box[3], b[3]))
        if i < len(parts) - 1:
            r = max(3.0, size * k * 0.075) * random.uniform(0.9, 1.15)
            bot = g.F(g.HANDS[hand][0], int(size * k)).getbbox("5")[3]          # bottom of a digit in this hand
            cx, cy = x + size * k * 0.10, y + bot - r * 1.3 + random.uniform(-2, 2)
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=tuple(color) + (alpha,))
            x += size * k * 0.24
    return x, box
g.hw = hw3
hw, med, res, pat, rx_line, page, head, final = hw3, g.med, g.res, g.pat, g.rx_line, g.page, g.head, g.final
A4, A5, BIRO, GEL, BLACK, GREY, PENCIL = g.A4, g.A5, g.BIRO, g.GEL, g.BLACK, g.GREY, g.PENCIL
INVENTED = g.INVENTED
RNGS = np.random.default_rng(3085)

# ------------------------------------------------------------------ new faults

def folds(im, xs=(), ys=(), strength=1.0):
    """Paper folded and flattened: a pale crease with a dark edge, shifting nothing but catching light."""
    a = np.asarray(im.convert("RGB"), np.float32)
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    shade = np.zeros((h, w), np.float32)
    for x in xs: shade += np.exp(-((xx - x) / 3.0) ** 2) * -38 + np.exp(-((xx - x - 7) / 5.0) ** 2) * 32
    for y in ys: shade += np.exp(-((yy - y) / 3.0) ** 2) * -38 + np.exp(-((yy - y - 7) / 5.0) ** 2) * 32
    a += shade[..., None] * strength
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def torn_corner(im, size=230, bg=(96, 78, 60)):
    """The top-right corner torn off: the page ends in a ragged diagonal; what was there is gone."""
    w, h = im.size
    r = random.Random(5)
    pts = [(w - size, 0)]
    n = 14
    for i in range(1, n):
        t = i / n
        pts.append((w - size + size * t + r.uniform(-9, 9), size * t + r.uniform(-9, 9)))
    pts += [(w, size), (w, 0)]
    m = Image.new("L", im.size, 0); ImageDraw.Draw(m).polygon(pts, fill=255)
    out = im.convert("RGB"); out.paste(Image.new("RGB", im.size, bg), (0, 0), m)
    edge = Image.new("L", im.size, 0); ImageDraw.Draw(edge).line(pts[:-2], fill=255, width=7)
    out.paste(Image.new("RGB", im.size, (240, 236, 228)), (0, 0), edge.filter(ImageFilter.GaussianBlur(2)))
    return out

def coffee_ring(im, cx, cy, r, alpha=70):
    """A mug ring: a thin brown ring, darker where it dried, with a faint stain inside."""
    lay = Image.new("RGBA", im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(lay)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(140, 95, 50, int(alpha * 0.35)))
    for k, a in ((0, 1.0), (5, 0.6), (11, 0.3)):
        d.ellipse([cx - r + k, cy - r + k * 0.8, cx + r - k, cy + r - k * 0.8], outline=(120, 78, 36, int(alpha * 1.6 * a)), width=7 - k // 3)
    lay = lay.filter(ImageFilter.GaussianBlur(1.6))
    base = im.convert("RGBA"); base.alpha_composite(lay)
    return base.convert("RGB")

def bleed_through(im, lines, hand="rock", size=46, alpha=46):
    """Writing from the back of the sheet showing through, mirrored and faint."""
    lay = Image.new("RGB", im.size, (255, 255, 255))
    y = 380
    for t in lines:
        g.hw(lay, 140, y, t, hand, size, (60, 60, 90), 0.1, 1.0, 1.0, 2, alpha=255); y += 150
    mir = ImageOps.mirror(lay).filter(ImageFilter.GaussianBlur(2.2))
    mir = ImageChops.multiply(Image.new("RGB", im.size, (255, 255, 255)), Image.blend(Image.new("RGB", im.size, (255, 255, 255)), mir, alpha / 255))
    return ImageChops.multiply(im.convert("RGB"), mir)

def glare(im, cx, cy, rx, ry, strength=0.85):
    """A camera-flash highlight washing out part of the page."""
    a = np.asarray(im.convert("RGB"), np.float32)
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    m = np.exp(-(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2) ** 1.4)
    a = a * (1 - strength * m[..., None]) + 255 * strength * m[..., None]
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def photo_std(im, strength=1.0, crumpled=0.0, seed=0, steep=False, faded=False):
    return g.phone_photo(im, strength, faded, crumpled, seed)

def photo_steep(im, seed=0):
    """Taken from a steep angle, with a finger shadow along one edge."""
    out = g.phone_photo(im, 2.0, False, 0.0, seed)
    sh = Image.new("L", out.size, 0); d = ImageDraw.Draw(sh)
    d.polygon([(0, out.height * 0.62), (out.width * 0.16, out.height * 0.68), (out.width * 0.15, out.height), (0, out.height)], fill=95)
    return Image.composite(Image.new("RGB", out.size, (0, 0, 0)), out, sh.filter(ImageFilter.GaussianBlur(45)))

def photo_lowlight_glare(im, glare_at, seed=0):
    out = g.phone_photo(im, 1.2, False, 0.0, seed)
    out = ImageEnhance.Brightness(out).enhance(0.55)
    out = ImageEnhance.Contrast(out).enhance(0.85)
    gx, gy = int(out.width * glare_at[0]), int(out.height * glare_at[1])
    out = glare(out, gx, gy, out.width * 0.12, out.height * 0.04, 0.72)
    arr = np.asarray(out, np.float32) + RNGS.normal(0, 7, (out.height, out.width, 3))     # sensor noise in low light
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))

def photo_fax(im, seed=0):
    """A fax: shrunk, thresholded with noise, scan-line dropouts, a slight skew and a streak."""
    r = np.random.default_rng(seed)
    g1 = im.convert("L").resize((int(im.width * 0.62), int(im.height * 0.62)), Image.LANCZOS)
    a = np.asarray(g1, np.float32) + r.normal(0, 18, (g1.height, g1.width))
    a = gaussian_filter(a, 0.7)
    b = np.where(a < 168, 0, 255).astype(np.uint8)
    for y in r.integers(0, b.shape[0], 14): b[y:y + r.integers(1, 3), :] = 255          # dropped scan lines
    b[:, int(b.shape[1] * 0.83):int(b.shape[1] * 0.83) + 3] = np.where(r.random((b.shape[0], 3)) < 0.5, 0, b[:, int(b.shape[1] * 0.83):int(b.shape[1] * 0.83) + 3])
    out = Image.fromarray(b).convert("RGB").rotate(0.8, resample=Image.BICUBIC, fillcolor=(255, 255, 255))
    d = ImageDraw.Draw(out); d.text((20, 10), "FAX  00-0000000   P.1/1", font=g.UNIT(18), fill=(0, 0, 0))
    return out

def printed_form(im, d, y, rows, cols=(60, 520, 700, 940), title=None):
    """Lab form where everything, results included, is printed (a fax of a printed report)."""
    if title: d.text((60, y), title, font=g.SANSB(28), fill=(130, 20, 40)); y += 46
    d.rectangle([55, y - 6, im.width - 55, y + 38], fill=(238, 238, 244))
    for x, h in zip(cols, ["Test", "Result", "Unit", "Reference range"]): d.text((x, y), h, font=g.SANSB(23), fill=BLACK)
    y += 54
    for name, val, unit, rng, flag in rows:
        d.text((cols[0], y), name, font=g.SANS(24), fill=BLACK)
        d.text((cols[1], y), val + (f"   {flag}" if flag else ""), font=g.SANSB(25), fill=BLACK)
        d.text((cols[2], y), unit, font=g.UNIT(21), fill=BLACK)
        d.text((cols[3], y), rng or "", font=g.SANS(24), fill=BLACK)
        d.line([55, y + 40, im.width - 55, y + 40], fill=(210, 210, 215), width=1)
        y += 58
    return y + 20

# ------------------------------------------------------------------ prescriptions

def p21(doc):
    """P21: doses written as abbreviations."""
    im, d = page(A4)
    y = head(d, A4, "Dr. M. Namuna, MBBS MD", ["Example Medical Centre, Biratnagar  ·  NMC 00000 (fictional)"], nep="उदाहरण मेडिकल सेन्टर", color=(60, 50, 110))
    c = GEL
    hw(im, 70, y + 10, "Ram Bahadur Udaharan  58/M", "apple", 50, c, 0.1, 1.0, 1.0, 3)
    hw(im, 70, y + 92, "Date 21/11/2026", "apple", 50, c, 0.1, 1.0, 1.0, 3)
    hw(im, 70, y + 174, "HTN, DM-2, hypothyroid", "apple", 48, c, 0.1, 1.0, 1.0, 3)
    y += 300
    hw(im, 70, y, "Rx", "apple", 80, c, 0.1, 1.0); y += 110
    items = [("Tab Amlodipine 5 mg", "OD", "x 1 month"), ("Tab Losartan 50 mg", "BD", "x 1 month"),
             ("Tab Gliclazide 80 mg", "1 tab BD", "continue"), ("Tab Levothyroxine 50 mcg", "OD empty stomach", "x 3 mo"),
             ("Tab Furosemide 40 mg", "OD mane", "till review")]
    for i, (n, ds, du) in enumerate(items):
        ex, _ = hw(im, 80, y, f"{i+1}. {n}", "apple", 46, c, 0.1, 1.0, 1.0, 3)
        ex2, _ = hw(im, max(600, ex + 16), y, ds, "apple", 46, c, 0.1, 1.0, 1.0, 3)
        hw(im, max(900, ex2 + 14), y + 46, du, "apple", 44, c, 0.1, 1.0, 1.0, 3)      # duration under the dose, right-aligned: a layout v1/v2 never used
        y += 112
    hw(im, 70, y + 20, "Review with TSH, HbA1c", "apple", 46, c, 0.1, 1.0, 1.0, 3)
    hw(im, 760, 1560, "M. Namuna", "apple", 56, c, 0.1, 1.2)
    doc.update(kind="prescription", style="loopy cursive hand (Homemade Apple); doses written as abbreviations, durations on a second line",
        facility="Example Medical Centre, Biratnagar", clinician="Dr. M. Namuna", clinician_reg="NMC 00000 (fictional)",
        patient=pat("Ram Bahadur Udaharan", "58 y", "M"), date={"as_written": "21/11/2026", "calendar": "AD"},
        diagnosis_as_written="HTN, DM-2, hypothyroid",
        medicines=[med("Tab Amlodipine 5 mg", "amlodipine", "5 mg", "tablet", "once daily (OD)", "OD", "1 month", "x 1 month"),
                   med("Tab Losartan 50 mg", "losartan", "50 mg", "tablet", "twice daily (BD)", "BD", "1 month", "x 1 month"),
                   med("Tab Gliclazide 80 mg", "gliclazide", "80 mg", "tablet", "1 tablet twice daily", "1 tab BD", "continue", "continue"),
                   med("Tab Levothyroxine 50 mcg", "levothyroxine", "50 mcg", "tablet", "once daily, empty stomach", "OD empty stomach", "3 months", "x 3 mo"),
                   med("Tab Furosemide 40 mg", "furosemide", "40 mg", "tablet", "once daily, morning", "OD mane", "till review", "till review")],
        advice=["Review with TSH, HbA1c"],
        traps=["doses are letters or words (OD, BD, 1 tab BD, OD mane): copy them, never turn them into 1-0-0 or 1-0-1", "durations 'continue' and 'till review' are not numbers: copy as written", "duration on a second line below the dose, not beside it"])
    return im

def p22(doc):
    """P22: a child's prescription: syrups in ml, 2.5 ml, weight on the page."""
    im, d = page(A5, (252, 250, 243))
    y = head(d, A5, "Dr. N. Udaharan  MBBS DCH", ["Example Child Clinic, Bhaktapur  ·  NMC 00000 (fictional)"], color=(30, 120, 100), small=True)
    c = BIRO
    hw(im, 60, y + 2, "Aarav Namuna  4 y/M  wt 14 kg", "mansalva", 44, c, 0.12, 1.0, 1.0, 2)
    hw(im, 560, y + 54, "22/11/2026", "mansalva", 44, c, 0.12, 1.0, 1.0, 2)
    hw(im, 60, y + 54, "fever, cough x 3 d", "mansalva", 42, c, 0.12, 1.0, 1.0, 2)
    y += 140
    hw(im, 50, y, "Rx", "mansalva", 70, c, 0.1, 1.0); y += 72
    items = [("Syp Paracetamol 125 mg/5 ml", "5 ml TDS", "x 3 days"), ("Syp Amoxinepa 250 mg/5 ml", "5 ml BD", "x 5 days"),
             ("Syp Salbutamol 2 mg/5 ml", "2.5 ml TDS", "x 3 days"), ("Tab Zinc sulfate 20 mg", "1 tab OD", "x 10 days"), ("ORS", "after each loose stool", None)]
    for i, (n, ds, du) in enumerate(items):
        ex, _ = hw(im, 60, y, f"{i+1}) {n}", "mansalva", 40, c, 0.12, 1.0, 1.0, 2)
        hw(im, 70, y + 42, ds + ("      " + du if du else ""), "mansalva", 40, c, 0.12, 1.0, 1.0, 2)
        y += 96
    hw(im, 60, y + 4, "plenty of fluids", "mansalva", 40, c, 0.12, 1.0, 1.0, 2)
    hw(im, 520, y + 70, "N. Udaharan", "mansalva", 48, c, 0.15, 1.2, 0.9, 2)
    doc.update(kind="prescription", style="small pad, round child-clinic hand (Mansalva); syrups dosed in ml, dose and duration on a second line under each name",
        facility="Example Child Clinic, Bhaktapur", clinician="Dr. N. Udaharan", clinician_reg=None,
        patient=pat("Aarav Namuna", "4 y", "M"), date={"as_written": "22/11/2026", "calendar": "AD"},
        diagnosis_as_written="fever, cough x 3 d",
        medicines=[med("Syp Paracetamol 125 mg/5 ml", "paracetamol", "125 mg/5 ml", "syrup", "5 ml three times daily", "5 ml TDS", "3 days", "x 3 days"),
                   med("Syp Amoxinepa 250 mg/5 ml", None, "250 mg/5 ml", "syrup", "5 ml twice daily", "5 ml BD", "5 days", "x 5 days", dda=INVENTED),
                   med("Syp Salbutamol 2 mg/5 ml", "salbutamol", "2 mg/5 ml", "syrup", "2.5 ml three times daily", "2.5 ml TDS", "3 days", "x 3 days"),
                   med("Tab Zinc sulfate 20 mg", "zinc sulfate", "20 mg", "tablet", "1 tablet once daily", "1 tab OD", "10 days", "x 10 days"),
                   med("ORS", "oral rehydration salts", None, "powder", "after each loose stool", "after each loose stool", None, None)],
        advice=["plenty of fluids"],
        traps=["2.5 ml: the decimal point matters, 25 ml would be ten times the dose", "'125 mg/5 ml' contains a slash: copy it, do not turn it into 1255", "Amoxinepa is an invented brand: shown as written and flagged, never mapped to amoxicillin", "weight 14 kg is not a dose", "ORS has no duration: leave empty"])
    return im

def p23(doc):
    """P23: fractions and decimals, with look-alike digits."""
    im, d = page(A4)
    y = head(d, A4, "Dr. O. Namuna  MBBS", ["Example Polyclinic, Nepalgunj  ·  NMC 00000 (fictional)"], color=(100, 40, 70))
    c = BIRO
    hw(im, 70, y + 10, "Radha Devi Udaharan  74/F", "zeyada", 46, c, 0.14, 1.0, 1.0, 2)
    hw(im, 70, y + 90, "Date 2083/08/[1~7]", "zeyada", 46, c, 0.14, 1.0, 1.0, 2)
    hw(im, 70, y + 170, "HTN, CKD stage 3, fluid overload", "zeyada", 46, c, 0.14, 1.0, 1.0, 2)
    y += 290
    hw(im, 70, y, "Rx", "zeyada", 80, c, 0.14, 1.0); y += 118
    items = [("Tab Losartan 25 mg", "1/2-0-1/2", "x 1 month"), ("Tab Furosemide 20 mg", "1/2-0-0", "x [1~7] days"),
             ("Tab Prednisolone 5 mg", "0.5-0-0.5", "x [1~7] days"), ("Tab Amlodipine 2.5 mg", "0-0-1", "x 1 month"),
             ("Tab Folic acid 5 mg", "[1~7]-0-0", "x 3 months")]
    for i, (n, ds, du) in enumerate(items):
        rx_line(im, 80, y, n, ds, du, "zeyada", 42, c, 0.14, gx=(610, 930), jit=1.0, num=f"{i+1}.")
        y += 100
    hw(im, 70, y + 24, "Wt daily, salt restriction", "zeyada", 44, c, 0.14, 1.0, 1.0, 2)
    hw(im, 780, 1560, "O. Namuna", "zeyada", 54, c, 0.14, 1.2)
    doc.update(kind="prescription", style="thin pen hand (Zeyada); fractional and decimal doses; 1/7 look-alikes in the date, durations and a dose",
        facility="Example Polyclinic, Nepalgunj", clinician="Dr. O. Namuna", clinician_reg="NMC 00000 (fictional)",
        patient=pat("Radha Devi Udaharan", "74 y", "F"), date={"as_written": "2083/08/1", "calendar": "BS"},
        diagnosis_as_written="HTN, CKD stage 3, fluid overload",
        medicines=[med("Tab Losartan 25 mg", "losartan", "25 mg", "tablet", "half a tablet morning and night", "1/2-0-1/2", "1 month", "x 1 month"),
                   med("Tab Furosemide 20 mg", "furosemide", "20 mg", "tablet", "half a tablet in the morning", "1/2-0-0", "1 day", "x [1~7] days"),
                   med("Tab Prednisolone 5 mg", "prednisolone", "5 mg", "tablet", "0.5 morning and night", "0.5-0-0.5", "1 day", "x [1~7] days"),
                   med("Tab Amlodipine 2.5 mg", "amlodipine", "2.5 mg", "tablet", "once at night", "0-0-1", "1 month", "x 1 month"),
                   med("Tab Folic acid 5 mg", "folic acid", "5 mg", "tablet", "once in the morning", "[1~7]-0-0", "3 months", "x 3 months")],
        advice=["Wt daily, salt restriction"],
        traps=["fractions: 1/2-0-1/2 must not become 12-0-12 or 1-0-1, and 0.5-0-0.5 must not become 5-0-5", "2.5 mg strength: the decimal point matters", "1 written like 7 in the date (2083/08/1, no leading zero), in two durations and in the folic acid dose; the intended digit is 1", "the dash-tolerant dose rule must leave 1/2-0-1/2 and 0.5-0-0.5 alone"])
    return im

def p24(doc):
    """P24: a faded carbon copy, photographed at a steep angle."""
    im, d = page(A4, (236, 240, 248))
    y = head(d, A4, "Dr. P. Udaharan  MBBS", ["Example Hospital, Dang  ·  NMC 00000 (fictional)  ·  patient copy"], nep="उदाहरण अस्पताल", color=(110, 130, 170))
    c = (84, 98, 150)
    hw(im, 70, y + 10, "Mina Kumari Namuna  36/F", "nothing", 52, c, 0.1, 1.0, 1.0, 3, alpha=170)
    hw(im, 70, y + 92, "Date 2083/08/22", "nothing", 52, c, 0.1, 1.0, 1.0, 3, alpha=170)
    hw(im, 70, y + 174, "cellulitis R leg", "nothing", 50, c, 0.1, 1.0, 1.0, 3, alpha=170)
    y += 300
    hw(im, 70, y, "Rx", "nothing", 84, c, 0.1, 1.0, alpha=170); y += 118
    items = [("Cap Doxycycline 100 mg", "1-0-1", "x 7 d"), ("Tab Ibuprofen 400 mg", "1-1-1", "x 3 d"),
             ("Tab Levocetirizine 5 mg", "0-0-1", "x 5 d"), ("Tab Paracetamol 500 mg", "1-1-1", "x 3 d")]
    for i, (n, ds, du) in enumerate(items):
        rx_line(im, 80, y, n, ds, du, "nothing", 50, c, 0.1, gx=(640, 860), jit=1.0, num=f"{i+1}.")
        y += 100
    hw(im, 70, y + 24, "elevate leg, review 1 wk", "nothing", 48, c, 0.1, 1.0, 1.0, 3, alpha=170)
    hw(im, 780, 1560, "P. Udaharan", "nothing", 56, c, 0.1, 1.2, alpha=170)
    doc.update(kind="prescription", style="pale-blue carbon copy, faint pen (Nothing You Could Do); the PHOTO is taken at a steep angle with a finger shadow",
        facility="Example Hospital, Dang", clinician="Dr. P. Udaharan", clinician_reg="NMC 00000 (fictional)",
        patient=pat("Mina Kumari Namuna", "36 y", "F"), date={"as_written": "2083/08/22", "calendar": "BS"},
        diagnosis_as_written="cellulitis R leg",
        medicines=[med("Cap Doxycycline 100 mg", "doxycycline", "100 mg", "capsule", "1-0-1", "1-0-1", "7 days", "x 7 d"),
                   med("Tab Ibuprofen 400 mg", "ibuprofen", "400 mg", "tablet", "1-1-1", "1-1-1", "3 days", "x 3 d"),
                   med("Tab Levocetirizine 5 mg", "levocetirizine", "5 mg", "tablet", "0-0-1", "0-0-1", "5 days", "x 5 d"),
                   med("Tab Paracetamol 500 mg", "paracetamol", "500 mg", "tablet", "1-1-1", "1-1-1", "3 days", "x 3 d")],
        advice=["elevate leg, review 1 wk"],
        traps=["low contrast: faint blue-grey ink on pale blue paper", "steep photo angle and a shadow across the left part of the lower lines", "1-0-1, 1-1-1, 0-0-1, 1-1-1 differ by a single digit (ibuprofen and paracetamol share 1-1-1 x 3 d)"])
    return im

def p25(doc):
    """P25: folded in four, a corner torn off, a crease through the duration column."""
    im, d = page(A5, (251, 249, 240))
    y = head(d, A5, "Dr. Q. Namuna  MBBS", ["Example Clinic, Lalitpur  ·  Reg. 00000 (fictional)"], color=(90, 70, 40), small=True)
    c = BIRO
    hw(im, 60, y + 4, "Suresh Udaharan  27/M", "jah", 50, c, 0.1, 1.0, 1.0, 2)
    hw(im, 540, y + 54, "23/11/2026", "jah", 50, c, 0.1, 1.0, 1.0, 2)
    hw(im, 60, y + 54, "loose motion, vomiting x 2 d", "jah", 48, c, 0.1, 1.0, 1.0, 2)
    y += 140
    hw(im, 50, y, "Rx", "jah", 80, c, 0.1, 1.0); y += 76
    items = [("Tab Cefixime 200 mg", "1-0-1", "x 5 days"), ("Tab Metronidazole 400 mg", "1-1-1", "x 5 days"),
             ("Tab Domperidone 10 mg", "1-0-1", "x 5 days"), ("Tab Ranitidine 150 mg", "1-0-1", "x 14 days")]
    for i, (n, ds, du) in enumerate(items):
        rx_line(im, 60, y, n, ds, du, "jah", 48, c, 0.1, gx=(560, 700), jit=0.8, track=1.12, num=f"{i+1})")
        y += 74
    hw(im, 60, y + 14, "ORS, soft diet", "jah", 50, c, 0.1, 1.0, 1.0, 2)
    hw(im, 520, y + 84, "Q. Namuna", "jah", 56, c, 0.1, 1.2)
    im = folds(im, xs=[728], ys=[int(A5[1] * 0.5)], strength=0.9)     # the vertical crease runs through the duration column
    im = torn_corner(im, 210)
    doc.update(kind="prescription", style="tall narrow hand (Just Another Hand) on a small pad; folded in four (a vertical crease through the durations) with the top-right corner torn off",
        facility="Example Clinic, Lalitpur", clinician="Dr. Q. Namuna", clinician_reg=None,
        patient=pat("Suresh Udaharan", "27 y", "M"), date={"as_written": "23/11/2026", "calendar": "AD"},
        diagnosis_as_written="loose motion, vomiting x 2 d",
        medicines=[med("Tab Cefixime 200 mg", "cefixime", "200 mg", "tablet", "1-0-1", "1-0-1", "5 days", "x 5 days"),
                   med("Tab Metronidazole 400 mg", "metronidazole", "400 mg", "tablet", "1-1-1", "1-1-1", "5 days", "x 5 days"),
                   med("Tab Domperidone 10 mg", "domperidone", "10 mg", "tablet", "1-0-1", "1-0-1", "5 days", "x 5 days"),
                   med("Tab Ranitidine 150 mg", "ranitidine", "150 mg", "tablet", "1-0-1", "1-0-1", "14 days", "x 14 days")],
        advice=["ORS, soft diet"],
        traps=["a fold crease runs down through the first digits of the durations", "the torn corner removed part of the header (not scored); every scored field is still on the page", "four near-identical dose patterns: 1-0-1 / 1-1-1"])
    return im

def p26(doc):
    """P26: narrow capitals, new look-alike pairs, a photo with glare and low light."""
    im, d = page(A4)
    y = head(d, A4, "Dr. R. Udaharan  MBBS", ["Example Medical Hall, Hetauda  ·  NMC 00000 (fictional)"], color=(40, 90, 50))
    c = PENCIL
    hw(im, 70, y + 10, "GOPAL NAMUNA  47/M", "sue", 54, c, 0.0, 1.0, 1.0, 2)
    hw(im, 70, y + 92, "DATE 2083/08/[2~7]4", "sue", 54, c, 0.0, 1.0, 1.0, 2)
    hw(im, 70, y + 174, "CHEST PAIN, ? ANGINA", "sue", 54, c, 0.0, 1.0, 1.0, 2)
    y += 300
    hw(im, 70, y, "RX", "sue", 86, c, 0.0, 1.0); y += 160
    items = [("TAB ASPIRIN 75 MG", "0-1-0", "X [4~9] DAYS"), ("TAB AMLODIPINE 5 MG", "[1~7]-0-0", "X 1 MONTH"),
             ("TAB LOSARTAN 50 MG", "1-0-[1~7]", "X [1~7] MONTH"), ("TAB OMEPRAZOLE 20 MG", "[0~6]-0-1", "X [4~9] WEEKS")]
    for i, (n, ds, du) in enumerate(items):
        rx_line(im, 80, y, n, ds, du, "sue", 52, c, 0.0, gx=(700, 920), jit=1.0, num=f"{i+1}.")
        y += 104
    hw(im, 70, y + 24, "ECG, TROP-I TODAY", "sue", 52, c, 0.0, 1.0, 1.0, 2)
    hw(im, 760, 1560, "R. UDAHARAN", "sue", 56, c, 0.0, 1.2)
    doc.update(kind="prescription", style="narrow pencil capitals (Sue Ellen Francisco), all upper case; 1/7, 4/9, 0/6 and 2/7 look-alikes; the PHOTO is under-exposed with a flash highlight over the middle lines",
        facility="Example Medical Hall, Hetauda", clinician="Dr. R. Udaharan", clinician_reg="NMC 00000 (fictional)",
        patient=pat("Gopal Namuna", "47 y", "M"), date={"as_written": "2083/08/24", "calendar": "BS"},
        diagnosis_as_written="CHEST PAIN, ? ANGINA",
        medicines=[med("TAB ASPIRIN 75 MG", "aspirin", "75 mg", "tablet", "0-1-0", "0-1-0", "4 days", "X [4~9] DAYS"),
                   med("TAB AMLODIPINE 5 MG", "amlodipine", "5 mg", "tablet", "1-0-0", "[1~7]-0-0", "1 month", "X 1 MONTH"),
                   med("TAB LOSARTAN 50 MG", "losartan", "50 mg", "tablet", "1-0-1", "1-0-[1~7]", "1 month", "X [1~7] MONTH"),
                   med("TAB OMEPRAZOLE 20 MG", "omeprazole", "20 mg", "capsule", "0-0-1", "[0~6]-0-1", "4 weeks", "X [4~9] WEEKS")],
        advice=["ECG, TROP-I TODAY"],
        traps=["upper-case writing: the characters are the same whatever the case", "1 drawn like 7, 4 like 9, 0 like 6, 2 like 7: a reader that cannot tell must leave the field empty, not guess", "photo: a flash highlight washes out part of the page and the rest is under-exposed"])
    return im

def p27(doc):
    """P27: Devanagari doses and durations in weeks and months."""
    im, d = page(A4)
    y = head(d, A4, "डा. एस. उदाहरण", ["Example Health Post, Dolakha  ·  NMC 00000 (fictional)"], nep="उदाहरण स्वास्थ्य चौकी", color=(60, 100, 50))
    c = BIRO
    hw(im, 70, y + 8, "Kamal Namuna  33/M", "kalam", 52, c, 0.1, 1.0, 1.0, 3)
    hw(im, 70, y + 88, "मिति २०८३ मंसिर ५", "kalam", 52, c, 0.1, 1.0, 1.0, 3)
    hw(im, 70, y + 168, "पेट दुख्ने, कमजोरी", "amita", 50, c, 0.1, 1.0, 1.0, 3)
    y += 300
    hw(im, 70, y, "Rx", "kalam", 84, c, 0.1, 1.0); y += 118
    items = [("Tab Albendazole 400 mg", "एक पटक", None), ("Tab Folic acid 5 mg", "बिहान १", "३ महिना"),
             ("Cap Omeprazole 20 mg", "खाली पेटमा १", "२ हप्ता"), ("Tab Metronidazole 400 mg", "१-१-१", "७ दिन")]
    for i, (n, ds, du) in enumerate(items):
        ex, _ = hw(im, 80, y, f"{i+1}. {n}", "kalam", 50, c, 0.1, 1.0, 1.0, 3)
        ex2, _ = hw(im, max(640, ex + 20), y, ds, "kalam" if re.search("[०-९]", ds) else "amita", 48, c, 0.1, 1.0, 1.0, 3)
        if du: hw(im, 930, y, du, "kalam" if re.search("[०-९]", du) else "amita", 48, c, 0.1, 1.0, 1.0, 3)
        y += 100
    y += 24
    hw(im, 70, y, "२ हप्तामा फेरि आउने", "kalam", 48, c, 0.1, 1.0, 1.0, 3)
    hw(im, 780, 1560, "डा. एस. उदाहरण", "amita", 52, c, 0.1, 1.2)
    doc.update(kind="prescription", style="Devanagari calligraphic hand (Amita) with English drug names in Kalam; doses in Devanagari words and digits, durations in weeks and months",
        facility="Example Health Post, Dolakha", clinician="डा. एस. उदाहरण", clinician_reg="NMC 00000 (fictional)",
        patient=pat("Kamal Namuna", "33 y", "M"), date={"as_written": "२०८३ मंसिर ५", "calendar": "BS"},
        diagnosis_as_written="पेट दुख्ने, कमजोरी",
        medicines=[med("Tab Albendazole 400 mg", "albendazole", "400 mg", "tablet", "once", "एक पटक", None, None),
                   med("Tab Folic acid 5 mg", "folic acid", "5 mg", "tablet", "1 in the morning", "बिहान १", "3 months", "३ महिना"),
                   med("Cap Omeprazole 20 mg", "omeprazole", "20 mg", "capsule", "1 on an empty stomach", "खाली पेटमा १", "2 weeks", "२ हप्ता"),
                   med("Tab Metronidazole 400 mg", "metronidazole", "400 mg", "tablet", "1-1-1", "१-१-१", "7 days", "७ दिन")],
        advice=["२ हप्तामा फेरि आउने (return in 2 weeks)"],
        traps=["date with a Nepali month name: कार्तिक/मंसिर written in words, not digits", "doses in Devanagari words (एक पटक, बिहान १, खाली पेटमा १): copy as written, do not translate or turn into digits", "durations in weeks and months (हप्ता, महिना), a unit v1 and v2 never had", "the first line has no duration: leave empty"])
    return im

# ------------------------------------------------------------------ lab forms

def head_lab(im, d, nep, name, sub, color):
    y = head(d, A4, name, sub, nep=nep, color=color)
    for k in ["Name", "Age/Sex", "Date"]:
        d.text((60, y), k + ":", font=g.SANSB(26), fill=BLACK); d.line([230, y + 36, 1150, y + 36], fill=GREY); y += 52
    return y

def l21(doc):
    """L21: a hand-filled urine report with text results."""
    im, d = page(A4)
    y = head_lab(im, d, "उदाहरण प्याथोलोजी", "Namuna Clinical Laboratory (fictional)", ["Example Marg, Birgunj  ·  Urine routine examination"], (110, 70, 30))
    hw(im, 250, y - 52 * 3 - 14, "Parbati Udaharan", "nothing", 50, BIRO, 0.1, 1.0, 1.0, 2)
    hw(im, 250, y - 52 * 2 - 14, "52 y / F", "nothing", 50, BIRO, 0.1, 1.0, 1.0, 2)
    hw(im, 250, y - 52 * 1 - 14, "24/11/2026", "nothing", 50, BIRO, 0.1, 1.0, 1.0, 2)
    y += 30
    rows = [("Colour", "Pale yellow", "", "Pale yellow", None), ("Appearance", "Clear", "", "Clear", None), ("Reaction", "Acidic", "", "Acidic", None),
            ("Specific gravity", "1.020", "", "1.005 – 1.030", None), ("Protein", "Trace", "", "Nil", None), ("Sugar", "Nil", "", "Nil", None),
            ("Pus cells", "2-4", "/HPF", "0 – 5", None), ("RBC", "Nil", "/HPF", "0 – 2", None), ("Epithelial cells", "6-8", "/HPF", "0 – 5", "H")]
    y, _ = g.form(im, d, y, rows, "nothing", 50, BIRO, 0.1, 1.0, title="URINE R/E")
    hw(im, 760, 1520, "Lab Tech.", "nothing", 48, BIRO, 0.2, 1.2)
    doc.update(kind="lab_report", style="printed form, results written by hand (Nothing You Could Do): words, a decimal and ranges as results",
        facility="Namuna Clinical Laboratory (fictional)", patient=pat("Parbati Udaharan", "52 y", "F"), date={"as_written": "24/11/2026", "calendar": "AD"},
        ordered_by=None, results=[res(n, v, u, r, f) for n, v, u, r, f in rows], comment=None, critical_values=[],
        traps=["results that are words (Pale yellow, Clear, Trace, Nil): copied as written", "'2-4' and '6-8' are ranges of counts, not subtractions; '/HPF' is the unit", "specific gravity 1.020 keeps its trailing zero", "protein 'Trace' against a printed range of 'Nil': no flag is printed for it and none may be added; epithelial cells 6-8 carries a hand-written H"])
    return im

def l22(doc):
    """L22: a thyroid form with a coffee ring on one value and writing bleeding through from the back."""
    im, d = page(A4, (252, 250, 244))
    y = head_lab(im, d, "उदाहरण डायग्नोस्टिक", "Example Thyroid & Vitamin Centre (fictional)", ["Tel 00-0000000  ·  Thyroid profile, anti-TPO, vitamin D"], (30, 110, 120))
    hw(im, 250, y - 52 * 3 - 14, "Sarita Namuna", "rock", 40, BIRO, 0.1, 1.0, 1.0, 2)
    hw(im, 250, y - 52 * 2 - 14, "39 y / F", "rock", 40, BIRO, 0.1, 1.0, 1.0, 2)
    hw(im, 250, y - 52 * 1 - 14, "25/11/2026", "rock", 40, BIRO, 0.1, 1.0, 1.0, 2)
    y += 30
    rows = [("TSH", "2.45", "µIU/mL", "0.40 – 4.00", None), ("Free T4", "1.1", "ng/dL", "0.8 – 1.8", None), ("Total T3", "118", "ng/dL", "80 – 200", None),
            ("Anti-TPO", "28", "IU/mL", "< 35", None), ("Vitamin D (25-OH)", "18.2", "ng/mL", "30 – 100", "L")]
    y, boxes = g.form(im, d, y, rows, "rock", 42, BIRO, 0.1, 1.0, title="THYROID PROFILE")
    hw(im, 60, y + 30, "Sample: serum", "rock", 38, BIRO, 0.1, 1.0)
    hw(im, 760, 1520, "Lab Tech.", "rock", 40, BIRO, 0.1, 1.0)
    im = bleed_through(im, ["Invoice no 4471", "paid in full", "Namuna Stores"], "rock", 52, 60)
    b = boxes["Free T4"]
    im = coffee_ring(im, (b[0] + b[2]) // 2 + 10, b[1] + 22, 92, 60)
    doc.update(kind="lab_report", style="printed form, results in a wide rough hand (Rock Salt); a coffee ring over the Free T4 and Total T3 rows; writing from the back of the sheet shows through, mirrored",
        facility="Example Thyroid & Vitamin Centre (fictional)", patient=pat("Sarita Namuna", "39 y", "F"), date={"as_written": "25/11/2026", "calendar": "AD"},
        ordered_by=None, results=[res(n, v, u, r, f) for n, v, u, r, f in rows], comment="Sample: serum", critical_values=[],
        traps=["units with µ (µIU/mL) and slashes", "coffee ring over two values: still readable, a reader must not guess a digit it cannot see", "mirrored bleed-through text ('Invoice no 4471', 'paid in full') is not part of the report", "vitamin D 18.2 carries a hand-written L next to the value: copy it"])
    return im

def l23(doc):
    """L23: a printed liver panel received as a fax."""
    im, d = page(A4)
    y = head_lab(im, d, "उदाहरण रिपोर्ट", "Example Referral Laboratory (fictional)", ["Tel 00-0000000  ·  Liver function tests"], (20, 20, 20))
    d.text((250, y - 52 * 3 + 2), "Chandra Bahadur Namuna", font=g.SANS(28), fill=BLACK)
    d.text((250, y - 52 * 2 + 2), "55 y / M", font=g.SANS(28), fill=BLACK)
    d.text((250, y - 52 * 1 + 2), "26/11/2026", font=g.SANS(28), fill=BLACK)
    y += 30
    rows = [("Total bilirubin", "0.8", "mg/dL", "0.2 – 1.2", None), ("Direct bilirubin", "0.2", "mg/dL", "0.0 – 0.3", None),
            ("SGOT (AST)", "42", "U/L", "5 – 40", "H"), ("SGPT (ALT)", "56", "U/L", "5 – 40", "H"),
            ("Alkaline phosphatase", "118", "U/L", "44 – 147", None), ("Total protein", "7.1", "g/dL", "6.0 – 8.3", None),
            ("Albumin", "4.2", "g/dL", "3.5 – 5.0", None), ("GGT", "64", "U/L", "< 55", "H")]
    y = printed_form(im, d, y, rows, title="LIVER FUNCTION TESTS")
    d.text((60, y + 20), "Reported by: Dr. S. Namuna (fictional)", font=g.SANS(24), fill=BLACK)
    doc.update(kind="lab_report", style="printed report; the PHOTO is a fax (shrunk, thresholded, noisy, scan-line dropouts, a streak)",
        facility="Example Referral Laboratory (fictional)", patient=pat("Chandra Bahadur Namuna", "55 y", "M"), date={"as_written": "26/11/2026", "calendar": "AD"},
        ordered_by=None, results=[res(n, v, u, r, f) for n, v, u, r, f in rows], comment=None, critical_values=[],
        traps=["fax noise on a printed page: Vision is usually strong here, the test is whether Claude is as exact", "printed flag H on three rows is copied; none is added to the others", "0.0 – 0.3 keeps its '0.0'", "a streak down the right side"])
    return im

# ------------------------------------------------------------------ build

DOCS = [  # id, slug, function, photo function
    ("P21", "abbreviated-doses", p21, lambda im, n: photo_std(im, 1.0, 0.0, 100 + n)),
    ("P22", "child-syrup-ml", p22, lambda im, n: photo_std(im, 1.1, 0.0, 100 + n)),
    ("P23", "fractions-decimals", p23, lambda im, n: photo_std(im, 1.0, 0.0, 100 + n)),
    ("P24", "faded-carbon-steep", p24, lambda im, n: photo_steep(im, 100 + n)),
    ("P25", "folded-torn-corner", p25, lambda im, n: photo_std(im, 1.1, 0.5, 100 + n)),
    ("P26", "narrow-caps-lookalikes-glare", p26, lambda im, n: photo_lowlight_glare(im, (0.36, 0.545), 100 + n)),
    ("P27", "devanagari-weeks-months", p27, lambda im, n: photo_std(im, 1.0, 0.0, 100 + n)),
    ("L21", "urine-text-results", l21, lambda im, n: photo_std(im, 1.0, 0.0, 100 + n)),
    ("L22", "thyroid-coffee-bleed", l22, lambda im, n: photo_std(im, 1.1, 0.0, 100 + n)),
    ("L23", "liver-fax", l23, lambda im, n: photo_fax(im, 100 + n)),
]

def main():
    os.makedirs(f"{OUT}/clean", exist_ok=True); os.makedirs(f"{OUT}/photo", exist_ok=True)
    key = []
    for n, (did, slug, fn, photo) in enumerate(DOCS):
        doc = {"id": did, "file_clean": f"clean/{did}-{slug}.png", "file_photo": f"photo/{did}-{slug}.jpg",
               "fictional": True, "stamp": "SAMPLE · नमूना"}
        im = g.stamp(fn(doc))
        im.save(f"{OUT}/{doc['file_clean']}", optimize=True)
        photo(im, n).convert("RGB").save(f"{OUT}/{doc['file_photo']}", quality=72)
        key.append(doc)
    with open(f"{OUT}/answer_key.json", "w", encoding="utf-8") as f:
        json.dump({"set": "Abhilekh fictional test set v3 (held-out: new hands, new notations, new damage)", "made": "2026-11-21",
                   "note": "Every person, clinician, clinic, lab and registration number is invented. Amoxinepa is an invented brand. "
                           "Ground truth is what the writer meant. dose_as_written and duration_as_written are the exact copies a reader should return.",
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
