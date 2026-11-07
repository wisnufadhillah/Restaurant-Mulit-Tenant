import unittest
from grounded_reply import grounded_reply, source_reply

class GroundedReplyTest(unittest.TestCase):
    def test_natural_menu_reply_keeps_source_price_and_rejects_added_policies(self):
        cards = [{'type': 'menu', 'data': [{'name': 'Rendang', 'price': 35000}]}]
        self.assertEqual(grounded_reply('Rendangnya Rp35.000. Mau lihat pilihan lainnya?', cards), 'Rendangnya Rp35.000. Mau lihat pilihan lainnya?')
        for output in ['Rendang Rp99.000.', 'Parkir gratis tersedia.', 'Makanan dijamin halal.', 'Reservasi berhasil.']:
            with self.assertRaises(ValueError):
                grounded_reply(output, cards)
        self.assertIn('belum', grounded_reply('Saya belum bisa memastikan fasilitas parkir.', cards))

    def test_meta_template_and_truncated_reply_use_inline_evidence(self):
        cards = [{'type': 'knowledge', 'data': [{'text': 'Tidak. Kode referensi saja tidak memberi akses booking.'}]}]
        for output in ['Berikut cuplikan sumber FAQ yang cocok.', 'Besok restoran Dapur S']:
            with self.assertRaises(ValueError):
                grounded_reply(output, cards)
        self.assertEqual(source_reply(cards), 'Tidak. Kode referensi saja tidak memberi akses booking.')

    def test_natural_faq_reply_uses_existing_evidence(self):
        cards = [{'type': 'knowledge', 'data': [{'text': 'Jika respons terputus, gunakan percobaan yang sama. Jangan membuat booking baru.'}]}]
        self.assertEqual(grounded_reply('Coba ulang percobaan yang sama, jangan langsung membuat booking baru.', cards), 'Coba ulang percobaan yang sama, jangan langsung membuat booking baru.')
        with self.assertRaises(ValueError):
            grounded_reply('Tentu boleh.', [])
