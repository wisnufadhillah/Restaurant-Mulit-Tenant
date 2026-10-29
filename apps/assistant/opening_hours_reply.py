"""Conservative routing and factual wording for today's opening-hours questions."""
import re


def hours_question(message: str) -> bool:
    """Only bypass the model when the entire question has supported vocabulary."""
    text = message.casefold()
    if re.search(r'\b(besok|lusa|senin|selasa|rabu|kamis|jumat|sabtu|minggu|tanggal|kemarin|sekarang)\b|\d', text):
        return False
    if not re.search(r'\b(?:jam|pukul)\b', text) or not re.search(r'\b(?:buka|tutup|operasional)\b', text):
        return False
    # Unknown terms keep the request on the general agent path rather than lose an intent.
    allowed = set('halo hai hello info informasi restoran restaurant rumah makan ini di sini hari jam pukul buka bukanya tutup tutupnya operasional berapa kapan ya yah dong tolong boleh tahu mau tanya dan lalu untuk soalnya karena aku saya ingin reservasi tempat apakah bisa booking pesan meja itu kalau'.split())
    return all(word in allowed for word in re.findall(r'\w+', text))


def today_hours_reply(profile: dict, *, wants_reservation: bool = False) -> str:
    outlets = profile['data']['outlets']
    if len(outlets) != 1:
        answer = 'Jam buka hari ini belum bisa dipastikan untuk lokasi yang dimaksud.'
    else:
        today = outlets[0].get('todayHours')
        if not today or not today['configured']:
            answer = 'Jam buka hari ini belum tersedia.'
        elif today['openMinute'] is None:
            answer = 'Hari ini restoran tutup.'
        else:
            def clock(minutes):
                return f'{minutes // 60:02d}.{minutes % 60:02d}'
            answer = f"Hari ini restoran buka pukul {clock(today['openMinute'])}–{clock(today['closeMinute'])} WIB."
    if wants_reservation:
        answer += ' Reservasi lewat chat belum bisa dilakukan.'
    return answer


def asks_reservation(message: str) -> bool:
    return bool(re.search(r'\b(?:reservasi|booking|pesan meja)\b', message, flags=re.IGNORECASE))
