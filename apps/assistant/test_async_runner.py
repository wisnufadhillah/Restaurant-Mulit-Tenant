import asyncio
import json
import unittest
from unittest.mock import patch
import httpx
from agent_factory import ModelSettings
from async_runner import run_simulated
from execution_gateway import FALLBACK

MODEL = 'example/demo:free'
SETTINGS = ModelSettings(MODEL, (MODEL,), 'synthetic-test-value')


def model_response(tool=False):
    message = {'role': 'assistant', 'content': 'Nama restoran Demo.'}
    if tool:
        message = {'role': 'assistant', 'content': None, 'tool_calls': [{'id': 'call_demo', 'type': 'function', 'function': {'name': 'get_restaurant_info', 'arguments': '{}'}}]}
    return httpx.Response(200, json={'id': 'synthetic', 'object': 'chat.completion', 'created': 1, 'model': MODEL, 'choices': [{'index': 0, 'message': message, 'finish_reason': 'tool_calls' if tool else 'stop'}]})


def catalogue(request):
    return httpx.Response(200, json={'data': {'slug': 'demo-padang', 'name': 'Demo', 'outlets': []}, 'source': 'restaurant_api', 'retrieved_at': '2026-10-27T00:00:00Z'})


class AsyncRunnerTest(unittest.IsolatedAsyncioTestCase):
    async def test_complete_loop_counts_both_requests(self):
        calls = []
        async def model(request):
            calls.append(json.loads(request.content))
            return model_response(tool=len(calls) == 1)
        with patch('socket.socket.connect', side_effect=AssertionError('Network forbidden')):
            result = await run_simulated('Nama restoran?', SETTINGS, 'demo-padang', httpx.MockTransport(model), httpx.MockTransport(catalogue))
        self.assertEqual(result.status, 'ok')
        self.assertEqual(result.attempted_requests, 2)
        self.assertTrue(any(m['role'] == 'tool' for m in calls[1]['messages']))

    async def test_budget_failure_in_agno_is_safe_and_does_not_forward(self):
        calls = []
        async def model(request):
            calls.append(True)
            return model_response(tool=True)
        result = await run_simulated('Info?', SETTINGS, 'demo-padang', httpx.MockTransport(model), httpx.MockTransport(catalogue), request_limit=1)
        self.assertEqual(len(calls), 1)
        self.assertEqual(result.attempted_requests, 1)
        self.assertNotEqual(result.status, 'ok')
        self.assertEqual(result.message, FALLBACK)

    async def test_deadline_cancels_async_catalogue(self):
        cancelled = []
        async def model(request):
            return model_response(tool=True)
        async def slow_catalogue(request):
            try:
                await asyncio.sleep(60)
            finally:
                cancelled.append(True)
            return catalogue(request)
        result = await run_simulated('Info?', SETTINGS, 'demo-padang', httpx.MockTransport(model), httpx.MockTransport(slow_catalogue), timeout_seconds=0.1)
        self.assertEqual(result.status, 'timeout')
        self.assertEqual(cancelled, [True])
        self.assertEqual(result.message, FALLBACK)

    async def test_tool_failure_cannot_be_replaced_by_model_claim(self):
        calls = []
        async def model(request):
            calls.append(True)
            return model_response(tool=len(calls) == 1)
        result = await run_simulated('Info?', SETTINGS, 'demo-padang', httpx.MockTransport(model), httpx.MockTransport(lambda request: httpx.Response(503)))
        self.assertNotEqual(result.status, 'ok')
        self.assertEqual(result.message, FALLBACK)


    async def test_provider_http_failure_is_not_reported_as_success(self):
        calls = []
        async def failing_model(request):
            calls.append(True)
            return httpx.Response(429, json={'error': {'message': 'synthetic rate limit', 'type': 'rate_limit_error'}})
        result = await run_simulated('Info?', SETTINGS, 'demo-padang', httpx.MockTransport(failing_model), httpx.MockTransport(catalogue))
        self.assertEqual(len(calls), 1)
        self.assertEqual(result.attempted_requests, 1)
        self.assertNotEqual(result.status, 'ok')
        self.assertEqual(result.message, FALLBACK)

    async def test_model_deadline_cancels_pending_request(self):
        cancelled = []
        async def slow_model(request):
            try:
                await asyncio.sleep(60)
            finally:
                cancelled.append(True)
            return model_response()
        result = await run_simulated('Info?', SETTINGS, 'demo-padang', httpx.MockTransport(slow_model), httpx.MockTransport(catalogue), timeout_seconds=0.1)
        self.assertEqual(result.status, 'timeout')
        self.assertEqual(cancelled, [True])
        self.assertEqual(result.message, FALLBACK)

if __name__ == '__main__':
    unittest.main()
