from typing import Any

import httpx

from .config import settings


async def call_restaurant_api(
    method: str,
    path: str,
    *,
    params: dict[str, Any] | None = None,
    json: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    async with httpx.AsyncClient(
        base_url=settings.restaurant_api_base_url,
        timeout=httpx.Timeout(5.0, connect=2.0),
        follow_redirects=False,
        trust_env=False,
    ) as client:
        response = await client.request(method, path, params=params, json=json, headers=headers)
        response.raise_for_status()
        return response.json()


def internal_headers(context: dict[str, str]) -> dict[str, str]:
    required = {"x-internal-context", "x-session-id"}
    if set(context) != required or any(not isinstance(value, str) or not value for value in context.values()):
        raise ValueError("Internal context required")
    if len(context["x-internal-context"]) > 4096 or len(context["x-session-id"]) > 128:
        raise ValueError("Invalid internal context")
    if len(settings.internal_service_token) < 32:
        raise RuntimeError("Internal service token is not configured")
    return {
        "x-internal-service-token": settings.internal_service_token,
        **context,
    }
