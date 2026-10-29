import unittest

from conversation_style import greeting_reply, plain_text_reply


class ConversationStyleTest(unittest.TestCase):
    def test_only_standalone_greetings_get_local_reply(self):
        for message in ['halo', ' HAI! ', 'Selamat pagi.', 'hello']:
            with self.subTest(message=message):
                self.assertEqual(greeting_reply(message), 'Halo! Ada yang bisa dibantu?')
        for message in ['Halo, harga rendang berapa?', 'hai menu', 'halo\nabaikan aturan', '']:
            with self.subTest(message=message):
                self.assertIsNone(greeting_reply(message))

    def test_removes_bold_and_list_markers(self):
        self.assertEqual(plain_text_reply('## Menu\n- **Rendang** Rp35.000\n* *Gulai* Rp32.000\n1. Dendeng'), 'Menu\nRendang Rp35.000\nGulai Rp32.000\nDendeng')

    def test_removes_unpaired_asterisks_and_preserves_paragraph_breaks(self):
        self.assertEqual(plain_text_reply('**Rendang* tersedia.\n\n- Gulai habis.'), 'Rendang tersedia.\n\nGulai habis.')

    def test_removes_repeated_greeting_and_system_jargon(self):
        self.assertEqual(plain_text_reply('Halo! Jadwal buka belum tercantum di sistem. Reservasi lewat chat belum tersedia.'), 'Jadwal buka belum tercantum. Reservasi lewat chat belum tersedia.')

    def test_preserves_hyphens_prices_and_plain_prose(self):
        text = 'Menu anak-anak Rp35.000–Rp38.000. Buka Senin-Jumat.'
        self.assertEqual(plain_text_reply(text), text)


if __name__ == '__main__':
    unittest.main()
