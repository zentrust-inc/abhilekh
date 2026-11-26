"""Tests for derived/date_tokens.py. SAMPLE tokens only. Run: python3 -m unittest derived/test_date_tokens.py"""

import datetime as dt
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from derived import bs_dates as B  # noqa: E402
from derived import date_tokens as T  # noqa: E402

TODAY = dt.date(2026, 11, 26)


def ymd(p):
    return sorted((c.y, c.m, c.d, c.order) for c in p.candidates)


class Parse(unittest.TestCase):
    def test_printed_text_is_never_changed(self):
        for s in ["२०८०/०८/२१", "2-5-023", "30/Oct/2023 09:27AM"]:
            self.assertEqual(T.parse(s).printed_text, s)

    def test_year_first(self):
        p = T.parse("2083/08/09")
        self.assertEqual((p.status, ymd(p)), ("parsed", [(2083, 8, 9, "YMD")]))

    def test_devanagari_digits(self):
        self.assertEqual(ymd(T.parse("२०८०/०८/२१")), [(2080, 8, 21, "YMD")])

    def test_bs_marker_is_a_hint(self):
        p = T.parse("2080/08/21 BS")
        self.assertIs(p.calendar_hint, B.Calendar.BS)
        self.assertIs(T.parse("12/04/2024 A.D.").calendar_hint, B.Calendar.AD)

    def test_three_digit_year_expands_without_guessing(self):
        p = T.parse("19-1-080")                       # 19 > 12, so day-month-year
        self.assertEqual(ymd(p), [(2080, 1, 19, "DMY")])
        self.assertIn("expanded 080 -> 2080", p.candidates[0].year_note)

    def test_both_orders_when_neither_number_is_above_12(self):
        p = T.parse("2-5-023")
        self.assertEqual(p.status, "ambiguous_order")
        self.assertEqual(ymd(p), [(2023, 2, 5, "MDY"), (2023, 5, 2, "DMY")])

    def test_two_digit_year_gives_both_centuries(self):
        self.assertEqual({c.y for c in T.parse("19.1.80").candidates}, {2080, 1980})

    def test_english_month_name_means_ad(self):
        p = T.parse("30/Oct/2023 09:27AM")
        self.assertEqual((ymd(p), p.calendar_hint), ([(2023, 10, 30, "DMonY")], B.Calendar.AD))

    def test_nepali_month_name_means_bs(self):
        for s in ["१२ बैशाख २०८०", "12 Baisakh 2080"]:
            p = T.parse(s)
            self.assertEqual((ymd(p), p.calendar_hint), ([(2080, 1, 12, "DMonY")], B.Calendar.BS), s)

    def test_month_and_year_only_is_partial(self):
        p = T.parse("Sep 2023")
        self.assertEqual((p.status, ymd(p)), ("partial", [(2023, 9, None, "MonY")]))

    def test_conflicting_marker_and_month_name_gives_no_hint(self):
        p = T.parse("12 Oct 2080 BS")
        self.assertIsNone(p.calendar_hint)
        self.assertTrue(any("no hint" in n for n in p.notes))

    def test_not_a_date(self):
        self.assertEqual(T.parse("F/U 10 days").status, "unparsed")
        self.assertEqual(T.parse("").status, "unparsed")


class PageHint(unittest.TestCase):
    def test_another_date_on_the_page_settles_the_order(self):
        page = [T.parse("2-5-023"), T.parse("19-1-080")]
        self.assertEqual(T.page_order_hint(page), "DMY")
        p = T.apply_order_hint(page[0], "DMY")
        self.assertEqual((p.status, ymd(p)), ("parsed", [(2023, 5, 2, "DMY")]))
        self.assertTrue(any("same page" in n for n in p.notes))

    def test_conflicting_pages_give_no_hint(self):
        self.assertIsNone(T.page_order_hint([T.parse("19-1-080"), T.parse("1-19-2023")]))


class Resolve(unittest.TestCase):
    def test_recent_bs_date_resolves(self):
        r = T.resolve(T.parse("2083/08/09"), role=B.DateRole.VISIT_DATE, today=TODAY)
        self.assertEqual((r.status, r.result.calendar_assumption, r.result.derived_ad),
                         ("ok", B.Calendar.BS, dt.date(2026, 11, 25)))

    def test_expanded_bs_year_resolves(self):
        r = T.resolve(T.parse("19-1-080"), role=B.DateRole.VISIT_DATE, today=TODAY)
        self.assertEqual((r.status, r.result.calendar_assumption), ("ok", B.Calendar.BS))

    def test_ambiguous_order_is_asked_not_picked(self):
        r = T.resolve(T.parse("2-5-023"), role=B.DateRole.VISIT_DATE, today=TODAY)
        self.assertEqual(r.status, "ambiguous")
        self.assertGreaterEqual(len(r.alternatives), 2)

    def test_month_name_resolves_with_its_calendar(self):
        r = T.resolve(T.parse("30/Oct/2023 09:27AM"), role=B.DateRole.REPORTED_ON, today=TODAY)
        self.assertEqual((r.status, r.result.derived_ad, r.result.resolution_basis),
                         ("ok", dt.date(2023, 10, 30), "calendar_hint"))

    def test_partial_is_not_converted(self):
        self.assertEqual(T.resolve(T.parse("Sep 2023"), today=TODAY).status, "not_converted")

    def test_invalid_bs_day_keeps_its_reason(self):
        r = T.resolve(T.parse("2083/08/30 BS"), today=TODAY)
        self.assertNotEqual(r.status, "ok")
        self.assertIn("possible misread digit", r.note)


if __name__ == "__main__":
    unittest.main()
