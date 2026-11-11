import unittest
from datetime import date

from app.reservation_intent import parse_reservation_intent
from app.main import build_actions


class ReservationIntentTests(unittest.TestCase):
    def test_parses_non_private_details_for_form_prefill(self):
        self.assertEqual(parse_reservation_intent('Saya mau reservasi 4 orang besok jam 19.30', today=date(2026, 11, 10)), {
            'date': '2026-11-11', 'time': '19:30', 'partySize': 4,
        })
        self.assertEqual(parse_reservation_intent('booking 2 tamu lusa pukul 7 malam', today=date(2026, 11, 10)), {
            'date': '2026-11-12', 'time': '19:00', 'partySize': 2,
        })

    def test_requires_complete_safe_details(self):
        for message in ['Mau reservasi', 'booking besok jam 19.00', 'reservasi 13 orang besok jam 19.00', 'reservasi 2 orang tanggal 2026-02-30 jam 19.00']:
            with self.subTest(message=message):
                self.assertIsNone(parse_reservation_intent(message, today=date(2026, 11, 10)))

    def test_unavailable_slot_does_not_prefill_reservation(self):
        actions = build_actions('Reservasi 2 orang 2026-11-11 jam 19.00', [{
            'type': 'availability', 'data': {'available': False},
        }], 'ok')
        self.assertEqual(actions, [{
            'id': 'reservation-form', 'type': 'navigate', 'label': 'Buka form reservasi', 'target': '#reservasi',
        }])


if __name__ == '__main__':
    unittest.main()
