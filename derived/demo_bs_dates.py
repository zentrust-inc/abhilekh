"""
Calibration + failure-mode demo for abhilekh's derived date layer (v0.2).

Run: python3 abhilekh/derived/demo_bs_dates.py
"""

import csv
import datetime as dt
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from derived import bs_dates as B  # noqa: E402

TODAY = dt.date(2026, 11, 26)
CURRENT_BS_YEAR = 2083
R = B.DateRole

# Baisakh 1 is a public holiday, so its AD date is independently reported.
# Disputed years only; full reproducible comparison is in verify_calendar.py.
HOLIDAY_CHECKS = {2075: dt.date(2018, 4, 14), 2079: dt.date(2022, 4, 14), 2084: dt.date(2027, 4, 14)}
REJECTED = ("khatain.com BS-to-AD chart: disagrees with two independent implementations "
            "on the same 26 years and is internally inconsistent (14 of 90 Baisakh-1 "
            "spans are 364 or 367 days, impossible for any year).")

def rule(title):
    print(f"\n{'=' * 78}\n{title}\n{'=' * 78}")


def show(label, r):
    print(f"  {label:<46} -> {r.status.value:13} {r.calendar_assumption.value:7} "
          f"ad={str(r.derived_ad):10}  basis={r.resolution_basis:15} event={r.event_check}")


rule("0-1. Table provenance")
print(f"  pinned   : {B.CALENDAR_VERSION}")
print(f"             {B.CALENDAR_SOURCE}")
print(f"  rejected : {REJECTED}")
bad = [(y, B.bs_to_ad(y, 1, 1), ad) for y, ad in HOLIDAY_CHECKS.items() if B.bs_to_ad(y, 1, 1) != ad]
print(f"  New Year public-holiday checks on disputed years: {len(HOLIDAY_CHECKS) - len(bad)}/{len(HOLIDAY_CHECKS)} match")
for y, got, exp in bad:
    print(f"    BS {y}: pinned={got} holiday={exp}")
lo, hi = B.CROSS_CHECKED_BS
print(f"  => precision='day' for BS {lo}-{hi}; '{B.DAY_PRECISION}' outside it.")
print("  Full comparison: python3 abhilekh/derived/verify_calendar.py")

rule(f"2. The flip: BS {CURRENT_BS_YEAR} (AD year = BS-57, then BS-56)")
months = B._TABLE[CURRENT_BS_YEAR]
boundary = B.flip_boundary(CURRENT_BS_YEAR)
for m in range(1, 13):
    first, last = B.bs_to_ad(CURRENT_BS_YEAR, m, 1), B.bs_to_ad(CURRENT_BS_YEAR, m, months[m - 1])
    mark = "  <-- FLIP" if boundary and boundary[1] == m else ""
    print(f"  {B.MONTH_NAMES[m - 1]:<9} {first} {B.zone_for(CURRENT_BS_YEAR, m, 1)}  .. "
          f"{last} {B.zone_for(CURRENT_BS_YEAR, m, months[m - 1])}{mark}")
print(f"  flip at BS {boundary[0]}/{boundary[1]:02d}/{boundary[2]:02d} = AD {B.bs_to_ad(*boundary)}")

rule("3. Round-trip fuzz across the whole pinned table")
bad = checked = 0
for y in range(B.MIN_BS_YEAR, B.MAX_BS_YEAR + 1):
    for m in range(1, 13):
        for d in (1, 15, 28):
            if d <= B._TABLE[y][m - 1]:
                checked += 1
                bad += B.ad_to_bs(B.bs_to_ad(y, m, d)) != (y, m, d)
print(f"  checked {checked} dates, round-trip mismatches: {bad}")

rule("4. Calendar filter alone decides the usual case")
visit = dt.date(2026, 11, 20)
for label, tok, role in [("visit_date 2083/08/10", (2083, 8, 10), R.VISIT_DATE),
                         ("sample 2083/08/08 (anchor untrusted)", (2083, 8, 8), R.SAMPLE_COLLECTED_ON),
                         ("follow_up 2084/04/20 (anchor untrusted)", (2084, 4, 20), R.FOLLOW_UP_ON)]:
    show(label, B.classify(*tok, role=role, anchor=visit, today=TODAY))
print("  Recent BS years have no plausible AD reading, so the anchor is never needed.")

rule("5. A wrong anchor must not flip the calendar (v0.1 bug)")
v = B.classify(2024, 4, 12, role=R.VISIT_DATE, today=TODAY)
show("visit '2024/04/12'", v)
wrong, right = B.bs_to_ad(2024, 4, 12), dt.date(2024, 4, 12)
print(f"  The visit could be AD {right} or BS -> AD {wrong}. Sample '2024/04/10':")
show(f"  anchor {wrong}, untrusted", B.classify(2024, 4, 10, role=R.SAMPLE_COLLECTED_ON, anchor=wrong, today=TODAY))
show(f"  anchor {right}, untrusted", B.classify(2024, 4, 10, role=R.SAMPLE_COLLECTED_ON, anchor=right, today=TODAY))
print("  v0.1 resolved the sample to whichever calendar the anchor was in: silently")
print("  BS 1967 or AD 2024. v0.2 keeps it ambiguous and annotates which reading fits.")
r = B.classify(2024, 4, 12, role=R.VISIT_DATE, calendar_hint=B.Calendar.AD, today=TODAY)
show("visit + page hint AD", r)
print(f"  visit is now a trusted anchor: {B.is_trusted_anchor(r)}")
s = B.classify(2024, 4, 10, role=R.SAMPLE_COLLECTED_ON, anchor=r.derived_ad, anchor_trusted=True, today=TODAY)
show("  sample, anchor trusted", s)
print(f"  sample may anchor others: {B.is_trusted_anchor(s)}   (no chains)")

rule("6. Wrong reads are still caught with an untrusted anchor")
show("follow_up '2081/04/12' (paper 2026-11-20)",
     B.classify(2081, 4, 12, role=R.FOLLOW_UP_ON, anchor=visit, today=TODAY))
show("sample '2024/04/12' (visit 2026-11-20)",
     B.classify(2024, 4, 12, role=R.SAMPLE_COLLECTED_ON, anchor=visit, today=TODAY))

rule("7. Invalid, out-of-table, out-of-window keep their reason")
for tok in [(2083, 8, 30), (2101, 1, 1), (2091, 1, 1), (2083, 13, 1)]:
    r = B.classify(*tok, today=TODAY)
    print(f"  '{r.printed_text}' -> {r.status.value:13} {r.note[:90]}")

rule("8. Cross-role order checks")
ok = {R.SAMPLE_COLLECTED_ON: dt.date(2026, 11, 18), R.REPORTED_ON: dt.date(2026, 11, 20),
      R.PRESCRIBED_ON: dt.date(2026, 11, 20), R.FOLLOW_UP_ON: dt.date(2026, 12, 20)}
print(f"  consistent -> {B.check_order(ok) or 'none'}")
broken = dict(ok, **{R.REPORTED_ON: dt.date(2026, 11, 17)})
for msg in B.check_order(broken):
    print(f"  broken     -> {msg}")

rule("9. Today")
y, m, d = B.ad_to_bs(TODAY)
print(f"  AD {TODAY} = BS {y}/{m:02d}/{d:02d} ({B.MONTH_NAMES[m - 1]}), precision={B.precision_for(y)}")
