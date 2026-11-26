"""
Bikram Sambat <-> Gregorian conversion for abhilekh's derived layer.

Design rules that come straight from the product spec:

  * The PRINTED date is the record. This module never rewrites it.
  * Conversion happens only in the derived layer, and it carries provenance
    back to the printed token (printed_text, calendar_assumption,
    table_version).
  * When the calendar cannot be resolved, the derived value is flagged, not
    guessed. The record still stores the printed string.
  * A date outside the calendar table is NOT an error to paper over. It is a
    state (`out_of_table`) the UI must be able to show.

CALENDAR TABLE
  Source     : nepali-datetime 1.0.8.5, calendar_bs.csv (PyPI)
               https://pypi.org/project/nepali-datetime/
  Coverage   : BS 1975/01/01 .. BS 2100/12/30  (126 BS years)
  Epoch      : BS 1975/01/01 == AD 1918-04-13
  Cross-check: the published BS new-year table (BS 2000-2090)
               https://khatain.com/knowledge/bs-to-ad-year-chart

DAY PRECISION
  Verified for BS 2000-2090 (see derived/verify_calendar.py):
    * The pinned table and npm `nepali-date` 0.1.4 agree on 89 of 91 years
      (the 2 differences are at that package's coverage edge).
    * Both disagree with the khatain.com chart on the same 26 years by +/-1
      day. The chart is internally inconsistent (14 of 90 Baisakh-1 spans
      are 364 or 367 days, impossible for any year), so it is REJECTED as a reference.
    * Baisakh 1 is a public holiday; its reported AD date matches the pinned
      table on the disputed years (e.g. BS 2075 = 14 Apr 2018,
      BS 2079 = 14 Apr 2022, BS 2084 = 14 Apr 2027).
  Inside BS 2000-2090 precision='day'; outside it 'approximate_day'.
  NEVER use npm `nepali-date-converter` 3.4.2: epoch 1943-04-13, one day
  early on 3273 of 3276 sampled dates.

TWO FILTERS, KEPT SEPARATE (v0.2)
  1. CALENDAR filter -- which readings give a plausible record date at all,
     plus explicit calendar evidence (calendar_hint). Only this may decide
     the calendar on its own.
  2. EVENT filter -- does the reading fit the role's event window? For
     anchor-relative roles it may narrow ONLY around a trusted anchor. An
     untrusted anchor can flag a conflict, never pick a calendar.
"""

from __future__ import annotations

import csv
import datetime as _dt
import os
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

CALENDAR_VERSION = "nepali_datetime-1.0.8.5/1975-2100BS"
CALENDAR_SOURCE = "https://pypi.org/project/nepali-datetime/ (calendar_bs.csv)"
DAY_PRECISION = "approximate_day"      # outside the cross-checked range
CROSS_CHECKED_BS = (2000, 2090)          # see verify_calendar.py


def precision_for(bs_year: int) -> str:
    lo, hi = CROSS_CHECKED_BS
    return "day" if lo <= bs_year <= hi else DAY_PRECISION

MONTH_NAMES = [
    "Baisakh", "Jestha", "Asar", "Shrawan", "Bhadra", "Asoj",
    "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra",
]

_TABLE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "calendar_bs.csv")

_TABLE: dict[int, list[int]] = {}
with open(_TABLE_PATH, newline="", encoding="utf-8") as _fh:
    for _row in csv.DictReader(_fh):
        _TABLE[int(_row["Year"])] = [int(_row[m]) for m in (
            "Baisakh", "Jestha", "Ashar", "Shrawan", "Bhadra", "Asoj",
            "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chait")]

MIN_BS_YEAR = min(_TABLE)
MAX_BS_YEAR = max(_TABLE)

_CUM: dict[int, int] = {}
_run = 0
for _y in range(MIN_BS_YEAR, MAX_BS_YEAR + 1):
    _CUM[_y] = _run
    _run += sum(_TABLE[_y])

_EPOCH = _dt.date(1918, 4, 13)  # BS 1975/01/01


class Calendar(str, Enum):
    BS = "BS"
    AD = "AD"
    UNKNOWN = "UNKNOWN"


class DerivedStatus(str, Enum):
    OK = "ok"
    AMBIGUOUS = "ambiguous"
    OUT_OF_TABLE = "out_of_table"
    OUT_OF_WINDOW = "out_of_window"
    INVALID = "invalid"


class DateRole(str, Enum):
    """Every printed date has a ROLE. The role decides which windows apply."""

    VISIT_DATE = "visit_date"
    PRESCRIBED_ON = "prescribed_on"
    SAMPLE_COLLECTED_ON = "sample_collected_on"
    REPORTED_ON = "reported_on"
    ADMITTED_ON = "admitted_on"
    DISCHARGED_ON = "discharged_on"
    FOLLOW_UP_ON = "follow_up_on"
    BIRTH_DATE = "birth_date"
    OTHER = "other"


class Basis(str, Enum):
    """What decided the calendar call."""

    CALENDAR = "calendar_filter"   # only one reading is a plausible record date
    HINT = "calendar_hint"         # explicit evidence: month name, BS/AD marker, page consensus
    ROLE = "role_window"           # an anchor-free role window (e.g. birth_date) removed a reading
    ANCHOR = "trusted_anchor"      # an event window around a TRUSTED anchor removed a reading
    HUMAN = "human"                # a person chose (set by the verification stage, not here)
    NONE = "none"


# Roles whose event window is relative to another date on the paper.
ANCHOR_ROLES = frozenset({
    DateRole.SAMPLE_COLLECTED_ON, DateRole.REPORTED_ON, DateRole.ADMITTED_ON,
    DateRole.DISCHARGED_ON, DateRole.FOLLOW_UP_ON,
})

# A date may serve as a trusted anchor only if its own calendar was decided by
# one of these. A date resolved via an anchor can never anchor another date
# (no chains: one wrong date must not propagate).
TRUSTED_ANCHOR_BASES = frozenset({Basis.CALENDAR, Basis.HINT, Basis.HUMAN})


@dataclass
class RoleWindow:
    role: DateRole
    earliest: _dt.date
    latest: _dt.date
    basis: str
    anchor: Optional[_dt.date] = None

    def contains(self, d: _dt.date) -> bool:
        return self.earliest <= d <= self.latest


@dataclass
class DerivedDate:
    """The derived-layer date record. `printed_text` is never altered."""

    printed_text: str
    status: DerivedStatus
    calendar_assumption: Calendar = Calendar.UNKNOWN
    derived_ad: Optional[_dt.date] = None
    derived_bs: Optional[tuple[int, int, int]] = None
    table_version: str = CALENDAR_VERSION
    precision: str = "day"
    note: str = ""
    role: Optional[DateRole] = None
    role_window: Optional[RoleWindow] = None
    alternatives: list[str] = field(default_factory=list)
    resolution_basis: str = Basis.NONE.value
    event_check: str = "not_evaluated"     # pass | fail | not_evaluated
    anchor_trusted: bool = False


class BSOutOfTable(Exception):
    pass


def bs_to_ad(y: int, m: int, d: int) -> _dt.date:
    """BS -> AD. Raises BSOutOfTable if the BS year is outside the table."""
    if y not in _TABLE:
        raise BSOutOfTable(f"BS {y} outside table {MIN_BS_YEAR}-{MAX_BS_YEAR}")
    months = _TABLE[y]
    if not 1 <= m <= 12:
        raise ValueError(f"invalid BS month {m}")
    if not 1 <= d <= months[m - 1]:
        raise ValueError(f"invalid BS day {d} for {MONTH_NAMES[m - 1]} {y}")
    return _EPOCH + _dt.timedelta(days=_CUM[y] + sum(months[: m - 1]) + (d - 1))


def ad_to_bs(date: _dt.date) -> tuple[int, int, int]:
    """AD -> BS. Raises BSOutOfTable outside the table."""
    for y in range(MIN_BS_YEAR, MAX_BS_YEAR + 1):
        months = _TABLE[y]
        base = _EPOCH + _dt.timedelta(days=_CUM[y])
        if base <= date < base + _dt.timedelta(days=sum(months)):
            rem = (date - base).days
            offset = 0
            for idx, length in enumerate(months, start=1):
                if rem < offset + length:
                    return (y, idx, rem - offset + 1)
                offset += length
    raise BSOutOfTable(f"AD {date} outside table {MIN_BS_YEAR}-{MAX_BS_YEAR}")


def _is_real_ad(y: int, m: int, d: int) -> bool:
    try:
        _dt.date(y, m, d)
        return True
    except ValueError:
        return False


def role_window(
    role: Optional[DateRole],
    anchor: Optional[_dt.date] = None,
    today: Optional[_dt.date] = None,
    horizon_years: int = 3,
) -> RoleWindow:
    """
    The EVENT plausibility window for a date role.

    This is deliberately separate from the CALENDAR plausibility window. The
    calendar question is "which calendar is this token in?"; the role question
    is "could an event of this kind have happened on this date?". Applying the
    role window as a filter on calendar candidates is what lets a role
    disambiguate BS vs AD -- but only because the two filters are independent.

    `anchor` is the reference date for the role (the visit date, the
    prescription date, the admission date), not necessarily `today`.
    """
    today = today or _dt.date.today()
    horizon = _dt.timedelta(days=365 * horizon_years)
    broad_earliest = _dt.date(today.year - 100, 1, 1)
    broad_latest = today + horizon

    if role is None or role is DateRole.OTHER:
        return RoleWindow(role or DateRole.OTHER, broad_earliest, broad_latest,
                          "broad window: 100y back to 3y forward")

    if role is DateRole.BIRTH_DATE:
        return RoleWindow(role, _dt.date(today.year - 120, 1, 1), today,
                          "a person cannot be born in the future or over 120y ago")

    if role in (DateRole.VISIT_DATE, DateRole.PRESCRIBED_ON):
        return RoleWindow(role, broad_earliest, broad_latest,
                          "paper cannot pre-date 100y ago or be dated >3y ahead")

    if role is DateRole.SAMPLE_COLLECTED_ON:
        base = anchor or today
        return RoleWindow(role, base - _dt.timedelta(days=30),
                          base + _dt.timedelta(days=30),
                          "sample taken within +/-30d of the visit", base)

    if role is DateRole.REPORTED_ON:
        base = anchor or today
        return RoleWindow(role, base - _dt.timedelta(days=30),
                          base + _dt.timedelta(days=21),
                          "report issued within 3 weeks of the visit", base)

    if role is DateRole.ADMITTED_ON:
        base = anchor or today
        return RoleWindow(role, base - _dt.timedelta(days=365),
                          base + _dt.timedelta(days=1),
                          "admission up to 1y before the visit, not after", base)

    if role is DateRole.DISCHARGED_ON:
        base = anchor or today
        return RoleWindow(role, base, base + _dt.timedelta(days=365),
                          "discharge on/after admission, within 1y", base)

    if role is DateRole.FOLLOW_UP_ON:
        base = anchor or today
        return RoleWindow(role, base, base + _dt.timedelta(days=365),
                          "follow-up within 1y of the paper", base)

    return RoleWindow(role, broad_earliest, broad_latest, "broad window")


# Relative order rules between roles, checked after individual classification.
ORDER_RULES = [
    (DateRole.SAMPLE_COLLECTED_ON, DateRole.REPORTED_ON, "report cannot precede the sample"),
    (DateRole.ADMITTED_ON, DateRole.DISCHARGED_ON, "discharge cannot precede admission"),
    (DateRole.PRESCRIBED_ON, DateRole.FOLLOW_UP_ON, "follow-up cannot precede the prescription"),
    (DateRole.VISIT_DATE, DateRole.FOLLOW_UP_ON, "follow-up cannot precede the visit"),
]


def check_order(dates: dict[DateRole, _dt.date]) -> list[str]:
    """Cross-role consistency. Returns a list of human-readable violations."""
    violations: list[str] = []
    for earlier, later, why in ORDER_RULES:
        a, b = dates.get(earlier), dates.get(later)
        if a and b and b < a:
            violations.append(
                f"{later.value} ({b}) is before {earlier.value} ({a}) -- {why}")
    return violations


def classify(
    y: int,
    m: int,
    d: int,
    role: Optional[DateRole] = None,
    anchor: Optional[_dt.date] = None,
    anchor_trusted: bool = False,
    calendar_hint: Optional[Calendar] = None,
    today: Optional[_dt.date] = None,
    horizon_years: int = 3,
) -> DerivedDate:
    """
    Decide which calendar a printed date token belongs to.

    1. CALENDAR filter: keep readings that give a plausible record date
       (100y back .. 3y ahead); then apply `calendar_hint` if given.
    2. EVENT filter: compare readings with the role's event window.
         - anchor-free roles (visit_date, prescribed_on, birth_date): may narrow.
         - anchor-relative roles: may narrow ONLY if `anchor_trusted`.
           With an untrusted anchor the window is used to CHECK (flag a
           conflict, annotate alternatives), never to choose a calendar.
           Otherwise a visit misread as BS drags every dependent date to BS
           with it, the order checks pass, and the whole page is wrong
           together.

    The BS->AD year offset is not a constant 57: from about 17 Poush to the
    end of Chaitra the AD year is BS-56 (see flip_boundary()).
    """
    today = today or _dt.date.today()
    printed = f"{y:04d}/{m:02d}/{d:02d}"

    candidates: list[tuple[Calendar, _dt.date]] = []
    bs_out_of_table = False
    bs_error = ""
    try:
        candidates.append((Calendar.BS, bs_to_ad(y, m, d)))
    except BSOutOfTable:
        bs_out_of_table = True
        bs_error = f"BS {y} is outside the calendar table ({MIN_BS_YEAR}-{MAX_BS_YEAR})"
    except ValueError as exc:
        bs_error = f"not a valid BS date ({exc}) -- possible misread digit"
    if _is_real_ad(y, m, d):
        candidates.append((Calendar.AD, _dt.date(y, m, d)))

    def bs_of(cal: Calendar, ad: _dt.date) -> tuple[int, int, int]:
        return ad_to_bs(ad) if cal is Calendar.AD else (y, m, d)

    if not candidates:
        return DerivedDate(
            printed_text=printed,
            status=DerivedStatus.OUT_OF_TABLE if bs_out_of_table else DerivedStatus.INVALID,
            role=role, note=bs_error or "Not a valid date in either calendar.")

    # --- filter 1: calendar ------------------------------------------------
    broad = role_window(None, today=today, horizon_years=horizon_years)
    kept = [c for c in candidates if broad.contains(c[1])]
    if not kept:
        detail = "; ".join(f"{cal.value} {y}/{m}/{d} -> AD {ad}" for cal, ad in candidates)
        if bs_out_of_table:
            return DerivedDate(
                printed_text=printed, status=DerivedStatus.OUT_OF_TABLE,
                calendar_assumption=Calendar.BS, role=role, precision=DAY_PRECISION,
                note=f"{bs_error}. The only plausible reading is BS, which this "
                     f"table cannot convert ({detail}); printed text retained.")
        note = (f"{detail} -- outside the plausible record window "
                f"({broad.earliest} .. {broad.latest}); printed text retained.")
        if bs_error:
            note = f"{bs_error}. {note}"
        return DerivedDate(
            printed_text=printed, status=DerivedStatus.OUT_OF_WINDOW,
            calendar_assumption=candidates[0][0], derived_ad=candidates[0][1],
            role=role, precision=DAY_PRECISION, note=note)

    basis = Basis.CALENDAR
    notes: list[str] = [bs_error] if bs_error else []
    if calendar_hint in (Calendar.BS, Calendar.AD):
        hinted = [c for c in kept if c[0] is calendar_hint]
        if hinted:
            if len(hinted) < len(kept):
                basis = Basis.HINT
            kept = hinted
        else:
            notes.append(f"calendar hint {calendar_hint.value} is not viable for this token; ignored")

    # --- filter 2: event ---------------------------------------------------
    anchored = role in ANCHOR_ROLES
    window = None if (anchored and anchor is None) else role_window(
        role, anchor=anchor, today=today, horizon_years=horizon_years)
    may_narrow = window is not None and (not anchored or anchor_trusted)
    fits = [c for c in kept if window.contains(c[1])] if window else list(kept)
    event = "not_evaluated" if window is None else ("pass" if fits else "fail")

    if window is not None and not fits:
        detail = "; ".join(f"{cal.value} -> AD {ad}" for cal, ad in kept)
        who = "trusted anchor" if (anchored and anchor_trusted) else (
            "UNTRUSTED anchor: this token or the anchor is misread" if anchored else "role window")
        notes.append(f"No reading falls in the {role.value} window "
                     f"({window.earliest} .. {window.latest}; {who}) -- {detail}; "
                     f"printed text retained.")
        return DerivedDate(
            printed_text=printed, status=DerivedStatus.OUT_OF_WINDOW,
            calendar_assumption=kept[0][0] if len(kept) == 1 else Calendar.UNKNOWN,
            derived_ad=kept[0][1] if len(kept) == 1 else None, role=role,
            role_window=window, precision=DAY_PRECISION, note="; ".join(notes),
            event_check="fail", anchor_trusted=anchor_trusted)

    if may_narrow:
        if len(fits) < len(kept):
            basis = Basis.ANCHOR if anchored else Basis.ROLE
        kept = fits

    # --- resolution ----------------------------------------------------------
    if len(kept) == 1:
        cal, ad = kept[0]
        bs = bs_of(cal, ad)
        return DerivedDate(
            printed_text=printed, status=DerivedStatus.OK, calendar_assumption=cal,
            derived_ad=ad, derived_bs=bs, precision=precision_for(bs[0]), role=role,
            role_window=window, note="; ".join(notes), resolution_basis=basis.value,
            event_check=event, anchor_trusted=anchor_trusted)

    alts = []
    for cal, ad in kept:
        bs = bs_of(cal, ad)
        tag = "" if window is None else (
            " [fits window]" if window.contains(ad) else " [outside window]")
        alts.append(f"{cal.value} {y}/{m}/{d} -> AD {ad} (BS {bs[0]}/{bs[1]}/{bs[2]}){tag}")
    notes.append("Both calendars plausible; resolve from page context or human confirmation.")
    if anchored and window is not None and not anchor_trusted:
        notes.append("Anchor not trusted: the event window annotated the readings but did not choose.")
    return DerivedDate(
        printed_text=printed, status=DerivedStatus.AMBIGUOUS,
        calendar_assumption=Calendar.UNKNOWN, role=role, role_window=window,
        alternatives=alts, note=" ".join(notes), resolution_basis=Basis.NONE.value,
        event_check=event, anchor_trusted=anchor_trusted)


def is_trusted_anchor(r: DerivedDate) -> bool:
    """A resolved date may anchor others only if filter 1, a hint or a person decided it."""
    return r.status is DerivedStatus.OK and Basis(r.resolution_basis) in TRUSTED_ANCHOR_BASES


def offset_years(y: int, m: int, d: int) -> Optional[float]:
    """How many years a BS date is off if it is mistakenly read as AD."""
    try:
        bs_ad = bs_to_ad(y, m, d)
    except (BSOutOfTable, ValueError):
        return None
    return round((_dt.date(y, m, d) - bs_ad).days / 365.25, 2)


def flip_boundary(bs_year: int) -> Optional[tuple[int, int, int]]:
    """
    The BS date at which the AD year rolls over inside a BS year.

    Before it, AD year = BS year - 57. From it onward, AD year = BS year - 56.
    Returns None if the whole BS year falls in one zone.
    """
    if bs_year not in _TABLE:
        return None
    months = _TABLE[bs_year]
    first = bs_to_ad(bs_year, 1, 1)
    if first.year == bs_year - 57:
        for m in range(1, 13):
            last = bs_to_ad(bs_year, m, months[m - 1])
            if last.year == bs_year - 56:
                # find the first day of that month that rolls over
                for d in range(1, months[m - 1] + 1):
                    if bs_to_ad(bs_year, m, d).year == bs_year - 56:
                        return (bs_year, m, d)
    return None


def zone_for(bs_year: int, m: int, d: int) -> str:
    """'BS-57' or 'BS-56' for a BS date."""
    ad = bs_to_ad(bs_year, m, d)
    return f"BS-{bs_year - ad.year}"
