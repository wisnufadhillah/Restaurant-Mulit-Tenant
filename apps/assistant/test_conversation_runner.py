import json
import unittest
import httpx
from agent_factory import ModelSettings
from conversation_runner import run_conversation

MODEL = 'example/demo:free'
SETTINGS = ModelSettings(MODEL, (MODEL,), 'synthetic-test-value')
HEADERS = {'x-internal-service-token': 'synthetic-service', 'x-internal-context': 'synthetic-context', 'x-session-id': 'synthetic-session'}

class ConversationTest(unittest.IsolatedAsyncioTestCase):
    async def test_model_requests_menu_and_card_uses_validated_tool_data(self):
        calls = []
        def model(request):
            calls.append(json.loads(request.content))
            message = {'role': 'assistant', 'content': 'Rendang Rp35.000.'}
            if len(calls) == 1:
                message = {'role': 'assistant', 'content': None, 'tool_calls': [{'id': 'menu-call', 'type': 'function', 'function': {'name': 'search_menu', 'arguments': '{}'}}]}
            return httpx.Response(200, json={'id': 'synthetic', 'object': 'chat.completion', 'created': 1, 'model': MODEL, 'choices': [{'index': 0, 'message': message, 'finish_reason': 'tool_calls' if len(calls) == 1 else 'stop'}]})
        def api(request):
            self.assertEqual(request.url.path, '/api/v1/internal/tenants/demo-padang/menu')
            self.assertEqual(request.headers['x-session-id'], HEADERS['x-session-id'])
            return httpx.Response(200, json={'data': [{'id': 'synthetic', 'name': 'Rendang', 'description': 'Demo', 'price': 35000, 'isAvailable': True}], 'source': 'restaurant_api'})
        result = await run_conversation('Harga rendang?', SETTINGS, 'demo-padang', HEADERS, model_transport=httpx.MockTransport(model), api_transport=httpx.MockTransport(api))
        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['attempted_requests'], 2)
        self.assertEqual(result['cards'][0]['data'][0]['price'], 35000)
        self.assertNotIn('synthetic-service', json.dumps(calls))

    async def test_rate_limit_returns_fallback_without_cards(self):
        result = await run_conversation('Menu?', SETTINGS, 'demo-padang', HEADERS, model_transport=httpx.MockTransport(lambda request: httpx.Response(429, json={'error': {'message': 'synthetic'}})), api_transport=httpx.MockTransport(lambda request: httpx.Response(503)))
        self.assertNotEqual(result['status'], 'ok')
        self.assertEqual(result['cards'], [])
        self.assertEqual(result['attempted_requests'], 1)
        self.assertTrue(any(event['category'] == 'rate_limited' and event['http_status'] == 429 for event in result['diagnostics']))
        self.assertTrue(all(set(event) <= {'category', 'http_status', 'limit_scope', 'retry_after_seconds', 'rate_limit', 'rate_remaining', 'rate_reset'} for event in result['diagnostics']))
        self.assertTrue(any(event.get('limit_scope') == 'unknown' for event in result['diagnostics']))
