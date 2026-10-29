"""Loopback-only authenticated conversation service; never logs requests or SDK output."""
import asyncio
import contextlib
import hmac
import io
import json
import logging
import os
import re
from dotenv import load_dotenv
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from private_config import load_model_settings
from conversation_runner import run_conversation

_LOCK = threading.Lock()
FALLBACK = {'status': 'unavailable', 'message': 'Asisten belum tersedia. Silakan gunakan halaman restoran.', 'cards': [], 'attempted_requests': 0}


def validate_turn(body):
    if not isinstance(body, dict) or set(body) != {'message', 'tenantSlug', 'sessionId', 'context'}:
        raise ValueError('Invalid turn')
    if not isinstance(body['message'], str) or not 1 <= len(body['message']) <= 2000:
        raise ValueError('Invalid message')
    if not isinstance(body['tenantSlug'], str) or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', body['tenantSlug']) or len(body['tenantSlug']) > 80:
        raise ValueError('Invalid tenant')
    if any(not isinstance(body[k], str) or not body[k] or len(body[k]) > limit for k, limit in [('sessionId', 128), ('context', 4096)]):
        raise ValueError('Invalid context')
    return body


class ConversationHandler(BaseHTTPRequestHandler):
    def reply(self, status, body):
        data = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        self.reply(200 if self.path == '/health' else 404, {'service': 'restaurant-conversation', 'model_ready': False})

    def do_POST(self):
        if self.path != '/turn':
            return self.reply(404, FALLBACK)
        secret = os.environ.get('ASSISTANT_GATEWAY_TOKEN', '')
        supplied = self.headers.get('x-assistant-service-token', '')
        if len(secret) < 32 or len(supplied) > 1024 or not hmac.compare_digest(secret, supplied):
            return self.reply(401, FALLBACK)
        if not _LOCK.acquire(blocking=False):
            return self.reply(429, FALLBACK)
        try:
            self.connection.settimeout(5)
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 16384 or self.headers.get_content_type() != 'application/json':
                return self.reply(400, FALLBACK)
            body = validate_turn(json.loads(self.rfile.read(length)))
            service = os.environ.get('INTERNAL_TOOL_SERVICE_TOKEN', '')
            if len(service) < 32:
                return self.reply(503, FALLBACK)
            settings = load_model_settings(Path(__file__).resolve().parent / '.env', os.environ)
            headers = {'x-internal-service-token': service, 'x-internal-context': body['context'], 'x-session-id': body['sessionId']}
            # SDK error messages may contain request/provider data; never emit them in this server.
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                result = asyncio.run(run_conversation(body['message'], settings, body['tenantSlug'], headers))
            self.reply(200, result)
        except (ValueError, TypeError, json.JSONDecodeError):
            self.reply(400, FALLBACK)
        except Exception:
            self.reply(503, FALLBACK)
        finally:
            _LOCK.release()

    def log_message(self, *_args):
        pass


if __name__ == '__main__':
    load_dotenv(Path(__file__).resolve().parent / '.env', override=False, interpolate=False)
    logging.disable(logging.CRITICAL)
    ThreadingHTTPServer(('127.0.0.1', 8001), ConversationHandler).serve_forever()
