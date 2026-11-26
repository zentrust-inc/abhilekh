"""
Reproducible check of the pinned BS calendar table (derived/calendar_bs.csv).

Run: python3 derived/verify_calendar.py

Checks
  1. Pinned table is internally consistent: every BS year is 365 or 366 days,
     and consecutive years tile the timeline with no gaps. Fails only inside
     the verified range; outside it a defect is reported (known: BS 2096 has
     364 days), which is why dates there carry precision='approximate_day'.
  2. Pinned table matches the Nepali New Year (1 Baisakh) public-holiday dates
     on the years where references disagree.
  3. The khatain.com BS-to-AD chart is internally consistent. It is not: some
     of its Baisakh-1 -> next Baisakh-1 spans are 364 or 367 days, which no
     calendar year can be (14 of 90 spans). It is therefore rejected.
  4. Optional: compare with npm `nepali-date` 0.1.4, if Node and that package
     are installed (`npm install nepali-date@0.1.4`). Skipped otherwise.

Exit code 0 when checks 1 and 2 pass.

Never use npm `nepali-date-converter` 3.4.2: its epoch is 1943-04-13, one day
early on 3273 of 3276 sampled dates (Dr. Shrestha, 26 Nov 2026).
"""

import datetime as dt
import json
import os
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from derived import bs_dates as B  # noqa: E402

# 1 Baisakh is a public holiday in Nepal; its AD date is independently reported.
HOLIDAY_NEW_YEAR = {
    2075: (dt.date(2018, 4, 14), "timeanddate.com Nepal public holidays 2018; Kathmandu Post 14 Apr 2018"),
    2079: (dt.date(2022, 4, 14), "Ministry of Home Affairs public holiday list 2079 BS"),
    2084: (dt.date(2027, 4, 14), "three independent BS/AD converter sites (Dr. Shrestha, 26 Nov 2026)"),
}

# khatain.com/knowledge/bs-to-ad-year-chart: day of April for 1 Baisakh,
# BS 2000-2090 (AD year = BS - 57), as parsed by Dr. Shrestha on 26 Nov 2026.
KHATAIN_APRIL_DAY = {
    2000: 14, 2001: 13, 2002: 13, 2003: 13, 2004: 14, 2005: 13, 2006: 13, 2007: 14,
    2008: 13, 2009: 13, 2010: 13, 2011: 13, 2012: 14, 2013: 13, 2014: 13, 2015: 13,
    2016: 14, 2017: 13, 2018: 13, 2019: 13, 2020: 14, 2021: 13, 2022: 13, 2023: 13,
    2024: 14, 2025: 13, 2026: 13, 2027: 14, 2028: 14, 2029: 13, 2030: 13, 2031: 14,
    2032: 13, 2033: 13, 2034: 13, 2035: 14, 2036: 13, 2037: 13, 2038: 13, 2039: 14,
    2040: 13, 2041: 13, 2042: 13, 2043: 14, 2044: 13, 2045: 13, 2046: 13, 2047: 14,
    2048: 13, 2049: 13, 2050: 13, 2051: 14, 2052: 13, 2053: 13, 2054: 13, 2055: 14,
    2056: 13, 2057: 13, 2058: 14, 2059: 13, 2060: 13, 2061: 14, 2062: 13, 2063: 13,
    2064: 14, 2065: 13, 2066: 14, 2067: 13, 2068: 13, 2069: 13, 2070: 14, 2071: 14,
    2072: 14, 2073: 13, 2074: 14, 2075: 13, 2076: 13, 2077: 13, 2078: 14, 2079: 13,
    2080: 14, 2081: 13, 2082: 14, 2083: 14, 2084: 15, 2085: 14, 2086: 15, 2087: 15,
    2088: 16, 2089: 15, 2090: 15,
}


def rule(title):
    print(f"\n{'=' * 78}\n{title}\n{'=' * 78}")


def check_pinned_consistency():
    rule("1. Pinned table: internal consistency")
    lo, hi = B.CROSS_CHECKED_BS
    bad = []
    for y in range(B.MIN_BS_YEAR, B.MAX_BS_YEAR + 1):
        length = sum(B._TABLE[y])
        if length not in (365, 366):
            bad.append((y, length))
        if y < B.MAX_BS_YEAR:
            gap = (B.bs_to_ad(y + 1, 1, 1) - B.bs_to_ad(y, 12, B._TABLE[y][11])).days
            if gap != 1:
                bad.append((y, f"gap {gap}"))
    inside = [b for b in bad if lo <= b[0] <= hi]
    print(f"  years: {B.MAX_BS_YEAR - B.MIN_BS_YEAR + 1}   problems: {len(bad)} "
          f"({len(inside)} inside BS {lo}-{hi})")
    for b in bad:
        where = "INSIDE verified range" if lo <= b[0] <= hi else "outside verified range -> approximate_day"
        print(f"    BS {b[0]}: {b[1]}   [{where}]")
    return not inside


def check_holidays():
    rule("2. Pinned table vs New Year public-holiday dates")
    ok = True
    for y, (ad, src) in sorted(HOLIDAY_NEW_YEAR.items()):
        got = B.bs_to_ad(y, 1, 1)
        match = got == ad
        ok &= match
        print(f"  BS {y}: pinned {got}  holiday {ad}  {'match' if match else 'MISMATCH'}   ({src})")
    return ok


def check_khatain():
    rule("3. khatain.com chart: internal consistency and agreement")
    starts = {y: dt.date(y - 57, 4, d) for y, d in KHATAIN_APRIL_DAY.items()}
    spans = [(y, (starts[y + 1] - starts[y]).days) for y in sorted(starts) if y + 1 in starts]
    impossible = [(y, n) for y, n in spans if n not in (365, 366)]
    print(f"  Baisakh-1 spans: {len(spans)}   impossible (not 365/366 days): {len(impossible)}")
    print(f"    {', '.join(f'{y}:{n}' for y, n in impossible)}")
    disagree = [y for y, ad in starts.items() if B.bs_to_ad(y, 1, 1) != ad]
    print(f"  years where chart != pinned table: {len(disagree)} of {len(starts)}")
    on_holiday = [y for y in HOLIDAY_NEW_YEAR if starts.get(y) != HOLIDAY_NEW_YEAR[y][0]]
    print(f"  chart wrong on holiday-checked years: {on_holiday}")
    print("  => chart REJECTED as a reference.")


def check_npm():
    rule("4. Optional: npm nepali-date 0.1.4")
    node = shutil.which("node")
    if not node:
        print("  skipped: node not installed")
        return
    js = (
        "let ND; try { ND = require('nepali-date'); } catch (e) { console.log('null'); process.exit(0); }"
        "const out = {}; for (let y = 2000; y <= 2090; y++) { try { const d = new ND(y, 0, 1);"
        " const g = d.getEnglishDate ? d.getEnglishDate() : d.toJsDate();"
        " out[y] = g.getFullYear() + '-' + String(g.getMonth() + 1).padStart(2, '0') + '-' +"
        " String(g.getDate()).padStart(2, '0'); } catch (e) {} } console.log(JSON.stringify(out));"
    )
    res = subprocess.run([node, "-e", js], capture_output=True, text=True, cwd=os.getcwd())
    data = json.loads(res.stdout.strip() or "null")
    if data is None:
        print("  skipped: package not installed (npm install nepali-date@0.1.4)")
        return
    diff = [int(y) for y, ad in data.items() if str(B.bs_to_ad(int(y), 1, 1)) != ad]
    print(f"  years compared: {len(data)}   differ from pinned: {len(diff)}  {diff}")


def main():
    print(f"pinned table: {B.CALENDAR_VERSION}")
    ok = check_pinned_consistency()
    ok &= check_holidays()
    check_khatain()
    check_npm()
    rule("Result")
    print(f"  pinned table {'VERIFIED' if ok else 'FAILED'} for day precision, BS "
          f"{B.CROSS_CHECKED_BS[0]}-{B.CROSS_CHECKED_BS[1]}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
