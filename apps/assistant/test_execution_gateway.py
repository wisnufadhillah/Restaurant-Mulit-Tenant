import asyncio
import unittest
from unittest.mock import patch
from execution_gateway import execute_offline, RequestBudget, BudgetExceeded, FALLBACK


class GatewayTest(unittest.IsolatedAsyncioTestCase):
    async def test_success_counts_attempted_requests(self):
        async def runner(message, budget):
            budget.consume()
            budget.consume()
            return "Informasi restoran dari hasil stub."
        with patch("socket.socket.connect", side_effect=AssertionError("Network forbidden")):
            result = await execute_offline("  info restoran  ", runner)
        self.assertEqual(result.status, "ok")
        self.assertEqual(result.attempted_requests, 2)

    async def test_fourth_request_is_never_attempted(self):
        attempts = []
        async def runner(message, budget):
            for i in range(4):
                budget.consume()
                attempts.append(i)
            return "unreachable"
        result = await execute_offline("info", runner)
        self.assertEqual(result.status, "budget_exhausted")
        self.assertEqual(attempts, [0, 1, 2])
        self.assertEqual(result.message, FALLBACK)

    async def test_timeout_cancels_cooperative_runner_and_cleans_up(self):
        closed = []
        async def runner(message, budget):
            budget.consume()
            try:
                await asyncio.sleep(60)
            finally:
                closed.append(True)
        result = await execute_offline("info", runner, timeout_seconds=0.01)
        self.assertEqual(result.status, "timeout")
        self.assertEqual(closed, [True])
        self.assertEqual(result.message, FALLBACK)

    async def test_failure_does_not_expose_exception_or_retry(self):
        async def runner(message, budget):
            budget.consume()
            raise RuntimeError("private upstream details")
        result = await execute_offline("info", runner)
        self.assertEqual(result.status, "unavailable")
        self.assertEqual(result.attempted_requests, 1)
        self.assertNotIn("private", result.message)

    async def test_invalid_input_does_not_invoke_runner(self):
        async def runner(*args):
            self.fail("Runner must not execute")
        for message in [None, "", "  ", "x" * 2001]:
            result = await execute_offline(message, runner)
            self.assertEqual(result.status, "invalid_input")
            self.assertEqual(result.attempted_requests, 0)

    async def test_malformed_output_uses_fallback(self):
        for output in [None, {}, " ", "x" * 8001]:
            async def runner(message, budget):
                return output
            result = await execute_offline("info", runner)
            self.assertEqual(result.status, "invalid_output")
            self.assertEqual(result.message, FALLBACK)

    async def test_external_cancellation_is_not_hidden(self):
        async def runner(message, budget):
            raise asyncio.CancelledError()
        with self.assertRaises(asyncio.CancelledError):
            await execute_offline("info", runner)

    async def test_budget_is_isolated_per_turn(self):
        async def runner(message, budget):
            budget.consume()
            return "ok"
        first, second = await asyncio.gather(execute_offline("one", runner), execute_offline("two", runner))
        self.assertEqual((first.attempted_requests, second.attempted_requests), (1, 1))

    async def test_invalid_settings_fail_before_execution(self):
        for timeout in [0, -1, 31, float("nan"), True]:
            with self.assertRaises(ValueError):
                await execute_offline("info", None, timeout_seconds=timeout)
        for limit in [0, 4, True, 1.5]:
            with self.assertRaises(ValueError):
                RequestBudget(limit)


if __name__ == "__main__":
    unittest.main()
