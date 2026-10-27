"""Bounded application-level model failover without resetting the request budget."""
import asyncio
from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from execution_gateway import ExecutionResult


@dataclass(frozen=True)
class ModelAttempt:
    model: str
    result: ExecutionResult
    diagnostics: tuple[dict, ...]


async def run_failover(models: tuple[str, ...], attempt: Callable[[str, int, float], Awaitable[tuple[ExecutionResult, list[dict]]]], *, timeout_seconds: float = 30, total_request_limit: int = 3) -> tuple[ModelAttempt, ...]:
    if not 1 <= len(models) <= 2 or len(set(models)) != len(models) or any(not isinstance(m, str) or not m.endswith(':free') for m in models):
        raise ValueError('One or two distinct explicitly approved free models are required')
    if isinstance(timeout_seconds, bool) or not isinstance(timeout_seconds, (int, float)) or not 0 < timeout_seconds <= 30:
        raise ValueError('Invalid failover deadline')
    if type(total_request_limit) is not int or not 1 <= total_request_limit <= 4:
        raise ValueError('Total request limit must be between one and four')
    remaining_requests = total_request_limit
    deadline = asyncio.get_running_loop().time() + timeout_seconds
    attempts = []
    for model in models:
        remaining_seconds = deadline - asyncio.get_running_loop().time()
        if remaining_requests < 1 or remaining_seconds <= 0:
            break
        async with asyncio.timeout(remaining_seconds):
            result, diagnostics = await attempt(model, min(remaining_requests, 3), remaining_seconds)
        if not 0 <= result.attempted_requests <= remaining_requests:
            raise ValueError('Runner exceeded shared inference budget')
        remaining_requests -= result.attempted_requests
        attempts.append(ModelAttempt(model, result, tuple(diagnostics)))
        if result.status == 'ok':
            break
        # Unknown 429 scope must not trigger account/global quota circumvention.
        # Auth, validation, moderation and malformed output are not retryable here.
        retryable = result.status == 'timeout' or (
            result.status == 'unavailable'
            and bool(diagnostics)
            and (diagnostics[-1].get('category') in ('upstream_error', 'transport_error', 'timeout')
                 or (diagnostics[-1].get('category') == 'rate_limited' and diagnostics[-1].get('limit_scope') == 'upstream'))
        )
        if not retryable or remaining_requests < 2:
            break
    return tuple(attempts)
