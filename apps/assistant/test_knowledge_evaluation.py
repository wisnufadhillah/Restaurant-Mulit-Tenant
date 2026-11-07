"""Deterministic Indonesian FAQ routing set; no provider or database calls."""
import unittest
import httpx
from agent_factory import ModelSettings
from conversation_runner import run_conversation

class KnowledgeEvaluation(unittest.IsolatedAsyncioTestCase):
    async def test_indonesian_faq_questions_use_sources_or_abstain_without_inference(self):
        settings = ModelSettings('example/demo:free', ('example/demo:free',), 'synthetic-test-value')
        headers = {'x-internal-service-token': 'synthetic-service', 'x-internal-context': 'synthetic-context', 'x-session-id': 'synthetic-session'}
        questions = ['Perlu akun customer?', 'Bagaimana kode referensi?', 'Apa itu ringkasan?', 'Respons terputus bagaimana?', 'Bagaimana pemulihan?', 'Akses privat hilang?', 'Kebijakan website?', 'Boleh membawa kue?', 'Ada parkir?', 'Apakah halal?', 'Informasi alergen?', 'Bagaimana fasilitas?', 'Boleh membawa hewan?', 'Bisa dekorasi?', 'Ada kursi roda?', 'Boleh makanan dari luar?', 'Barang tertinggal bagaimana?']
        requests = []
        def forbidden(request):
            self.fail('Evaluation must not invoke provider')
        def api(request):
            requests.append(request)
            self.assertEqual(request.url.path, '/api/v1/internal/tenants/demo-padang/knowledge')
            return httpx.Response(200, json={'data': [], 'source': 'restaurant_knowledge'})
        for question in questions:
            with self.subTest(question=question):
                result = await run_conversation(question, settings, 'demo-padang', headers, api_transport=httpx.MockTransport(api), model_transport=httpx.MockTransport(forbidden))
                self.assertEqual(result['status'], 'ok')
                self.assertEqual(result['attempted_requests'], 0)
                self.assertIn('belum memiliki sumber FAQ', result['message'])
        self.assertEqual(len(requests), len(questions))
