#!/usr/bin/env python3
"""Abhilekh fictional test set v1 — every document is invented and stamped SAMPLE / नमूना.

Makes 10 documents (5 prescriptions, 5 lab reports) in typical Nepali styles.
Each document is written twice: a clean scan (clean/*.png) and a phone-photo
version (photo/*.jpg: tilt, shadow, blur, JPEG). The answer key (answer_key.json,
answer_key.csv) holds what a perfect reader would extract.

No real patient, doctor, clinic or lab. Names use Namuna / Udaharan ("sample",
"example"). Two brand names (Glucozen, Neurozen-Forte) are invented on purpose:
the DDA drug-name check should flag them as not found.

Run:  python3 make_test_set.py <out_dir> <font_dir>
"""
import json, csv, os, sys, random, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

OUT = sys.argv[1] if len(sys.argv) > 1 else "out"
FD = sys.argv[2] if len(sys.argv) > 2 else "."
random.seed(2083)

def F(name, size):
    return ImageFont.truetype(os.path.join(FD, name), size, layout_engine=ImageFont.Layout.RAQM)

HAND = lambda s: F("kalam-400.ttf", s)
HANDB = lambda s: F("kalam-700.ttf", s)
SANS = lambda s: F("noto-sans-devanagari-400.ttf", s)
SANSB = lambda s: F("noto-sans-devanagari-700.ttf", s)
MUK = lambda s: F("mukta-400.ttf", s)
MUKB = lambda s: F("mukta-700.ttf", s)
UNIT = lambda s: ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", s, layout_engine=ImageFont.Layout.RAQM)

W, H = 1240, 1754  # A4 at 150 dpi
INK = (25, 35, 90)      # ball-pen blue
BLACK = (20, 20, 20)
GREY = (110, 110, 110)

def page(bg=(255, 255, 255)):
    im = Image.new("RGB", (W, H), bg)
    return im, ImageDraw.Draw(im)

def hand_line(im, xy, text, size=40, color=INK, bold=False):
    """Hand-written line: own layer, small random tilt and baseline drift."""
    f = HANDB(size) if bold else HAND(size)
    bbox = f.getbbox(text)
    w, h = bbox[2] + 20, bbox[3] + 30
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(layer).text((10, 10), text, font=f, fill=color + (235,))
    layer = layer.rotate(random.uniform(-1.4, 1.4), resample=Image.BICUBIC, expand=True)
    x, y = xy
    im.paste(layer, (int(x + random.uniform(-4, 4)), int(y + random.uniform(-3, 3))), layer)

def stamp(im):
    """Diagonal SAMPLE watermark + corner stamp. Never removed from any test file."""
    layer = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f = SANSB(150)
    txt = "SAMPLE · नमूना"
    tw = d.textlength(txt, font=f)
    t = Image.new("RGBA", (int(tw) + 40, 260), (0, 0, 0, 0))
    ImageDraw.Draw(t).text((20, 20), txt, font=f, fill=(200, 30, 30, 60))
    t = t.rotate(32, expand=True, resample=Image.BICUBIC)
    layer.paste(t, ((im.width - t.width) // 2, (im.height - t.height) // 2), t)
    d.rectangle([30, im.height - 125, 430, im.height - 15], outline=(200, 30, 30, 220), width=5)
    d.text((50, im.height - 117), "SAMPLE · नमूना", font=SANSB(44), fill=(200, 30, 30, 230))
    d.text((50, im.height - 57), "fictional test document", font=SANS(24), fill=(200, 30, 30, 230))
    base = im.convert("RGBA")
    base.alpha_composite(layer)
    return base.convert("RGB")

def letterhead(d, name, sub, nep=None, color=(20, 90, 60)):
    d.rectangle([0, 0, W, 8], fill=color)
    y = 40
    if nep:
        d.text((60, y), nep, font=MUKB(46), fill=color); y += 62
    d.text((60, y), name, font=SANSB(40), fill=color); y += 56
    for line in sub:
        d.text((60, y), line, font=SANS(24), fill=GREY); y += 32
    d.line([60, y + 12, W - 60, y + 12], fill=color, width=3)
    return y + 30

# ---------------------------------------------------------------- prescriptions

def rx_opd_ticket(doc):
    """P01: printed hospital OPD ticket, hand-written Rx in English."""
    im, d = page((250, 248, 240))
    y = letterhead(d, "Namuna Community Hospital", ["OPD Ticket  ·  Example Marga, Kathmandu  ·  Tel 01-0000000"],
                   nep="नमूना सामुदायिक अस्पताल", color=(30, 60, 130))
    rows = [("OPD No.", "N-0001"), ("Name", ""), ("Age/Sex", ""), ("Address", ""), ("Date", ""), ("Dept.", "Medicine")]
    y0 = y
    for k, v in rows:
        d.text((60, y), k + ":", font=SANSB(28), fill=BLACK)
        d.line([260, y + 38, 1150, y + 38], fill=GREY, width=1)
        if v: d.text((280, y), v, font=SANS(28), fill=BLACK)
        y += 52
    hand_line(im, (280, y0 + 52 * 1 - 22), "Ram Bahadur Namuna", 40)
    hand_line(im, (280, y0 + 52 * 2 - 22), "58 y / M", 40)
    hand_line(im, (280, y0 + 52 * 3 - 22), "Kakani-3, Nuwakot", 40)
    hand_line(im, (280, y0 + 52 * 4 - 22), "2083/08/02", 40)
    y += 30
    lines = [
        ("c/o  F/U DM-2, HTN", 40),
        ("BP 146/92   Wt 71 kg   FBS 168", 38),
        ("Rx", 56),
        ("1) Tab Metformin 500 mg   1 - 0 - 1   after meals  x 1 month", 36),
        ("2) Tab Glimepiride 1 mg   1 - 0 - 0   before breakfast  x 1 month", 36),
        ("3) Tab Amlodipine 5 mg   0 - 0 - 1   x 1 month", 36),
        ("Adv: HbA1c, lipid profile, RFT", 38),
        ("Diet, walk 30 min daily", 38),
        ("F/U after 1 month with reports", 38),
    ]
    for t, s in lines:
        hand_line(im, (90, y), t, s, bold=(t == "Rx")); y += s + 40
    hand_line(im, (800, y + 40), "Dr. A. Udaharan", 40)
    d.text((800, y + 110), "NMC No. 00000 (fictional)", font=SANS(22), fill=GREY)
    doc.update(
        kind="prescription", style="printed OPD ticket, hand-written English Rx",
        facility="Namuna Community Hospital", clinician="Dr. A. Udaharan", clinician_reg="NMC 00000 (fictional)",
        patient={"name": "Ram Bahadur Namuna", "age": "58 y", "sex": "M", "address": "Kakani-3, Nuwakot"},
        date={"as_written": "2083/08/02", "calendar": "BS"},
        diagnosis_as_written="F/U DM-2, HTN",
        vitals={"bp": "146/92", "weight_kg": 71, "fbs_mg_dl": 168},
        medicines=[
            {"as_written": "Tab Metformin 500 mg", "generic": "metformin", "strength": "500 mg", "form": "tablet",
             "dose": "1-0-1", "timing": "after meals", "duration": "1 month", "dda_expected": "registered generic"},
            {"as_written": "Tab Glimepiride 1 mg", "generic": "glimepiride", "strength": "1 mg", "form": "tablet",
             "dose": "1-0-0", "timing": "before breakfast", "duration": "1 month", "dda_expected": "registered generic"},
            {"as_written": "Tab Amlodipine 5 mg", "generic": "amlodipine", "strength": "5 mg", "form": "tablet",
             "dose": "0-0-1", "timing": "night", "duration": "1 month", "dda_expected": "registered generic"},
        ],
        advice=["HbA1c, lipid profile, RFT", "Diet, walk 30 min daily", "Follow-up after 1 month with reports"],
        traps=["1-0-1 dose notation", "c/o and F/U abbreviations", "BS date in Latin digits"],
    )
    return im

def rx_clinic_nepali(doc):
    """P02: clinic letterhead, hand-written Rx with Nepali instructions."""
    im, d = page()
    y = letterhead(d, "Udaharan Family Clinic", ["Ward 3, Example Tole, Lalitpur  ·  Mobile 98XXXXXXXX"],
                   nep="उदाहरण पारिवारिक क्लिनिक", color=(120, 40, 90))
    y += 20
    hand_line(im, (70, y), "Name: Sita Kumari Namuna     Age: 34 y   F", 38); y += 70
    hand_line(im, (70, y), "Date: 2083-07-28", 38); y += 90
    hand_line(im, (70, y), "Sore throat, fever x 3 days, T 101°F", 38); y += 60
    hand_line(im, (70, y), "Tonsils enlarged, exudate +", 38); y += 100
    hand_line(im, (70, y), "Rx", 58, bold=True); y += 100
    items = [
        ("1. Cap Amoxicillin 500 mg  TDS  x 5 days", "खाना पछि, दिनको ३ पटक"),
        ("2. Tab Paracetamol 500 mg  SOS", "ज्वरो आए मात्र, ६ घण्टाको फरकमा"),
        ("3. Tab Cetirizine 10 mg  HS  x 5 days", "राति सुत्ने बेला"),
    ]
    for en, ne in items:
        hand_line(im, (90, y), en, 38); y += 62
        hand_line(im, (150, y), ne, 36); y += 80
    hand_line(im, (70, y + 10), "मनतातो नुन पानीले कुल्ला गर्ने", 36); y += 70
    hand_line(im, (70, y + 10), "५ दिन पछि नठीक भए फेरि आउने", 36)
    hand_line(im, (780, 1500), "Dr. B. Namuna", 40)
    d.text((780, 1565), "NMC No. 00001 (fictional)", font=SANS(22), fill=GREY)
    doc.update(
        kind="prescription", style="clinic letterhead, hand-written English Rx with Nepali instructions",
        facility="Udaharan Family Clinic", clinician="Dr. B. Namuna", clinician_reg="NMC 00001 (fictional)",
        patient={"name": "Sita Kumari Namuna", "age": "34 y", "sex": "F", "address": None},
        date={"as_written": "2083-07-28", "calendar": "BS"},
        diagnosis_as_written="Sore throat, fever x 3 days; tonsils enlarged, exudate +",
        vitals={"temp_f": 101},
        medicines=[
            {"as_written": "Cap Amoxicillin 500 mg", "generic": "amoxicillin", "strength": "500 mg", "form": "capsule",
             "dose": "TDS (3 times a day)", "timing": "after meals", "duration": "5 days", "dda_expected": "registered generic",
             "instruction_ne": "खाना पछि, दिनको ३ पटक"},
            {"as_written": "Tab Paracetamol 500 mg", "generic": "paracetamol", "strength": "500 mg", "form": "tablet",
             "dose": "SOS (when needed)", "timing": "at least 6 hours apart", "duration": None, "dda_expected": "registered generic",
             "instruction_ne": "ज्वरो आए मात्र, ६ घण्टाको फरकमा"},
            {"as_written": "Tab Cetirizine 10 mg", "generic": "cetirizine", "strength": "10 mg", "form": "tablet",
             "dose": "HS (at bedtime)", "timing": "bedtime", "duration": "5 days", "dda_expected": "registered generic",
             "instruction_ne": "राति सुत्ने बेला"},
        ],
        advice=["मनतातो नुन पानीले कुल्ला गर्ने (warm salt-water gargle)", "५ दिन पछि नठीक भए फेरि आउने (return if not better in 5 days)"],
        traps=["Nepali instructions in hand-writing", "Devanagari digits ३ ६ ५", "TDS / SOS / HS abbreviations"],
    )
    return im

def rx_messy(doc):
    """P03: rushed hand-writing, one invented brand name."""
    im, d = page((252, 250, 245))
    for yy in range(200, H, 52):
        d.line([0, yy, W, yy], fill=(205, 215, 235), width=1)  # ruled pad
    d.text((60, 50), "Dr. C. Udaharan  MBBS, MD (fictional)", font=SANSB(32), fill=BLACK)
    d.text((60, 95), "Consultant Physician · Example Polyclinic, Bharatpur", font=SANS(24), fill=GREY)
    y = 230
    hand_line(im, (70, y), "Mr. Hari Prasad Namuna  62/M", 42); y += 80
    hand_line(im, (70, y), "18/11/2026", 42); y += 100
    hand_line(im, (70, y), "Known DM, HTN, dyslipidaemia", 40); y += 120
    hand_line(im, (70, y), "Rx", 60, bold=True); y += 110
    hand_line(im, (100, y), "T. Glucozen 500   BD   x 2 mo", 44); y += 95
    hand_line(im, (100, y), "T. Atorvastatin 10   HS   x 2 mo", 44); y += 95
    hand_line(im, (100, y), "T. Losartan 50   OD   x 2 mo", 44); y += 140
    hand_line(im, (70, y), "Rpt lipid + RFT after 2 mo", 40)
    hand_line(im, (760, 1450), "C. Udaharan", 46)
    doc.update(
        kind="prescription", style="rushed hand-writing on ruled pad, brand-style names, dd/mm/yyyy AD date",
        facility="Example Polyclinic, Bharatpur", clinician="Dr. C. Udaharan", clinician_reg=None,
        patient={"name": "Hari Prasad Namuna", "age": "62 y", "sex": "M", "address": None},
        date={"as_written": "18/11/2026", "calendar": "AD"},
        diagnosis_as_written="Known DM, HTN, dyslipidaemia",
        medicines=[
            {"as_written": "T. Glucozen 500", "generic": None, "strength": "500 (unit not written)", "form": "tablet",
             "dose": "BD (twice a day)", "timing": None, "duration": "2 months",
             "dda_expected": "NOT FOUND — invented brand; must be flagged for a person to confirm, never guessed"},
            {"as_written": "T. Atorvastatin 10", "generic": "atorvastatin", "strength": "10 mg (unit not written)", "form": "tablet",
             "dose": "HS (at bedtime)", "timing": "bedtime", "duration": "2 months", "dda_expected": "registered generic"},
            {"as_written": "T. Losartan 50", "generic": "losartan", "strength": "50 mg (unit not written)", "form": "tablet",
             "dose": "OD (once a day)", "timing": None, "duration": "2 months", "dda_expected": "registered generic"},
        ],
        advice=["Repeat lipid profile and RFT after 2 months"],
        traps=["invented brand name must be flagged, not mapped to metformin", "strengths without units", "no registration number", "AD date dd/mm/yyyy"],
    )
    return im

def rx_paediatric(doc):
    """P04: child, syrup dose in ml, weight written."""
    im, d = page()
    y = letterhead(d, "Namuna Child Clinic", ["Example Chowk, Pokhara  ·  OPD Mon–Fri"],
                   nep="नमूना बाल क्लिनिक", color=(200, 110, 20))
    y += 20
    hand_line(im, (70, y), "Baby: Aarav Namuna   2 y 6 m   M   Wt 14 kg", 38); y += 70
    hand_line(im, (70, y), "Date: 2083/08/03", 38); y += 90
    hand_line(im, (70, y), "Loose stools x 2 days, 5-6 times/day, no blood", 36); y += 60
    hand_line(im, (70, y), "Active, drinking well, no dehydration", 36); y += 110
    hand_line(im, (70, y), "Rx", 58, bold=True); y += 100
    items = [
        "1. ORS — 1 packet in 1 litre clean water,",
        "     give 50-100 ml after each loose stool",
        "2. Zinc 20 mg dispersible tab — 1 tab OD x 14 days",
        "3. Syp Paracetamol (250 mg/5 ml) — 4 ml SOS",
        "     for fever, max 4 times a day",
    ]
    for t in items:
        hand_line(im, (90, y), t, 36); y += 66
    y += 40
    hand_line(im, (70, y), "आमाको दूध र खाना नरोक्ने", 38); y += 70
    hand_line(im, (70, y), "Danger signs: blood in stool, not drinking, very sleepy", 34); y += 56
    hand_line(im, (70, y), "- come back the same day", 34)
    hand_line(im, (780, 1520), "Dr. D. Udaharan", 40)
    d.text((780, 1585), "NMC No. 00002 (fictional)", font=SANS(22), fill=GREY)
    doc.update(
        kind="prescription", style="paediatric clinic, hand-written, syrup in ml, weight-based",
        facility="Namuna Child Clinic", clinician="Dr. D. Udaharan", clinician_reg="NMC 00002 (fictional)",
        patient={"name": "Aarav Namuna", "age": "2 y 6 m", "sex": "M", "address": None, "weight_kg": 14},
        date={"as_written": "2083/08/03", "calendar": "BS"},
        diagnosis_as_written="Loose stools x 2 days, no dehydration",
        medicines=[
            {"as_written": "ORS", "generic": "oral rehydration salts", "strength": "1 packet in 1 litre", "form": "powder",
             "dose": "50-100 ml after each loose stool", "timing": None, "duration": None, "dda_expected": "registered generic"},
            {"as_written": "Zinc 20 mg dispersible tab", "generic": "zinc sulfate", "strength": "20 mg", "form": "dispersible tablet",
             "dose": "1 OD", "timing": None, "duration": "14 days", "dda_expected": "registered generic"},
            {"as_written": "Syp Paracetamol (250 mg/5 ml)", "generic": "paracetamol", "strength": "250 mg/5 ml", "form": "syrup",
             "dose": "4 ml SOS, max 4 times a day", "timing": "for fever", "duration": None, "dda_expected": "registered generic"},
        ],
        advice=["आमाको दूध र खाना नरोक्ने (keep breastfeeding and food)", "Return the same day for blood in stool, not drinking, very sleepy"],
        traps=["syrup concentration vs dose in ml must stay separate", "age in years+months", "doctor's written advice is stored as written, nothing added"],
    )
    return im

def rx_eprint(doc):
    """P05: computer-printed e-prescription, one invented combination brand."""
    im, d = page()
    y = letterhead(d, "Udaharan Hospital Pvt. Ltd. (fictional)", ["Example Road, Biratnagar  ·  www.example.invalid",
                   "Department of Internal Medicine  ·  e-Prescription"], color=(10, 90, 120))
    info = [("Patient", "Maya Devi Namuna"), ("Hospital No.", "UH-000045"), ("Age / Sex", "47 Y / F"),
            ("Visit date", "2026-11-17 10:42"), ("Consultant", "Dr. E. Namuna (NMC 00003, fictional)")]
    for k, v in info:
        d.text((60, y), k, font=SANSB(26), fill=BLACK); d.text((330, y), ": " + v, font=SANS(26), fill=BLACK); y += 40
    y += 20
    d.text((60, y), "Provisional diagnosis: Hypothyroidism; dyspepsia; peripheral neuropathy symptoms", font=SANS(26), fill=BLACK); y += 60
    hdr = ["#", "Medicine", "Dose", "Frequency", "Duration", "Instructions"]
    xs = [60, 110, 520, 650, 830, 980]
    d.rectangle([55, y - 6, W - 55, y + 40], fill=(225, 238, 242))
    for x, h in zip(xs, hdr): d.text((x, y), h, font=SANSB(24), fill=BLACK)
    y += 50
    meds = [
        ("1", "Tab. Levothyroxine 50 mcg", "1 tab", "Once daily", "3 months", "Empty stomach,"),
        ("", "", "", "", "", "30 min before food"),
        ("2", "Tab. Pantoprazole 40 mg", "1 tab", "Once daily", "14 days", "Before breakfast"),
        ("3", "Cap. Neurozen-Forte", "1 cap", "Once daily", "1 month", "After dinner"),
    ]
    for row in meds:
        for x, c in zip(xs, row): d.text((x, y), c, font=SANS(24), fill=BLACK)
        y += 40 if row[0] == "" or row[0] == "1" else 46
    d.line([55, y + 6, W - 55, y + 6], fill=GREY, width=1); y += 40
    d.text((60, y), "Investigations: TSH after 6 weeks; Vitamin B12", font=SANS(26), fill=BLACK); y += 44
    d.text((60, y), "Follow-up: after 6 weeks with TSH report", font=SANS(26), fill=BLACK); y += 44
    d.text((60, y), "औषधि नछुटाउनुहोस्। थाइरोइडको औषधि बिहान खाली पेटमा मात्र।", font=MUK(30), fill=BLACK)
    d.text((60, H - 180), "This is a computer generated prescription. — fictional test document", font=SANS(20), fill=GREY)
    doc.update(
        kind="prescription", style="computer-printed e-prescription table, AD date with time",
        facility="Udaharan Hospital Pvt. Ltd. (fictional)", clinician="Dr. E. Namuna", clinician_reg="NMC 00003 (fictional)",
        patient={"name": "Maya Devi Namuna", "age": "47 y", "sex": "F", "address": None, "hospital_no": "UH-000045"},
        date={"as_written": "2026-11-17 10:42", "calendar": "AD"},
        diagnosis_as_written="Hypothyroidism; dyspepsia; peripheral neuropathy symptoms",
        medicines=[
            {"as_written": "Tab. Levothyroxine 50 mcg", "generic": "levothyroxine", "strength": "50 mcg", "form": "tablet",
             "dose": "1 once daily", "timing": "empty stomach, 30 min before food", "duration": "3 months", "dda_expected": "registered generic"},
            {"as_written": "Tab. Pantoprazole 40 mg", "generic": "pantoprazole", "strength": "40 mg", "form": "tablet",
             "dose": "1 once daily", "timing": "before breakfast", "duration": "14 days", "dda_expected": "registered generic"},
            {"as_written": "Cap. Neurozen-Forte", "generic": None, "strength": None, "form": "capsule",
             "dose": "1 once daily", "timing": "after dinner", "duration": "1 month",
             "dda_expected": "NOT FOUND — invented brand; flag, show as written, ask the person"},
        ],
        advice=["TSH after 6 weeks; Vitamin B12", "Follow-up after 6 weeks with TSH report",
                "औषधि नछुटाउनुहोस्। थाइरोइडको औषधि बिहान खाली पेटमा मात्र।"],
        traps=["instruction wraps onto a second table row", "mcg vs mg", "invented combination brand"],
    )
    return im

# ---------------------------------------------------------------- lab reports

def lab_header(d, title, patient, nep_date=False):
    y = letterhead(d, "Udaharan Diagnostic Centre (fictional)",
                   ["Example Marg, Kathmandu  ·  Tel 01-0000000  ·  Lab reg. 0000 (fictional)"],
                   nep="उदाहरण डायग्नोस्टिक सेन्टर", color=(130, 20, 40))
    left = [("Patient", patient["name"]), ("Age/Sex", patient["agesex"]), ("Ref. by", patient["ref"])]
    right = [("Sample ID", patient["sid"]), ("Collected", patient["date"]), ("Reported", patient["date"])]
    yy = y
    for (k, v), (k2, v2) in zip(left, right):
        d.text((60, yy), k, font=SANSB(24), fill=BLACK); d.text((210, yy), ": " + v, font=SANS(24), fill=BLACK)
        d.text((700, yy), k2, font=SANSB(24), fill=BLACK); d.text((860, yy), ": " + v2, font=MUK(26) if nep_date else SANS(24), fill=BLACK)
        yy += 38
    yy += 20
    d.text(((W - d.textlength(title, font=SANSB(34))) // 2, yy), title, font=SANSB(34), fill=BLACK)
    return yy + 70

def lab_table(d, y, rows, section=None):
    xs = [60, 540, 720, 960]
    if section:
        d.text((60, y), section, font=SANSB(26), fill=(130, 20, 40)); y += 44
    d.rectangle([55, y - 6, W - 55, y + 38], fill=(240, 232, 232))
    for x, h in zip(xs, ["Test", "Result", "Unit", "Reference range"]):
        d.text((x, y), h, font=SANSB(24), fill=BLACK)
    y += 50
    for r in rows:
        name, val, unit, rng = r[:4]
        flag = r[4] if len(r) > 4 else ""
        bold = flag in ("H", "L", "HH", "LL")
        d.text((xs[0], y), name, font=SANS(24), fill=BLACK)
        d.text((xs[1], y), f"{val} {flag}".strip(), font=SANSB(24) if bold else SANS(24), fill=BLACK)
        d.text((xs[2], y), unit, font=UNIT(21), fill=BLACK)
        d.text((xs[3], y), rng, font=SANS(24), fill=BLACK)
        y += 40
    return y + 20

def results(rows):
    out = []
    for r in rows:
        name, val, unit, rng = r[:4]
        out.append({"test": name, "value": val, "unit": unit, "reference_range": rng,
                    "flag_printed": r[4] if len(r) > 4 else None})
    return out

def lab_footer(d, note=None):
    y = H - 260
    if note:
        d.text((60, y - 60), note, font=SANS(22), fill=BLACK)
    d.text((60, y), "*** End of report ***", font=SANS(22), fill=GREY)
    d.text((60, y + 60), "Lab Technologist", font=SANS(22), fill=BLACK)
    d.text((820, y + 60), "Pathologist (fictional)", font=SANS(22), fill=BLACK)
    d.text((60, y + 120), "Results relate only to the sample tested. Fictional test document.", font=SANS(20), fill=GREY)

def lab_cbc(doc):
    """L01: complete blood count, mild anaemia."""
    im, d = page()
    p = {"name": "Sita Kumari Namuna", "agesex": "34 Y / F", "ref": "Dr. B. Namuna", "sid": "UDC-2611-0101", "date": "19-11-2026"}
    y = lab_header(d, "HAEMATOLOGY — COMPLETE BLOOD COUNT", p)
    rows = [
        ("Haemoglobin", "10.8", "g/dL", "12.0 – 15.5", "L", "low"),
        ("Total WBC count", "7,400", "/cumm", "4,000 – 11,000"),
        ("Neutrophils", "62", "%", "40 – 75"),
        ("Lymphocytes", "30", "%", "20 – 45"),
        ("Monocytes", "5", "%", "2 – 10"),
        ("Eosinophils", "3", "%", "1 – 6"),
        ("Basophils", "0", "%", "0 – 1"),
        ("RBC count", "4.1", "million/cumm", "3.8 – 5.2"),
        ("PCV / Haematocrit", "33.5", "%", "36 – 46", "L", "low"),
        ("MCV", "78", "fL", "80 – 100", "L", "low"),
        ("MCH", "26.3", "pg", "27 – 33", "L", "low"),
        ("MCHC", "32.2", "g/dL", "32 – 36"),
        ("Platelet count", "2,45,000", "/cumm", "1,50,000 – 4,00,000"),
        ("ESR", "18", "mm/1st hr", "0 – 20"),
    ]
    lab_table(d, y, rows)
    lab_footer(d, "Peripheral smear: microcytic hypochromic RBCs.")
    doc.update(kind="lab_report", style="printed CBC table, Indian-style digit grouping (2,45,000)",
               facility="Udaharan Diagnostic Centre (fictional)", patient={"name": p["name"], "age": "34 y", "sex": "F"},
               date={"as_written": p["date"], "calendar": "AD"}, ordered_by="Dr. B. Namuna", results=results(rows),
               comment="Peripheral smear: microcytic hypochromic RBCs.",
               critical_values=[], traps=["2,45,000 lakh grouping must read as 245000", "en-dash ranges", "WBC differential percentages"])
    return im

def lab_diabetes(doc):
    """L02: diabetes panel, bilingual header, Devanagari-digit BS date."""
    im, d = page()
    p = {"name": "Ram Bahadur Namuna", "agesex": "58 Y / M", "ref": "Dr. A. Udaharan", "sid": "UDC-2611-0102", "date": "२०८३/०८/०३"}
    y = lab_header(d, "BIOCHEMISTRY — DIABETES PROFILE  (मधुमेह जाँच)", p, nep_date=True)
    rows = [
        ("Glucose, fasting (FBS)", "168", "mg/dL", "70 – 100", "H", "high"),
        ("Glucose, 2 hr post-prandial", "242", "mg/dL", "< 140", "H", "high"),
        ("HbA1c", "8.2", "%", "< 5.7", "H", "high"),
        ("Estimated average glucose", "189", "mg/dL", "—"),
    ]
    y = lab_table(d, y, rows)
    rows2 = [
        ("Total cholesterol", "212", "mg/dL", "< 200", "H", "high"),
        ("Triglycerides", "236", "mg/dL", "< 150", "H", "high"),
        ("HDL cholesterol", "38", "mg/dL", "> 40", "L", "low"),
        ("LDL cholesterol (calc.)", "127", "mg/dL", "< 100", "H", "high"),
        ("VLDL", "47", "mg/dL", "< 30", "H", "high"),
    ]
    y = lab_table(d, y, rows2, section="LIPID PROFILE")
    d.text((60, y - 10), "HbA1c: 5.7 – 6.4 % prediabetes; 6.5 % or above diabetes.", font=SANS(22), fill=BLACK)
    lab_footer(d, "Fasting 10 hours as reported by patient.")
    doc.update(kind="lab_report", style="printed biochemistry, bilingual title, BS date in Devanagari digits",
               facility="Udaharan Diagnostic Centre (fictional)", patient={"name": p["name"], "age": "58 y", "sex": "M"},
               date={"as_written": "२०८३/०८/०३", "normalised": "2083/08/03", "calendar": "BS"}, ordered_by="Dr. A. Udaharan",
               results=results(rows) + results(rows2), comment="Fasting 10 hours as reported by patient. HbA1c: 5.7–6.4 % prediabetes; 6.5 % or above diabetes.",
               critical_values=[], traps=["Devanagari digits in date", "HbA1c bands printed as a footnote below the tables", "< and > ranges", "two sections on one page"],
               links_to="P01 (same fictional patient; the advised HbA1c, lipid profile)")
    return im

def lab_rft_critical(doc):
    """L03: renal function with a critical potassium."""
    im, d = page()
    p = {"name": "Hari Prasad Namuna", "agesex": "62 Y / M", "ref": "Dr. C. Udaharan", "sid": "UDC-2611-0103", "date": "20-11-2026"}
    y = lab_header(d, "BIOCHEMISTRY — RENAL FUNCTION TEST", p)
    rows = [
        ("Urea", "58", "mg/dL", "15 – 45", "H", "high"),
        ("Creatinine", "1.6", "mg/dL", "0.7 – 1.3", "H", "high"),
        ("Sodium (Na+)", "136", "mmol/L", "135 – 145"),
        ("Potassium (K+)", "6.6", "mmol/L", "3.5 – 5.1", "HH", "critical high"),
        ("Uric acid", "7.4", "mg/dL", "3.5 – 7.2", "H", "high"),
        ("eGFR (CKD-EPI)", "48", "mL/min/1.73m²", "> 90", "L", "low"),
    ]
    lab_table(d, y, rows)
    d.rectangle([55, 980, W - 55, 1080], outline=(180, 0, 0), width=3)
    d.text((75, 995), "CRITICAL VALUE: Potassium 6.6 mmol/L. Informed to", font=SANSB(24), fill=(180, 0, 0))
    d.text((75, 1035), "referring doctor by phone at 11:20.", font=SANSB(24), fill=(180, 0, 0))
    lab_footer(d, "Sample not haemolysed.")
    doc.update(kind="lab_report", style="printed RFT with lab's own critical-value box",
               facility="Udaharan Diagnostic Centre (fictional)", patient={"name": p["name"], "age": "62 y", "sex": "M"},
               date={"as_written": p["date"], "calendar": "AD"}, ordered_by="Dr. C. Udaharan", results=results(rows),
               comment="Sample not haemolysed. Critical value phoned to referring doctor at 11:20.",
               critical_values=[{"test": "Potassium (K+)", "value": "6.6", "unit": "mmol/L", "flag_printed": "HH",
                                 "expected_display": "exactly as printed: value, unit, range, the HH flag and the lab's own critical-value note; Abhilekh adds nothing"}],
               traps=["HH flag", "superscript in unit", "critical box text must not be read as a result row"],
               links_to="P03 (same fictional patient; on losartan)")
    return im

def lab_lft_tft(doc):
    """L04: liver + thyroid, faded thermal-style print."""
    im, d = page((246, 244, 236))
    p = {"name": "Maya Devi Namuna", "agesex": "47 Y / F", "ref": "Dr. E. Namuna", "sid": "UDC-2610-0104", "date": "02-10-2026"}
    y = lab_header(d, "LIVER FUNCTION TEST & THYROID PROFILE", p)
    rows = [
        ("Bilirubin, total", "0.8", "mg/dL", "0.2 – 1.2"),
        ("Bilirubin, direct", "0.2", "mg/dL", "0.0 – 0.3"),
        ("SGPT (ALT)", "28", "U/L", "< 35"),
        ("SGOT (AST)", "24", "U/L", "< 35"),
        ("Alkaline phosphatase", "96", "U/L", "44 – 147"),
        ("Total protein", "7.1", "g/dL", "6.0 – 8.3"),
        ("Albumin", "4.2", "g/dL", "3.5 – 5.2"),
    ]
    y = lab_table(d, y, rows)
    rows2 = [
        ("T3", "1.02", "ng/mL", "0.8 – 2.0"),
        ("T4", "5.1", "µg/dL", "5.1 – 14.1"),
        ("TSH", "7.84", "µIU/mL", "0.35 – 5.50", "H", "high"),
    ]
    lab_table(d, y, rows2, section="THYROID PROFILE")
    lab_footer(d)
    doc.update(kind="lab_report", style="printed LFT + TFT; photo version is faded",
               facility="Udaharan Diagnostic Centre (fictional)", patient={"name": p["name"], "age": "47 y", "sex": "F"},
               date={"as_written": p["date"], "calendar": "AD"}, ordered_by="Dr. E. Namuna", results=results(rows) + results(rows2),
               comment=None, critical_values=[],
               traps=["T4 printed with no flag at the lower limit: show no flag", "µ symbol", "faded print in photo version"],
               links_to="P05 (same fictional patient; report predates the levothyroxine prescription)")
    return im

def lab_urine_handfilled(doc):
    """L05: printed urine form, results filled in by hand."""
    im, d = page()
    y = letterhead(d, "Namuna Health Post Laboratory", ["Kakani Rural Municipality (fictional lab)  ·  Routine examination"],
                   nep="नमूना स्वास्थ्य चौकी प्रयोगशाला", color=(60, 100, 30))
    for k in ["Name", "Age/Sex", "Date"]:
        d.text((60, y), k + ":", font=SANSB(26), fill=BLACK); d.line([220, y + 36, 1150, y + 36], fill=GREY); y += 52
    hand_line(im, (240, y - 52 * 3 - 12), "Aarav Namuna", 38)
    hand_line(im, (240, y - 52 * 2 - 12), "2½ y / M", 38)
    hand_line(im, (240, y - 52 * 1 - 12), "2083/08/04", 38)
    y += 30
    d.text((60, y), "URINE ROUTINE & MICROSCOPY", font=SANSB(32), fill=BLACK); y += 70
    fields = [
        ("Physical", None), ("Colour", "Pale yellow"), ("Appearance", "Clear"), ("Chemical", None),
        ("Reaction (pH)", "6.0"), ("Albumin", "Nil"), ("Sugar", "Nil"), ("Ketone", "Trace"),
        ("Microscopic", None), ("Pus cells", "2-4 /HPF"), ("RBC", "Nil"), ("Epithelial cells", "1-2 /HPF"),
        ("Casts", "Not seen"), ("Crystals", "Not seen"),
    ]
    rows = []
    for k, v in fields:
        if v is None:
            d.text((60, y), k, font=SANSB(26), fill=(60, 100, 30)); y += 46; continue
        d.text((90, y), k, font=SANS(26), fill=BLACK)
        d.line([500, y + 36, 1000, y + 36], fill=GREY)
        hand_line(im, (520, y - 14), v, 36)
        rows.append({"test": k, "value": v, "unit": None, "reference_range": None, "flag_printed": None,
                     })
        y += 54
    hand_line(im, (760, 1560), "Lab Asst. (sign)", 34)
    doc.update(kind="lab_report", style="printed form, results hand-filled, non-numeric values",
               facility="Namuna Health Post Laboratory (fictional)", patient={"name": "Aarav Namuna", "age": "2 y 6 m", "sex": "M"},
               date={"as_written": "2083/08/04", "calendar": "BS"}, ordered_by=None, results=rows, comment=None,
               critical_values=[], traps=["text values (Nil, Trace, Not seen)", "range values 2-4 /HPF", "½ in age", "no reference ranges printed — must not invent them, no flags added"],
               links_to="P04 (same fictional child)")
    return im

# ---------------------------------------------------------------- phone-photo version

def phone_photo(im, strength=1.0, faded=False):
    if faded:
        im = ImageEnhance.Contrast(im).enhance(0.45)
        im = ImageEnhance.Brightness(im).enhance(1.12)
    bg = Image.new("RGB", (int(W * 1.18), int(H * 1.14)), (96, 78, 60))  # table top
    angle = random.uniform(-4, 4) * strength
    rot = im.convert("RGBA").rotate(angle, expand=True, resample=Image.BICUBIC, fillcolor=(0, 0, 0, 0))
    bg.paste(rot, ((bg.width - rot.width) // 2 + random.randint(-20, 20), (bg.height - rot.height) // 2), rot)
    # soft shadow gradient from one side (hand / phone)
    sh = Image.new("L", bg.size, 0)
    sd = ImageDraw.Draw(sh)
    for i in range(0, bg.width, 6):
        sd.line([i, 0, i, bg.height], fill=int(110 * max(0, 1 - i / (bg.width * 0.55)) * strength))
    dark = Image.new("RGB", bg.size, (0, 0, 0))
    bg = Image.composite(dark, bg, sh.filter(ImageFilter.GaussianBlur(40)))
    bg = bg.filter(ImageFilter.GaussianBlur(0.9 * strength))
    bg = ImageEnhance.Color(bg).enhance(0.9)
    return bg.resize((int(bg.width * 0.8), int(bg.height * 0.8)), Image.LANCZOS)

DOCS = [
    ("P01", "opd-ticket-diabetes-htn", rx_opd_ticket, 1.0, False),
    ("P02", "clinic-throat-nepali-instructions", rx_clinic_nepali, 0.8, False),
    ("P03", "messy-hand-invented-brand", rx_messy, 1.3, False),
    ("P04", "child-diarrhoea-syrup", rx_paediatric, 1.0, False),
    ("P05", "e-prescription-thyroid", rx_eprint, 0.7, False),
    ("L01", "cbc-mild-anaemia", lab_cbc, 0.8, False),
    ("L02", "diabetes-lipid-devanagari-date", lab_diabetes, 1.0, False),
    ("L03", "rft-critical-potassium", lab_rft_critical, 1.0, False),
    ("L04", "lft-thyroid-faded", lab_lft_tft, 1.1, True),
    ("L05", "urine-hand-filled", lab_urine_handfilled, 1.0, False),
]

def main():
    os.makedirs(f"{OUT}/clean", exist_ok=True); os.makedirs(f"{OUT}/photo", exist_ok=True)
    key = []
    for did, slug, fn, strength, faded in DOCS:
        doc = {"id": did, "file_clean": f"clean/{did}-{slug}.png", "file_photo": f"photo/{did}-{slug}.jpg",
               "fictional": True, "stamp": "SAMPLE · नमूना"}
        im = stamp(fn(doc))
        im.save(f"{OUT}/{doc['file_clean']}", optimize=True)
        phone_photo(im, strength, faded).save(f"{OUT}/{doc['file_photo']}", quality=72)
        key.append(doc)
    with open(f"{OUT}/answer_key.json", "w", encoding="utf-8") as f:
        json.dump({"set": "Abhilekh fictional test set v1", "made": "2026-11-20",
                   "note": "Every person, clinician, clinic, lab and registration number is invented. Glucozen and Neurozen-Forte are invented brands.",
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
