"""
Writes server/public/bs-months.json: the BS month lengths the date-of-birth picker offers (decided 26 Nov 2026).

Run: python3 derived/make_bs_months.py

Range: BS 1983-2090, so a date of birth up to 100 years old can be picked.
  - BS 2000-2090: the pinned table (derived/calendar_bs.csv), verified by verify_calendar.py.
  - BS 1983-1999: the pinned table, checked on 26 Nov 2026 against npm bikram-sambat 1.8.1 and
    @sbmdkl/nepali-date-converter 2.0.5: 1 Baisakh falls on 13 April in all of them for every year;
    the month lengths agree in 14 of the 17 years. In BS 1989, 1991 and 1993 the sources split one
    day between two neighbouring months (same year length). There the picker offers the longer of
    the two, so it never refuses a day that a source says exists. The picker stores the date as
    picked and never converts it, so the split cannot move a date.
"""
import csv
import datetime as dt
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
LO, HI = 1983, 2090
# The other sources' rows where they differ from the pinned table (same year length).
SPLIT = {
    1989: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
    1991: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
    1993: [31, 31, 31, 32, 31, 31, 30, 29, 30, 29, 30, 30],
}
FIRST_BAISAKH_AD = {1983: dt.date(1926, 4, 13)}  # all three sources agree


def build():
    rows = {int(r["Year"]): [int(r[k]) for k in list(r)[1:]]
            for r in csv.DictReader(open(os.path.join(HERE, "calendar_bs.csv"), encoding="utf-8"))}
    months = {}
    for y in range(LO, HI + 1):
        m = rows[y]
        if y in SPLIT:
            assert sum(SPLIT[y]) == sum(m)
            m = [max(a, b) for a, b in zip(m, SPLIT[y])]
        months[str(y)] = m
    # 1 Baisakh of each year in AD, from the pinned table (used only to stop dates in the future)
    start, ny = FIRST_BAISAKH_AD[LO], {}
    for y in range(LO, HI + 1):
        ny[str(y)] = start.isoformat()
        start += dt.timedelta(days=sum(rows[y]))
    return {"about": "BS month lengths offered by the date-of-birth picker, BS 1983-2090. "
                     "Made by derived/make_bs_months.py; do not edit by hand.",
            "split_years": sorted(SPLIT), "months": months, "first_baisakh_ad": ny}


if __name__ == "__main__":
    out = os.path.join(HERE, "..", "server", "public", "bs-months.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(build(), f, separators=(",", ":"))
        f.write("\n")
    print("wrote", os.path.normpath(out))
