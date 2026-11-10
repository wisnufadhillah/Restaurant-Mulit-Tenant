import json
from pathlib import Path
import secrets
import sys
import unittest

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent))
from app.main import app
from app.schemas import GatewayRequest
from app.main import run_gateway
from agent_factory import ModelSettings

MODEL = 'example/demo:free'
SETTINGS = ModelSettings(MODEL, (MODEL,), secrets.token_urlsafe(32))


def completion(message):
    return httpx.Response(200, json={
        'id': 'synthetic', 'object': 'chat.completion', 'created': 1, 'model': MODEL,
        'choices': [{'index': 0, 'message': message, 'finish_reason': 'tool_calls' if message.get('tool_calls') else 'stop'}],
    })


class GatewayTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        from dataclasses import replace
        from unittest.mock import patch
        from app.backend import settings
        self.patch = patch('app.backend.settings', replace(settings, internal_service_token=secrets.token_urlsafe(32)))
        self.patch.start()
        self.addCleanup(self.patch.stop)

    def request(self, message='Harga rendang?'):
        return GatewayRequest(message=message, tenantSlug='demo-padang', sessionId='synthetic-session', context='synthetic-context')

    async def test_answer_without_tool_evidence_abstains(self):
        result = await run_gateway(self.request(), model_settings=SETTINGS,
            model_transport=httpx.MockTransport(lambda _: completion({'role': 'assistant', 'content': 'Rendang Rp99.000, buka 24 jam.'})))
        self.assertNotIn('99.000', result['message'])
        self.assertEqual(result['attempted_requests'], 1)
        self.assertEqual(result['cards'], [])

    async def test_http_contract_auth_invalid_payload_and_production_routes(self):
        from app.config import settings
        from dataclasses import replace
        from unittest.mock import patch
        key = secrets.token_urlsafe(32)
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url='http://test') as client:
            with patch('app.main.settings', replace(settings, service_api_key=key)):
                self.assertEqual((await client.get('/health')).status_code, 200)
                self.assertEqual((await client.post('/turn', json=self.request().model_dump())).status_code, 401)
                headers = {'x-assistant-service-token': key}
                response = await client.post('/turn', json={**self.request().model_dump(), 'tenantId': 'other'}, headers=headers)
                self.assertEqual(response.status_code, 422)
                response = await client.post('/turn', json=self.request('Halo!').model_dump(), headers=headers)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()['attempted_requests'], 0)
                for path in ['/playground', '/api/playground/runs', '/api/playground/scenarios']:
                    self.assertEqual((await client.get(path)).status_code, 404)
                self.assertEqual((await client.post('/api/playground/chat', json={'message': 'Halo'})).status_code, 404)

    async def test_menu_from_tool_survives_but_invented_price_does_not(self):
        calls = []
        def model(request):
            calls.append(json.loads(request.content))
            if len(calls) == 1:
                return completion({'role': 'assistant', 'content': None, 'tool_calls': [{'id': 'menu', 'type': 'function', 'function': {'name': 'search_menu', 'arguments': '{}'}}]})
            return completion({'role': 'assistant', 'content': 'Rendang Rp99.000.'})
        def api(request):
            self.assertEqual(request.url.path, '/api/v1/internal/tenants/demo-padang/menu')
            return httpx.Response(200, json={'data': [{'id': 'demo', 'name': 'Rendang', 'description': 'Demo', 'price': 35000, 'isAvailable': True}], 'source': 'restaurant_api'})
        result = await run_gateway(self.request(), model_settings=SETTINGS, model_transport=httpx.MockTransport(model), api_transport=httpx.MockTransport(api))
        self.assertEqual(result['status'], 'ok')
        self.assertIn('35.000', result['message'])
        self.assertNotIn('99.000', result['message'])
        self.assertEqual(result['attempted_requests'], 2)
        self.assertEqual(result['actions'][0]['target'], '#menu')

    async def test_empty_knowledge_abstains_without_inference(self):
        def forbidden(_):
            self.fail('Empty policy evidence must not invoke model')
        result = await run_gateway(self.request('Boleh membawa kue?'), model_settings=SETTINGS,
            model_transport=httpx.MockTransport(forbidden),
            api_transport=httpx.MockTransport(lambda _: httpx.Response(200, json={'data': [], 'source': 'restaurant_knowledge'})))
        self.assertIn('belum memiliki sumber FAQ', result['message'])
        self.assertEqual(result['attempted_requests'], 0)

    async def test_provider_failure_reports_real_attempt(self):
        for status, category in [(429, 'rate_limited'), (402, 'credit_or_quota'), (503, 'upstream_error')]:
            result = await run_gateway(self.request(), model_settings=SETTINGS,
                model_transport=httpx.MockTransport(lambda _: httpx.Response(status, json={'error': {'message': 'synthetic'}})))
            self.assertEqual(result['status'], 'unavailable')
            self.assertEqual(result['attempted_requests'], 1)
            self.assertIn(category, [event['category'] for event in result['diagnostics']])
            self.assertTrue(result['actions'])

    async def test_model_timeout_and_invalid_tool_fall_back(self):
        def timeout(request):
            raise httpx.ReadTimeout('Synthetic timeout', request=request)
        result = await run_gateway(self.request(), model_settings=SETTINGS, model_transport=httpx.MockTransport(timeout))
        self.assertEqual(result['status'], 'unavailable')
        self.assertEqual(result['attempted_requests'], 1)
        self.assertIn('timeout', [event['category'] for event in result['diagnostics']])
        def invalid(_):
            return completion({'role': 'assistant', 'content': None, 'tool_calls': [{'id': 'write', 'type': 'function', 'function': {'name': 'cancel_reservation', 'arguments': '{}'}}]})
        result = await run_gateway(self.request(), model_settings=SETTINGS, model_transport=httpx.MockTransport(invalid))
        self.assertEqual(result['cards'], [])
        self.assertNotIn('berhasil', result['message'])
        self.assertLessEqual(result['attempted_requests'], 3)

    async def test_configuration_rejects_paid_models_and_custom_endpoints(self):
        from dataclasses import replace
        from unittest.mock import patch
        from app.config import settings, validate_model_settings
        base = replace(settings, model_api_key=secrets.token_urlsafe(32), model_id=MODEL,
            allowed_models=(MODEL,), model_base_url='https://openrouter.ai/api/v1')
        for bad in [replace(base, model_base_url='https://other.example/api'), replace(base, model_id='example/paid'),
                    replace(base, allowed_models=(MODEL, 'example/paid'))]:
            with patch('app.config.settings', bad):
                with self.assertRaises(RuntimeError):
                    validate_model_settings()

    async def test_playground_is_mock_only_and_bounded(self):
        from app.playground_server import app as simulator
        from app.playground import store
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=simulator), base_url='http://test') as client:
            response = await client.post('/api/playground/chat', json={'message': 'Menu sintetis?'})
            self.assertEqual(response.status_code, 200)
            self.assertIn('tanpa inference', response.json()['response'])
            self.assertEqual((await client.post('/api/playground/chat', json={'message': 'x' * 2001})).status_code, 422)
            for _ in range(110):
                store.create('Synthetic run')
            self.assertEqual(len(store.list()), 100)
            store.runs.clear()

    async def test_inference_loop_stops_at_three_requests(self):
        calls = []
        def model(_):
            calls.append(True)
            return completion({'role': 'assistant', 'content': None, 'tool_calls': [{'id': f'menu-{len(calls)}', 'type': 'function', 'function': {'name': 'search_menu', 'arguments': '{}'}}]})
        result = await run_gateway(self.request(), model_settings=SETTINGS, model_transport=httpx.MockTransport(model),
            api_transport=httpx.MockTransport(lambda _: httpx.Response(200, json={'data': [], 'source': 'restaurant_api'})))
        self.assertEqual(len(calls), 3)
        self.assertEqual(result['attempted_requests'], 3)
        self.assertNotEqual(result['status'], 'ok')
        self.assertIn('budget_exhausted', [event['category'] for event in result['diagnostics']])


if __name__ == '__main__':
    unittest.main()
