import json
import tempfile
from pathlib import Path
import unittest
from unittest.mock import patch

import httpx
from agent_factory import ModelSettings, create_restaurant_agent
from execution_gateway import RequestBudget, BudgetExceeded
from model_transport import BudgetTransport
from private_config import load_model_settings

MODEL = 'example/demo:free'


class TransportTest(unittest.IsolatedAsyncioTestCase):
    async def test_budget_blocks_before_fourth_transport_request(self):
        seen = []
        async def handler(request):
            seen.append(True)
            return httpx.Response(200, json={})
        budget = RequestBudget(3)
        async with httpx.AsyncClient(transport=BudgetTransport(httpx.MockTransport(handler), budget, MODEL), trust_env=False) as client:
            for _ in range(3):
                await client.post('https://openrouter.ai/api/v1/chat/completions', json={'model': MODEL})
            with self.assertRaises(BudgetExceeded):
                await client.post('https://openrouter.ai/api/v1/chat/completions', json={'model': MODEL})
        self.assertEqual(len(seen), 3)
        self.assertEqual(budget.used, 3)

    async def test_real_agno_loop_uses_tool_then_synthetic_final_response(self):
        requests = []
        tool_calls = []
        def get_restaurant_info() -> dict:
            """Read synthetic public restaurant info."""
            tool_calls.append(True)
            return {'name': 'Restoran Demo'}
        async def handler(request):
            body = json.loads(request.content)
            requests.append(body)
            if len(requests) == 1:
                message = {'role': 'assistant', 'content': None, 'tool_calls': [{'id': 'call_demo', 'type': 'function', 'function': {'name': 'get_restaurant_info', 'arguments': '{}'}}]}
                reason = 'tool_calls'
            else:
                message = {'role': 'assistant', 'content': 'Nama restoran adalah Restoran Demo.'}
                reason = 'stop'
            return httpx.Response(200, json={'id': 'synthetic-response', 'object': 'chat.completion', 'created': 1, 'model': MODEL, 'choices': [{'index': 0, 'message': message, 'finish_reason': reason}], 'usage': {'prompt_tokens': 10, 'completion_tokens': 10, 'total_tokens': 20}})
        budget = RequestBudget()
        async with httpx.AsyncClient(transport=BudgetTransport(httpx.MockTransport(handler), budget, MODEL), trust_env=False) as client:
            config = ModelSettings(MODEL, (MODEL,), 'synthetic-test-value')
            agent = create_restaurant_agent(config, 'http://127.0.0.1:3001', 'demo-padang', http_client=client, restaurant_tool=get_restaurant_info)
            with patch('socket.socket.connect', side_effect=AssertionError('Network forbidden')):
                output = await agent.arun('Apa nama restoran?')
            await agent.model.get_async_client().close()
        self.assertEqual(output.content, 'Nama restoran adalah Restoran Demo.')
        self.assertEqual(len(tool_calls), 1)
        self.assertEqual(budget.used, 2)
        self.assertEqual(len(requests), 2)
        self.assertTrue(any(message['role'] == 'tool' for message in requests[1]['messages']))

    async def test_rejects_routing_or_paid_request_without_forwarding(self):
        def handler(request):
            self.fail('Invalid request forwarded')
        budget = RequestBudget()
        async with httpx.AsyncClient(transport=BudgetTransport(httpx.MockTransport(handler), budget, MODEL), trust_env=False) as client:
            for payload in [{'model': 'example/paid'}, {'model': MODEL, 'models': ['example/paid']}, {'model': MODEL, 'plugins': []}]:
                with self.assertRaises(ValueError):
                    await client.post('https://openrouter.ai/api/v1/chat/completions', json=payload)
        self.assertEqual(budget.used, 0)


    async def test_diagnostics_store_only_allowlisted_metadata(self):
        for status, category in [(200, 'ok'), (400, 'invalid_request'), (401, 'authentication'), (402, 'credit_or_quota'), (403, 'access_denied'), (404, 'endpoint_or_model_missing'), (429, 'rate_limited'), (503, 'upstream_error'), (302, 'redirect_rejected')]:
            async def handler(request):
                return httpx.Response(status, headers={'x-private': 'synthetic-sensitive-header'}, json={'error': {'message': 'synthetic-sensitive-body'}})
            transport = BudgetTransport(httpx.MockTransport(handler), RequestBudget(), MODEL)
            async with httpx.AsyncClient(transport=transport, trust_env=False) as client:
                await client.post('https://openrouter.ai/api/v1/chat/completions', json={'model': MODEL})
            expected = {'attempt': 1, 'http_status': status, 'category': category}
            if status >= 400:
                expected['limit_scope'] = 'unknown'
            self.assertEqual(transport.events, [expected])
            self.assertNotIn('synthetic-sensitive', json.dumps(transport.events))

    async def test_transport_exception_does_not_store_error_message(self):
        async def handler(request):
            raise httpx.ConnectTimeout('synthetic-sensitive-connection')
        transport = BudgetTransport(httpx.MockTransport(handler), RequestBudget(), MODEL)
        async with httpx.AsyncClient(transport=transport, trust_env=False) as client:
            with self.assertRaises(httpx.ConnectTimeout):
                await client.post('https://openrouter.ai/api/v1/chat/completions', json={'model': MODEL})
        self.assertEqual(transport.events, [{'attempt': 1, 'http_status': None, 'category': 'timeout'}])

class ConfigLoaderTest(unittest.TestCase):
    def test_explicit_file_and_environment_precedence(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / '.env'
            path.write_text('OPENROUTER_API_KEY=synthetic-file-value\nOPENROUTER_MODEL=example/old:free\nOPENROUTER_ALLOWED_MODELS=example/demo:free\n', encoding='utf-8')
            config = load_model_settings(path, {'OPENROUTER_MODEL': MODEL})
            self.assertEqual(config.model_id, MODEL)
            self.assertNotIn('synthetic-file-value', repr(config))
        with self.assertRaises(ValueError):
            load_model_settings(Path('.env'), {})


if __name__ == '__main__':
    unittest.main()
