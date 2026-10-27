"""Run the full Agno pipeline with injected mock model and catalogue transports."""
import httpx
from agent_factory import ModelSettings, create_restaurant_agent
from execution_gateway import execute_offline, BudgetExceeded
from model_transport import BudgetTransport
from restaurant_schema import RestaurantResponse
from restaurant_tool import ToolUnavailable


async def run_simulated(message: str, settings: ModelSettings, tenant_slug: str, model_transport: httpx.MockTransport, catalogue_transport: httpx.MockTransport, *, timeout_seconds: float = 30, request_limit: int = 3):
    if not isinstance(model_transport, httpx.MockTransport) or not isinstance(catalogue_transport, httpx.MockTransport):
        raise ValueError('Simulation requires mock transports for both services')
    return await _run_with_transports(message, settings, tenant_slug, model_transport, catalogue_transport, timeout_seconds=timeout_seconds, request_limit=request_limit)


async def _run_with_transports(message, settings, tenant_slug, model_transport, catalogue_transport, *, timeout_seconds=30, request_limit=3, diagnostics=None):
    # Trusted internal caller supplies transports; never accept them from HTTP input.
    # Reuse factory context validation before constructing a request path.
    from restaurant_tool import make_restaurant_tool
    make_restaurant_tool('http://127.0.0.1:3001', tenant_slug)

    async def runner(prompt, budget):
        counted_transport = BudgetTransport(model_transport, budget, settings.model_id)
        async with httpx.AsyncClient(transport=counted_transport, trust_env=False, follow_redirects=False, timeout=10) as model_client:
            async with httpx.AsyncClient(transport=catalogue_transport, trust_env=False, follow_redirects=False, timeout=5) as api_client:
                tool_failed = False

                async def get_restaurant_info() -> dict:
                    """Read the restaurant public profile from its application-bound catalogue."""
                    nonlocal tool_failed
                    try:
                        async with api_client.stream('GET', f'http://127.0.0.1:3001/api/v1/public/tenants/{tenant_slug}/restaurant') as response:
                            response.raise_for_status()
                            body = bytearray()
                            async for part in response.aiter_bytes():
                                body.extend(part)
                                if len(body) > 65536:
                                    raise ToolUnavailable('Restaurant information is unavailable')
                        result = RestaurantResponse.model_validate_json(bytes(body))
                        if result.data.slug != tenant_slug:
                            raise ToolUnavailable('Restaurant information is unavailable')
                        return result.model_dump(mode='json')
                    except Exception:
                        tool_failed = True
                        raise ToolUnavailable('Restaurant information is unavailable') from None

                agent = create_restaurant_agent(settings, 'http://127.0.0.1:3001', tenant_slug, http_client=model_client, restaurant_tool=get_restaurant_info)
                try:
                    output = await agent.arun(prompt)
                    if counted_transport.budget_exhausted:
                        raise BudgetExceeded('Inference request budget exhausted')
                    if counted_transport.failed:
                        raise ToolUnavailable('Model service is unavailable')
                    if tool_failed:
                        raise ToolUnavailable('Restaurant information is unavailable')
                    return output.content
                finally:
                    if diagnostics is not None:
                        diagnostics.extend(dict(event) for event in counted_transport.events)
                    if agent.model.async_client is not None:
                        await agent.model.async_client.close()

    return await execute_offline(message, runner, timeout_seconds=timeout_seconds, request_limit=request_limit)
