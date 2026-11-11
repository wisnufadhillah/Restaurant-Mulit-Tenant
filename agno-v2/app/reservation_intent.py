from datetime import date, datetime, timedelta
import re
from zoneinfo import ZoneInfo


def parse_reservation_intent(message: str, *, today: date | None = None) -> dict[str, object] | None:
    text = message.casefold()
    if not re.search(r'\b(?:reservasi|booking|pesan meja)\b', text):
        return None
    iso = re.search(r'\b(20\d{2}-\d{2}-\d{2})\b', text)
    if iso:
        try:
            visit_date = date.fromisoformat(iso.group(1))
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
