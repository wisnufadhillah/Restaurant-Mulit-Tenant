import unittest
from opening_hours_reply import hours_question, today_hours_reply, reservation_form_request


class OpeningHoursReplyTest(unittest.TestCase):
    def test_supported_questions_and_mixed_reservation(self):
        for message in ['Restoran buka jam berapa?', 'halo. info restaurant buka jam berapa ya, soalnya aku mau reservasi tempat', 'Hari ini tutup pukul berapa?']:
            self.assertTrue(hours_question(message), message)
        for message in ['Besok buka jam berapa?', 'Senin buka jam berapa?', 'Buka jam berapa tanggal 5?', 'Jam buka dan menu apa saja?', 'Jam buka dan parkirnya?', 'Buka sekarang?', 'Halo']:
            self.assertFalse(hours_question(message), message)

    def test_booking_redirect_does_not_swallow_mixed_or_negative_intent(self):
        for message in ['Mau reservasi', 'Saya ingin booking', 'Batalkan booking!']:
            self.assertTrue(reservation_form_request(message))
        for message in ['Tidak mau reservasi', 'Bisa reservasi berapa orang?', 'Mau reservasi dan harga rendang?', 'Jam buka untuk reservasi?', 'Apa aturan reservasi?', 'Reservasi 4 orang besok jam 7', 'untuk reservasi besok jam 10 pagi apakah bisa?']:
            self.assertFalse(reservation_form_request(message))

    def test_answer_uses_only_api_values(self):
        def profile(today):
            return {'data': {'outlets': [{'todayHours': today}]}}
        self.assertEqual(today_hours_reply(profile({'configured': True, 'openMinute': 480, 'closeMinute': 1260})), 'Hari ini restoran buka pukul 08.00–21.00 WIB.')
        self.assertEqual(today_hours_reply(profile({'configured': True, 'openMinute': None, 'closeMinute': None})), 'Hari ini restoran tutup.')
        self.assertEqual(today_hours_reply(profile({'configured': False}), wants_reservation=True), 'Jam buka hari ini belum tersedia. Untuk membuat, melihat atau membatalkan reservasi, gunakan form Reservasi pada website; jangan kirim kontak atau kode akses di chat.')
        self.assertEqual(today_hours_reply(profile(None)), 'Jam buka hari ini belum tersedia.')
