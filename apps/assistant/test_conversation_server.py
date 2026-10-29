import unittest
import json
import os
import secrets
import threading
import urllib.request
import urllib.error
from unittest.mock import patch, AsyncMock
from http.server import ThreadingHTTPServer
from agent_factory import ModelSettings
from conversation_server import validate_turn, ConversationHandler

class ConversationServerTest(unittest.TestCase):
    def test_real_http_service_authentication_and_bound_turn(self):
        secret = secrets.token_urlsafe(32)
        server = ThreadingHTTPServer(('127.0.0.1', 0), ConversationHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        body = {'message': 'Menu?', 'tenantSlug': 'demo-padang', 'sessionId': 'synthetic-session', 'context': 'synthetic-context'}
        result = {'status': 'ok', 'message': 'Menu dari tool', 'cards': [], 'attempted_requests': 2}
        runner = AsyncMock(return_value=result)
        try:
            with patch.dict(os.environ, {'ASSISTANT_GATEWAY_TOKEN': secret, 'INTERNAL_TOOL_SERVICE_TOKEN': secrets.token_urlsafe(32)}), patch('conversation_server.load_model_settings', return_value=ModelSettings('example/demo:free', ('example/demo:free',), 'synthetic-test-value')), patch('conversation_server.run_conversation', runner):
                url = f'http://127.0.0.1:{server.server_port}/turn'
                def request(token):
                    return urllib.request.Request(url, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json', 'x-assistant-service-token': token}, method='POST')
                with self.assertRaises(urllib.error.HTTPError) as error:
                    urllib.request.urlopen(request('invalid'), timeout=3)
                self.assertEqual(error.exception.code, 401)
                with urllib.request.urlopen(request(secret), timeout=3) as response:
                    self.assertEqual(response.status, 200)
                    self.assertEqual(json.load(response), result)
                self.assertEqual(runner.await_count, 1)
                self.assertEqual(runner.call_args.args[2], 'demo-padang')
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=3)

    def test_turn_accepts_only_bound_context_and_bounded_message(self):
        body = {'message': 'Menu?', 'tenantSlug': 'demo-padang', 'sessionId': 'synthetic-session', 'context': 'synthetic-context'}
        self.assertEqual(validate_turn(body), body)
        for change in [{'message': ''}, {'message': 'x' * 2001}, {'tenantSlug': '../other'}, {'context': ''}, {'sql': 'not allowed'}]:
            with self.assertRaises(ValueError):
                validate_turn({**body, **change})
