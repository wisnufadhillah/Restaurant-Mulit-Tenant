"""Offline execution boundary for cooperative asynchronous runners."""
import asyncio
from dataclasses import dataclass
from collections.abc import Awaitable, Callable
import math

FALLBACK = "Informasi belum tersedia. Silakan gunakan halaman atau form web restoran."


class BudgetExceeded(RuntimeError):
    pass


class RequestBudget:
    def __init__(self, limit: int = 3):
        if type(limit) is not int or not 1 <= limit <= 3:
            raise ValueError("Request budget must be between one and three")
        self._limit = limit
        self._used = 0

    @property
    def used(self):
        return self._used

    def consume(self):
        """Must be called immediately before each attempted inference request."""
        if self._used >= self._limit:
            raise BudgetExceeded("Inference request budget exhausted")
        self._used += 1


@dataclass(frozen=True)
class ExecutionResult:
    status: str
    message: str
    attempted_requests: int


Runner = Callable[[str, RequestBudget], Awaitable[str]]


async def execute_offline(message: str, runner: Runner, *, timeout_seconds: float = 30, request_limit: int = 3) -> ExecutionResult:
    """Execute a trusted offline runner; not a public chat endpoint or live adapter."""
    if isinstance(timeout_seconds, bool) or not isinstance(timeout_seconds, (int, float)) or not math.isfinite(timeout_seconds) or not 0 < timeout_seconds <= 30:
        raise ValueError("Execution timeout must be positive and at most thirty seconds")
    budget = RequestBudget(request_limit)
    if not isinstance(message, str) or not message.strip() or len(message) > 2000:
        return ExecutionResult("invalid_input", "Pesan harus berisi 1–2000 karakter.", 0)
    try:
        async with asyncio.timeout(timeout_seconds):
            output = await runner(message.strip(), budget)
        if not isinstance(output, str) or not output.strip() or len(output) > 8000:
            return ExecutionResult("invalid_output", FALLBACK, budget.used)
        return ExecutionResult("ok", output, budget.used)
    except BudgetExceeded:
        return ExecutionResult("budget_exhausted", FALLBACK, budget.used)
    except TimeoutError:
        return ExecutionResult("timeout", FALLBACK, budget.used)
    except Exception:
        return ExecutionResult("unavailable", FALLBACK, budget.used)
