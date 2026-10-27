import importlib.util
from pathlib import Path
import unittest
from types import SimpleNamespace
from execution_gateway import ExecutionResult

path = Path(__file__).resolve().parents[2] / 'scripts' / 'preview_model_live.py'
spec = importlib.util.spec_from_file_location('preview_script', path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class PreviewTest(unittest.IsolatedAsyncioTestCase):
    async def test_preflight_failure_reports_zero_requests_and_stage(self):
        async def catalogue():
            raise TimeoutError('synthetic-private-details')
        async def runner(*args):
            self.fail('Must not invoke inference')
        report = await module.preview(lambda: SimpleNamespace(api_key='synthetic-value'), catalogue, runner)
        self.assertEqual(report['stage'], 'catalogue')
        self.assertEqual(report['attempted_requests'], 0)
        self.assertEqual(report['failure_category'], 'timeout')
        self.assertNotIn('synthetic-private-details', str(report))

    async def test_success_preserves_final_answer(self):
        async def catalogue():
            return [{'id': module.MODEL, 'supported_parameters': ['tools'], 'pricing': {'prompt': '0', 'completion': '0'}}]
        async def runner(settings, report):
            report['tool_calls'] = 1
            return ExecutionResult('ok', 'Nama restoran ini Restoran Padang Demo.', 2)
        report = await module.preview(lambda: SimpleNamespace(api_key='synthetic-value'), catalogue, runner)
        self.assertEqual(report['stage'], 'complete')
        self.assertEqual(report['attempted_requests'], 2)
        self.assertEqual(report['final_answer'], 'Nama restoran ini Restoran Padang Demo.')

    async def test_execution_exception_does_not_claim_zero_requests(self):
        async def catalogue():
            return [{'id': module.MODEL, 'supported_parameters': ['tools'], 'pricing': {'prompt': '0', 'completion': '0'}}]
        async def runner(*args):
            raise RuntimeError('synthetic-private-details')
        report = await module.preview(lambda: SimpleNamespace(api_key='synthetic-value'), catalogue, runner)
        self.assertIsNone(report['attempted_requests'])
        self.assertEqual(report['stage'], 'inference')
        self.assertNotIn('synthetic-private-details', str(report))


if __name__ == '__main__':
    unittest.main()
