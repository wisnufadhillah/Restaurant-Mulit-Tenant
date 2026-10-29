import json
import unittest
import httpx
from agent_factory import ModelSettings
from conversation_runner import run_conversation

MODEL = 'example/demo:free'
SETTINGS = ModelSettings(MODEL, (MODEL,), 'synthetic-test-value')
HEADERS = {'x-internal-service-token': 'synthetic-service', 'x-internal-context': 'synthetic-context', 'x-session-id': 'synthetic-session'}

class ConversationTest(unittest.IsolatedAsyncioTestCase):
    async def test_greeting_needs_no_model_or_catalogue_request(self):
        def forbidden(request):
            self.fail('Greeting must not call external services')
        result = await run_conversation('Halo!', SETTINGS, 'demo-padang', HEADERS, model_transport=httpx.MockTransport(forbidden), api_transport=httpx.MockTransport(forbidden))
        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['message'], 'Halo! Ada yang bisa dibantu?')
        self.assertEqual(result['attempted_requests'], 0)
        self.assertEqual(result['cards'], [])

    async def test_greeting_with_question_reaches_model_and_formats_plain_text(self):
        calls = []
        def model(request):
            calls.append(json.loads(request.content))
            return httpx.Response(200, json={'id': 'synthetic', 'object': 'chat.completion', 'created': 1, 'model': MODEL, 'choices': [{'index': 0, 'message': {'role': 'assistant', 'content': '- **Informasi** belum tersedia.'}, 'finish_reason': 'stop'}]})
        result = await run_conversation('Halo, jam buka besok?', SETTINGS, 'demo-padang', HEADERS, model_transport=httpx.MockTransport(model))
        self.assertEqual(result['status'], 'ok')
        self.assertEqual(result['message'], 'Informasi belum tersedia.')
        self.assertEqual(result['attempted_requests'], 1)
        system = ' '.join(message['content'] for message in calls[0]['messages'] if message['role'] == 'system')
        self.assertIn('tanpa format Markdown', system)
        self.assertIn('Jangan menawarkan pemesanan makanan', system)
        self.assertIn('langsung jawab tanpa mengulang Halo', system)
        self.assertIn('Jangan menambah aturan cutoff/durasi kecuali ditanya', system)

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

    async def test_profile_tool_exposes_weekly_schedule_and_scoped_locations(self):
        for question in ['Jam buka dan alamatnya?', 'Halo, besok buka?', 'Ada berapa cabang?', 'Alamat dan nomor teleponnya?', 'Bisa reservasi berapa orang?']:
            with self.subTest(question=question):
                calls = []
                outlet = {'name': 'Lokasi demo', 'address': 'Cikini', 'contactPhone': '', 'timezone': 'Asia/Jakarta', 'durationMinutes': 90, 'minNoticeMinutes': 60, 'maxAdvanceDays': 30, 'cancelCutoffMinutes': 120, 'maxPartySize': 12, 'weeklyHours': [{'weekday': 1, 'openMinute': 600, 'closeMinute': 1320}, {'weekday': 0, 'openMinute': None, 'closeMinute': None}]}
                profile = {'data': {'slug': 'demo-padang', 'name': 'Demo', 'outlets': [outlet]}, 'retrieved_at': '2026-10-29T00:00:00Z', 'source': 'restaurant_api'}
                def model(request):
                    calls.append(json.loads(request.content))
                    message = {'role': 'assistant', 'content': 'Jadwal reguler Senin 10.00–22.00 WIB.'}
                    if len(calls) == 1:
                        message = {'role': 'assistant', 'content': None, 'tool_calls': [{'id': 'profile-call', 'type': 'function', 'function': {'name': 'get_restaurant_info', 'arguments': '{}'}}]}
                    return httpx.Response(200, json={'id': 'synthetic', 'object': 'chat.completion', 'created': 1, 'model': MODEL, 'choices': [{'index': 0, 'message': message, 'finish_reason': 'tool_calls' if len(calls) == 1 else 'stop'}]})
                result = await run_conversation(question, SETTINGS, 'demo-padang', HEADERS, model_transport=httpx.MockTransport(model), api_transport=httpx.MockTransport(lambda request: httpx.Response(200, json=profile)))
                self.assertEqual(result['status'], 'ok')
                self.assertEqual(result['cards'][0]['data']['outlets'][0]['weeklyHours'], outlet['weeklyHours'])
                tool_messages = [message for message in calls[1]['messages'] if message['role'] == 'tool']
                self.assertIn('weeklyHours', tool_messages[0]['content'])
                system = ' '.join(message['content'] for message in calls[0]['messages'] if message['role'] == 'system')
                self.assertIn('bukan bukti jumlah seluruh cabang', system)
                self.assertIn('hari yang tidak tercatat', system)
                self.assertIn('todayHours sudah mendahulukan jadwal khusus', system)

    async def test_today_hours_answer_never_calls_model_or_invents_missing_hours(self):
        def forbidden(request):
            self.fail('Supported hours question must not call the model')
        outlet = {'name': 'Demo', 'address': 'Cikini', 'contactPhone': '', 'timezone': 'Asia/Jakarta', 'durationMinutes': 90, 'minNoticeMinutes': 60, 'maxAdvanceDays': 30, 'cancelCutoffMinutes': 120, 'maxPartySize': 12}
        for configured, source, opening, closing, expected in [
            (True, 'weekly', 480, 1260, 'Hari ini restoran buka pukul 08.00–21.00 WIB.'),
            (True, 'special', None, None, 'Hari ini restoran tutup.'),
            (False, 'unconfigured', None, None, 'Jam buka hari ini belum tersedia.'),
        ]:
            profile = {'data': {'slug': 'demo-padang', 'name': 'Demo', 'outlets': [{**outlet, 'todayHours': {'date': '2026-10-30', 'timezone': 'Asia/Jakarta', 'configured': configured, 'source': source, 'openMinute': opening, 'closeMinute': closing}}]}, 'retrieved_at': '2026-10-30T00:00:00Z', 'source': 'restaurant_api'}
            result = await run_conversation('halo. info restaurant buka jam berapa ya, soalnya aku mau reservasi tempat', SETTINGS, 'demo-padang', HEADERS, model_transport=httpx.MockTransport(forbidden), api_transport=httpx.MockTransport(lambda request: httpx.Response(200, json=profile)))
            self.assertEqual(result['status'], 'ok')
            self.assertEqual(result['message'], expected + ' Reservasi lewat chat belum bisa dilakukan.')
            self.assertEqual(result['attempted_requests'], 0)
            self.assertEqual(result['cards'], [])

    async def test_today_hours_tool_failure_does_not_claim_closed(self):
        result = await run_conversation('Buka jam berapa?', SETTINGS, 'demo-padang', HEADERS, api_transport=httpx.MockTransport(lambda request: httpx.Response(503)))
        self.assertNotEqual(result['status'], 'ok')
        self.assertNotIn('restoran tutup', result['message'])
        self.assertEqual(result['attempted_requests'], 0)

    async def test_followup_rate_limit_preserves_only_validated_tool_cards(self):
        for question in ['Menu apa saja?', 'Ada rendang buat makan siang?', 'Berapa harga lauk dan mana yang tersedia?']:
            calls = []
            def model(request):
                calls.append(True)
                if len(calls) > 1:
                    return httpx.Response(429, headers={'retry-after': '1'}, json={'error': {'message': 'synthetic'}})
                message = {'role': 'assistant', 'content': None, 'tool_calls': [{'id': 'menu-call', 'type': 'function', 'function': {'name': 'search_menu', 'arguments': '{}'}}]}
                return httpx.Response(200, json={'id': 'synthetic', 'object': 'chat.completion', 'created': 1, 'model': MODEL, 'choices': [{'index': 0, 'message': message, 'finish_reason': 'tool_calls'}]})
            api = httpx.MockTransport(lambda request: httpx.Response(200, json={'data': [{'id': 'synthetic', 'name': 'Rendang', 'description': 'Demo', 'price': 35000, 'isAvailable': False}], 'source': 'restaurant_api'}))
            result = await run_conversation(question, SETTINGS, 'demo-padang', HEADERS, model_transport=httpx.MockTransport(model), api_transport=api)
            self.assertEqual(result['status'], 'partial')
            self.assertEqual(result['cards'][0]['data'][0]['price'], 35000)
            self.assertFalse(result['cards'][0]['data'][0]['isAvailable'])
            self.assertEqual(result['attempted_requests'], 2)
            self.assertIn('API restoran', result['message'])

    async def test_rate_limit_returns_fallback_without_cards(self):
        result = await run_conversation('Menu?', SETTINGS, 'demo-padang', HEADERS, model_transport=httpx.MockTransport(lambda request: httpx.Response(429, json={'error': {'message': 'synthetic'}})), api_transport=httpx.MockTransport(lambda request: httpx.Response(503)))
        self.assertNotEqual(result['status'], 'ok')
        self.assertEqual(result['cards'], [])
        self.assertEqual(result['attempted_requests'], 1)
        self.assertTrue(any(event['category'] == 'rate_limited' and event['http_status'] == 429 for event in result['diagnostics']))
        self.assertTrue(all(set(event) <= {'category', 'http_status', 'limit_scope', 'retry_after_seconds', 'rate_limit', 'rate_remaining', 'rate_reset'} for event in result['diagnostics']))
        self.assertTrue(any(event.get('limit_scope') == 'unknown' for event in result['diagnostics']))
