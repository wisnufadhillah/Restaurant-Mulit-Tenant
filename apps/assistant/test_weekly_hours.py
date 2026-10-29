import unittest
from pydantic import ValidationError
from restaurant_schema import WeeklyHourInfo, TodayHourInfo


class WeeklyHoursTest(unittest.TestCase):
    def test_today_schedule_distinguishes_closed_and_unconfigured(self):
        for configured, source in [(True, 'special'), (True, 'weekly'), (False, 'unconfigured')]:
            row = TodayHourInfo(date='2026-10-30', timezone='Asia/Jakarta', configured=configured, source=source, openMinute=None, closeMinute=None)
            self.assertEqual(row.configured, configured)
        with self.assertRaises(ValidationError):
            TodayHourInfo(date='2026-10-30', timezone='Asia/Jakarta', configured=False, source='weekly', openMinute=None, closeMinute=None)

    def test_regular_open_closed_and_midnight_intervals(self):
        for opening, closing in [(600, 1320), (None, None), (0, 1440)]:
            row = WeeklyHourInfo(weekday=1, openMinute=opening, closeMinute=closing)
            self.assertEqual(row.openMinute, opening)

    def test_rejects_incomplete_reversed_and_out_of_range_intervals(self):
        for day, opening, closing in [(7, 600, 1320), (1, None, 1320), (1, 600, None), (1, 600, 600), (1, 700, 600), (1, -1, 600), (1, 0, 1441)]:
            with self.subTest(day=day, opening=opening, closing=closing):
                with self.assertRaises(ValidationError):
                    WeeklyHourInfo(weekday=day, openMinute=opening, closeMinute=closing)
