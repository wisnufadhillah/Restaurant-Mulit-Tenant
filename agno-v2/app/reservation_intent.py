from datetime import date, datetime, timedelta
import re
from zoneinfo import ZoneInfo

MONTHS = {
    'januari': 1, 'februari': 2, 'maret': 3, 'april': 4, 'mei': 5, 'juni': 6,
    'juli': 7, 'agustus': 8, 'september': 9, 'oktober': 10, 'november': 11, 'desember': 12,
}


def parse_reservation_intent(message: str, *, today: date | None = None) -> dict[str, object] | None:
    text = message.casefold()
    if not re.search(r'\b(?:reservasi|booking|pesan meja)\b', text):
        return None
    iso = re.search(r'\b(20\d{2}-\d{2}-\d{2})\b', text)
    numeric = re.search(r'\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b', text)
    named = re.search(r'\b(\d{1,2})\s+(' + '|'.join(MONTHS) + r')\s+(20\d{2})\b', text)
    if iso or numeric or named:
        try:
            if iso:
                visit_date = date.fromisoformat(iso.group(1))
            elif numeric:
                visit_date = date(int(numeric.group(3)), int(numeric.group(2)), int(numeric.group(1)))
            else:
                visit_date = date(int(named.group(3)), MONTHS[named.group(2)], int(named.group(1)))
        except ValueError:
            return None
    elif re.search(r'\bbesok\b', text):
        if today is None:
            today = datetime.now(ZoneInfo('Asia/Jakarta')).date()
        visit_date = today + timedelta(days=1)
    elif re.search(r'\blusa\b', text):
        if today is None:
            today = datetime.now(ZoneInfo('Asia/Jakarta')).date()
        visit_date = today + timedelta(days=2)
    else:
        return None
    clock = re.search(r'\b(?:jam|pukul)\s*(\d{1,2})(?:[:.]([0-5]\d))?\s*(pagi|siang|sore|malam|am|pm)?\b', text)
    party = re.search(r'\b(\d{1,2})\s*(?:orang|tamu|pax)\b', text)
    if not clock or not party:
        return None
    hour, minute = int(clock.group(1)), int(clock.group(2) or '00')
    period = clock.group(3)
    if period in ('am', 'pm'):
        if hour < 1 or hour > 12:
            return None
        if period == 'pm' and hour < 12:
            hour += 12
        if period == 'am' and hour == 12:
            hour = 0
    elif period in ('siang', 'sore', 'malam') and hour < 12:
        hour += 12
    if hour > 23:
        return None
    party_size = int(party.group(1))
    if not 1 <= party_size <= 12:
        return None
    return {'date': visit_date.isoformat(), 'time': f'{hour:02d}:{minute:02d}', 'partySize': party_size}
