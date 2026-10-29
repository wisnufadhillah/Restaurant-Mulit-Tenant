"""Plain-text presentation and narrow, local conversational replies."""
import re


def greeting_reply(message: str) -> str | None:
    greeting = re.sub(r'[.!?,\s]+$', '', message.casefold().strip())
    if greeting in {'halo', 'hai', 'hi', 'hello', 'helo', 'pagi', 'siang', 'sore', 'malam', 'selamat pagi', 'selamat siang', 'selamat sore', 'selamat malam'}:
        return 'Halo! Ada yang bisa dibantu?'
    return None


def plain_text_reply(message: str) -> str:
    """Remove presentation markers without removing hyphens inside prose."""
    message = re.sub(r'(?m)^[ \t]{0,3}(?:#{1,6}[ \t]+|[-*+•][ \t]+|\d+[.)][ \t]+)', '', message)
    message = message.replace('*', '')
    message = re.sub(r'`([^`\n]+)`', r'\1', message)
    message = re.sub(r'^\s*(?:halo|hai|hello)[!,.]\s*', '', message, flags=re.IGNORECASE)
    message = re.sub(r'\s+di sistem\b', '', message, flags=re.IGNORECASE)
    return message.strip()
