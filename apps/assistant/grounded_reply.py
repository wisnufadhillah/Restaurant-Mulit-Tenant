"""Bounded checks for conversational responses; not a semantic entailment proof."""
import json
import re
from conversation_style import plain_text_reply

# Domain claims needing explicit evidence even if another tool returned unrelated data.
CLAIMS = {
    'halal': r'\bhalal\b',
    'parkir': r'\b(?:parkir|parking)\b',
    'gratis': r'\bgratis\b',
    'alergen': r'\b(?:alergen|alergi)\b',
    'sertifikasi': r'\b(?:sertifikasi|bersertifikat)\b',
    'promo': r'\b(?:promo|diskon)\b',
}

def grounded_reply(output, cards):
    if not isinstance(output, str) or not output.strip() or len(output) > 8000:
        raise ValueError('Invalid assistant reply')
    if re.search(r'berikut cuplikan sumber|periksa judul dan revision|informasi dari sumber restoran pada kartu|buka kartu|lihat kartu', output, re.IGNORECASE):
        raise ValueError('Reply must answer directly')
    if not re.search(r'[.!?…][\"\u201d\u2019]*$', output.strip()):
        raise ValueError('Incomplete assistant reply')
    evidence = json.dumps([card['data'] for card in cards], ensure_ascii=False).casefold()
    if not cards:
        raise ValueError('Missing reply evidence')
    # Source data never authorizes successful transactions or disclosure of secrets.
    if re.search(r'\b(?:booking|reservasi)\s+(?:berhasil|sukses|sudah dikonfirmasi)|(?:system prompt|api key|bearer\s+\S+|-----BEGIN)', output, re.IGNORECASE):
        raise ValueError('Unsupported private or transaction claim')
    for _, pattern in CLAIMS.items():
        for match in re.finditer(pattern, output, re.IGNORECASE):
            # Negative/uncertain statements may name an unknown topic without asserting it.
            sentence = re.split(r'[.!?\n]', output)[len(re.split(r'[.!?\n]', output[:match.start()])) - 1].casefold()
            if not re.search(pattern, evidence) and not re.search(r'belum|tidak (?:tahu|dapat|bisa)|tak dapat', sentence):
                raise ValueError('Unsupported policy claim')
    for amount in re.findall(r'Rp\s*([\d.,]+)', output, re.IGNORECASE):
        digits = amount.replace('.', '').replace(',', '')
        if not digits or digits not in evidence:
            raise ValueError('Unsupported menu price')
    return plain_text_reply(output)


def source_reply(cards):
    """Use existing data without inventing completion when synthesis is unusable."""
    for card in cards:
        if card['type'] == 'availability':
            data = card['data']
            if data['available']:
                return 'Ada slot yang terlihat tersedia pada waktu tersebut. Slot belum ditahan; lanjutkan ke form reservasi untuk memeriksa dan mengonfirmasi.'
            return 'Belum ada meja yang tersedia pada waktu tersebut. Coba pilih waktu lain melalui form reservasi.'
        if card['type'] == 'knowledge' and card['data']:
            return card['data'][0]['text']
    for card in cards:
        if card['type'] == 'menu':
            items = card['data'][:6]
            if not items:
                return 'Belum ada menu aktif yang bisa saya tampilkan.'
            values = [f"{item['name']} Rp{item['price']:,}".replace(',', '.') + (' (habis)' if not item['isAvailable'] else '') for item in items]
            return 'Menu yang tercatat: ' + ', '.join(values) + '.'
        if card['type'] == 'restaurant':
            data = card['data']
            locations = [outlet['address'] for outlet in data.get('outlets', []) if outlet.get('address')]
            return data['name'] + ('. Alamat yang tercatat: ' + '; '.join(locations) if locations else '. Informasi lokasi belum tersedia') + '.'
    return 'Saya belum punya informasi yang cukup untuk memastikan jawabannya.'
