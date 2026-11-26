"""
Printed date token -> numeric candidates, ahead of bs_dates.classify().

The printed text is never changed. This module only lists what the token could
mean, and says why it cannot say more. It handles what the readers copy from
real papers (page.v2 `dates[].as_written`):

  2083/08/09   2083-8-9 BS   2-5-023   19-1-080   2.5.23   30/Oct/2023 09:27AM
  Sep 2023     १२ बैशाख २०८०   २०८०/०८/२१   12 Baisakh 2080

Rules
  * Devanagari digits are read as digits; nothing else is translated.
  * A calendar marker (BS, B.S., वि.सं., AD, A.D., ई.सं.) or a month NAME is
    evidence: a Nepali month name means BS, an English one means AD.
  * A truncated year is expanded, never guessed: "023"/"080" -> 2023/2080
    (the leading 0 is the hundreds digit); two digits "23" -> 2023 and 1923.
  * Day/month order is decided only by a number above 12. Otherwise both
    orders are candidates (status 'ambiguous_order'). A page-level hint (another
    date on the same page that forces an order) may be applied by the caller,
    and is recorded as such.
  * Month + year with no day is 'partial' (precision month). No day is invented.
"""

from __future__ import annotations

import datetime as _dt
import re
from dataclasses import dataclass, field
from typing import Optional

try:  # package import (derived.date_tokens) or script import
    from derived import bs_dates as B
except ImportError:  # pragma: no cover
    import bs_dates as B  # type: ignore

PARSER_VERSION = "date_tokens-1.0"

_DEV = str.maketrans("०१२३४५६७८९", "0123456789")

BS_MONTHS = {
    1: ["baisakh", "baishakh", "vaishakh", "बैशाख", "वैशाख", "बैसाख"],
    2: ["jestha", "jeth", "जेठ", "जेष्ठ", "ज्येष्ठ"],
    3: ["asar", "ashar", "ashadh", "असार", "आषाढ"],
    4: ["shrawan", "saun", "srawan", "साउन", "श्रावण"],
    5: ["bhadra", "bhadau", "भदौ", "भाद्र"],
    6: ["asoj", "ashwin", "असोज", "आश्विन"],
    7: ["kartik", "कात्तिक", "कार्तिक"],
    8: ["mangsir", "mangshir", "मंसिर", "मङ्सिर", "मार्गशीर्ष"],
    9: ["poush", "push", "paush", "पुस", "पौष"],
    10: ["magh", "माघ"],
    11: ["falgun", "phagun", "fagun", "फागुन", "फाल्गुन"],
    12: ["chaitra", "chait", "चैत", "चैत्र"],
}
AD_MONTHS = {
    1: ["jan", "january"], 2: ["feb", "february"], 3: ["mar", "march"], 4: ["apr", "april"],
    5: ["may"], 6: ["jun", "june"], 7: ["jul", "july"], 8: ["aug", "august"],
    9: ["sep", "sept", "september"], 10: ["oct", "october"], 11: ["nov", "november"], 12: ["dec", "december"],
}
_MONTH_LOOKUP: dict[str, tuple[str, int]] = {}
for _m, names in BS_MONTHS.items():
    for n in names:
        _MONTH_LOOKUP[n] = ("BS", _m)
for _m, names in AD_MONTHS.items():
    for n in names:
        _MONTH_LOOKUP[n] = ("AD", _m)

_BS_MARK = re.compile(r"(?<![a-z])(b\.?\s?s\.?|v\.?\s?s\.?)(?![a-z])|वि\.?\s?सं|बि\.?\s?सं", re.I)
_AD_MARK = re.compile(r"(?<![a-z])(a\.?\s?d\.?)(?![a-z])|ई\.?\s?सं", re.I)
_TIME = re.compile(r"\b\d{1,2}:\d{2}(:\d{2})?\s*(am|pm)?\b", re.I)
_NUM3 = re.compile(r"(\d{1,4})\s*[-/.]\s*(\d{1,4})\s*[-/.]\s*(\d{1,4})")
_WORD = re.compile(r"[^\s\d/.,:;()\-]+")  # letters incl. Devanagari vowel signs


@dataclass
class Candidate:
    y: int
    m: int
    d: Optional[int]
    order: str              # YMD | DMY | MDY | DMonY | MonY ...
    year_note: str = ""     # "expanded 023 -> 2023"


@dataclass
class ParsedDate:
    printed_text: str
    status: str             # parsed | ambiguous_order | partial | unparsed
    candidates: list[Candidate] = field(default_factory=list)
    calendar_hint: Optional[B.Calendar] = None
    hint_source: str = ""   # "marker 'BS'" | "month name 'Oct'"
    notes: list[str] = field(default_factory=list)
    parser_version: str = PARSER_VERSION


def _years(tok: str) -> list[tuple[int, str]]:
    n = int(tok)
    if len(tok) == 4:
        return [(n, "")]
    if len(tok) == 3 and tok.startswith("0"):
        return [(2000 + n, f"expanded {tok} -> {2000 + n}")]
    if len(tok) == 2:
        return [(2000 + n, f"expanded {tok} -> {2000 + n}"), (1900 + n, f"expanded {tok} -> {1900 + n}")]
    return []


def _month_word(text: str) -> Optional[tuple[str, int, str]]:
    for w in _WORD.findall(text):
        hit = _MONTH_LOOKUP.get(w.lower())
        if hit:
            return hit[0], hit[1], w
    return None


def parse(printed: str) -> ParsedDate:
    """List what a printed date token could mean. Never alters `printed`."""
    out = ParsedDate(printed_text=printed, status="unparsed")
    if not printed or not printed.strip():
        out.notes.append("empty")
        return out
    t = _TIME.sub(" ", printed.translate(_DEV))

    if _BS_MARK.search(t):
        out.calendar_hint, out.hint_source = B.Calendar.BS, "calendar marker on the paper"
    elif _AD_MARK.search(t):
        out.calendar_hint, out.hint_source = B.Calendar.AD, "calendar marker on the paper"

    mw = _month_word(t)
    if mw:
        cal, month, word = mw
        hint = B.Calendar.BS if cal == "BS" else B.Calendar.AD
        if out.calendar_hint and out.calendar_hint is not hint:
            out.notes.append(f"marker says {out.calendar_hint.value} but month name '{word}' is {cal}; no hint used")
            out.calendar_hint, out.hint_source = None, ""
        else:
            out.calendar_hint, out.hint_source = hint, f"month name '{word}'"
        nums = re.findall(r"\d+", t)
        years = [n for n in nums if len(n) in (3, 4) or (len(n) == 2 and len(nums) > 1 and n == nums[-1])]
        days = [n for n in nums if len(n) <= 2 and n not in years[-1:]]
        if not years:
            out.notes.append("month name without a year")
            return out
        ytok = years[-1]
        for y, note in _years(ytok):
            d = int(days[0]) if days else None
            out.candidates.append(Candidate(y, month, d, "DMonY" if d else "MonY", note))
        out.status = "parsed" if days else "partial"
        if not days:
            out.notes.append("no day on the paper; precision month")
        return out

    m = _NUM3.search(t)
    if not m:
        out.notes.append("no day-month-year pattern")
        return out
    a, b, c = m.groups()
    cands: list[Candidate] = []
    if len(a) == 4 or (len(a) == 3 and a.startswith("0")):
        for y, note in _years(a):
            cands.append(Candidate(y, int(b), int(c), "YMD", note))
    else:
        years = _years(c)
        if not years:
            out.notes.append(f"cannot read a year from '{c}'")
            return out
        x, z = int(a), int(b)
        orders = []
        if x <= 12 and z <= 12 and x != z:
            orders = [("DMY", z, x), ("MDY", x, z)]
        elif z <= 12:
            orders = [("DMY", z, x)]
        elif x <= 12:
            orders = [("MDY", x, z)]
        else:
            out.notes.append("neither number can be a month")
            return out
        for order, mon, day in orders:
            for y, note in years:
                cands.append(Candidate(y, mon, day, order, note))
    out.candidates = cands
    orders = {c.order for c in cands}
    out.status = "ambiguous_order" if len(orders) > 1 else "parsed"
    return out


def page_order_hint(parsed: list[ParsedDate]) -> Optional[str]:
    """If some date on the page forces DMY (or MDY) and none forces the other, return it."""
    forced = set()
    for p in parsed:
        if p.status == "parsed":
            forced |= {c.order for c in p.candidates if c.order in ("DMY", "MDY")}
    return forced.pop() if len(forced) == 1 else None


def apply_order_hint(p: ParsedDate, order: str) -> ParsedDate:
    if p.status != "ambiguous_order":
        return p
    keep = [c for c in p.candidates if c.order == order]
    if keep:
        p.candidates, p.status = keep, "parsed"
        p.notes.append(f"day/month order {order} taken from another date on the same page")
    return p


@dataclass
class Resolved:
    parsed: ParsedDate
    status: str                     # ok | ambiguous | out_of_window | out_of_table | invalid | not_converted
    result: Optional[B.DerivedDate] = None
    alternatives: list[str] = field(default_factory=list)
    note: str = ""


def resolve(p: ParsedDate, role: Optional[B.DateRole] = None, anchor: Optional[_dt.date] = None,
            anchor_trusted: bool = False, today: Optional[_dt.date] = None) -> Resolved:
    """Run every candidate through bs_dates.classify(); one surviving reading -> ok, else ambiguous."""
    if p.status in ("unparsed",):
        return Resolved(p, "invalid", note="; ".join(p.notes) or "not a date")
    if p.status == "partial":
        return Resolved(p, "not_converted", note="month and year only; no day is invented")
    results = []
    for c in p.candidates:
        r = B.classify(c.y, c.m, c.d, role=role, anchor=anchor, anchor_trusted=anchor_trusted,
                       calendar_hint=p.calendar_hint, today=today)
        results.append((c, r))
    ok = [(c, r) for c, r in results if r.status is B.DerivedStatus.OK]
    amb = [(c, r) for c, r in results if r.status is B.DerivedStatus.AMBIGUOUS]
    readings = {r.derived_ad for _, r in ok}
    if len(ok) == 1 and not amb:
        return Resolved(p, "ok", ok[0][1])
    if ok or amb:
        alts = [f"{c.order} {c.y}/{c.m}/{c.d} -> {r.calendar_assumption.value} AD {r.derived_ad}" for c, r in ok]
        for c, r in amb:
            alts += [f"{c.order}: {a}" for a in r.alternatives]
        if len(readings) == 1 and not amb:
            return Resolved(p, "ok", ok[0][1], note="several readings, same date")
        return Resolved(p, "ambiguous", alternatives=alts, note="more than one reading survives; ask the patient")
    worst = results[0][1]
    return Resolved(p, worst.status.value, worst, note=worst.note)
