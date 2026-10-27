import unittest
from execution_gateway import ExecutionResult, FALLBACK
from model_failover import run_failover

MODELS = ('example/primary:free', 'example/backup:free')


class FailoverTest(unittest.IsolatedAsyncioTestCase):
    async def test_upstream_failure_switches_once_with_shared_budget(self):
        calls = []
        async def attempt(model, budget, deadline):
            calls.append((model, budget))
            if len(calls) == 1:
                return ExecutionResult('unavailable', FALLBACK, 1), [{'category': 'upstream_error'}]
            return ExecutionResult('ok', 'Synthetic success', 2), [{'category': 'ok'}]
        results = await run_failover(MODELS, attempt)
        self.assertEqual(calls, [(MODELS[0], 3), (MODELS[1], 2)])
        self.assertEqual(sum(x.result.attempted_requests for x in results), 3)

    async def test_unknown_rate_limit_or_auth_does_not_switch(self):
        for category in ['rate_limited', 'authentication', 'credit_or_quota', 'invalid_request']:
            calls = []
            async def attempt(model, budget, deadline):
                calls.append(model)
                return ExecutionResult('unavailable', FALLBACK, 1), [{'category': category}]
            await run_failover(MODELS, attempt)
            self.assertEqual(calls, [MODELS[0]])

    async def test_no_switch_if_insufficient_budget_for_tool_roundtrip(self):
        async def attempt(model, budget, deadline):
            return ExecutionResult('unavailable', FALLBACK, 2), [{'category': 'upstream_error'}]
        self.assertEqual(len(await run_failover(MODELS, attempt)), 1)

    async def test_upstream_rate_limit_can_switch_but_platform_cannot(self):
        for scope, expected in [('upstream', 2), ('platform', 1), ('unknown', 1)]:
            calls = []
            async def attempt(model, budget, deadline):
                calls.append(budget)
                return ExecutionResult('unavailable', FALLBACK, 1), [{'category': 'rate_limited', 'limit_scope': scope}]
            result = await run_failover(MODELS, attempt, total_request_limit=4)
            self.assertEqual(len(result), expected)
            self.assertEqual(calls[0], 3)

    async def test_four_total_requests_allow_two_failed_requests_then_complete_backup(self):
        calls = []
        async def attempt(model, budget, deadline):
            calls.append(budget)
            if len(calls) == 1:
                return ExecutionResult('unavailable', FALLBACK, 2), [{'category': 'upstream_error'}]
            return ExecutionResult('ok', 'Synthetic success', 2), [{'category': 'ok'}]
        result = await run_failover(MODELS, attempt, total_request_limit=4)
        self.assertEqual(calls, [3, 2])
        self.assertEqual(sum(a.result.attempted_requests for a in result), 4)

    async def test_paid_model_is_rejected_before_runner(self):
        with self.assertRaises(ValueError):
            await run_failover(('example/paid',), None)


if __name__ == '__main__':
    unittest.main()
