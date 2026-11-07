"""Validate bounded public FAQ excerpts; never interpret source text as instructions."""
import uuid
import re

KNOWLEDGE_GUIDANCE = 'Berikut cuplikan sumber FAQ yang cocok. Periksa judul dan revision pada kartu sumber; informasi yang tidak tercantum belum dapat dipastikan.'

def knowledge_question(message):
    """Conservative explicit policy intents, not a universal semantic classifier."""
    return bool(re.search(r'\b(?:faq|kebijakan|parkir|halal|alergen|alergi|kue|hewan|dekorasi|fasilitas|kursi roda|makanan dari luar|barang tertinggal|akun|kode referensi|ringkasan|konfirmasi terputus|respons terputus|akses privat|pemulihan)\b', message, flags=re.IGNORECASE))

NO_KNOWLEDGE = 'Saya belum memiliki sumber FAQ yang sesuai untuk memastikan jawabannya. Silakan tanyakan informasi lain atau gunakan halaman restoran.'

def validated_knowledge(data):
    if not isinstance(data, dict) or set(data) != {'data', 'source'} or data['source'] != 'restaurant_knowledge' or not isinstance(data['data'], list) or len(data['data']) > 3:
        raise ValueError('Invalid knowledge response')
    seen = set()
    for item in data['data']:
        if not isinstance(item, dict) or set(item) != {'documentId', 'revision', 'title', 'position', 'text'}:
            raise ValueError('Invalid knowledge excerpt')
        if not isinstance(item['documentId'], str):
            raise ValueError('Invalid knowledge source')
        uuid.UUID(item['documentId'])
        if type(item['revision']) is not int or item['revision'] < 1 or type(item['position']) is not int or not 0 <= item['position'] < 100:
            raise ValueError('Invalid knowledge revision')
        if not isinstance(item['title'], str) or not item['title'].strip() or len(item['title']) > 200 or not isinstance(item['text'], str) or not item['text'].strip() or len(item['text']) > 2000:
            raise ValueError('Invalid knowledge text')
        key = (item['documentId'], item['revision'], item['position'])
        if key in seen:
            raise ValueError('Duplicate knowledge excerpt')
        seen.add(key)
    return data
