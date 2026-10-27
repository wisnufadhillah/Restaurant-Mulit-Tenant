"""Count and validate each model HTTP request before forwarding it."""
import json
import httpx
from execution_gateway import RequestBudget, BudgetExceeded


class BudgetTransport(httpx.AsyncBaseTransport):
    def __init__(self, inner: httpx.AsyncBaseTransport, budget: RequestBudget, model_id: str):
        self.inner = inner
        self.budget = budget
        self.model_id = model_id
        self.budget_exhausted = False
        self.failed = False
        self.events = []

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        if request.method != 'POST' or str(request.url) != 'https://openrouter.ai/api/v1/chat/completions':
            raise ValueError('Unexpected model endpoint')
        payload = json.loads(await request.aread())
        if payload.get('model') != self.model_id or not self.model_id.endswith(':free'):
            raise ValueError('Model request violates configured model')
        if any(key in payload for key in ('models', 'route', 'plugins', 'provider')):
            raise ValueError('Routing and plugin overrides are not allowed')
        try:
            self.budget.consume()
        except BudgetExceeded:
            self.budget_exhausted = True
            raise
        try:
            response = await self.inner.handle_async_request(request)
        except Exception as error:
            self.failed = True
            category = 'timeout' if isinstance(error, httpx.TimeoutException) else 'transport_error'
            self.events.append({'attempt': self.budget.used, 'http_status': None, 'category': category})
            raise
        status = response.status_code
        category = 'ok'
        if status >= 400:
            self.failed = True
            category = {400: 'invalid_request', 401: 'authentication', 402: 'credit_or_quota', 403: 'access_denied', 404: 'endpoint_or_model_missing', 429: 'rate_limited'}.get(status, 'upstream_error' if status >= 500 else 'http_error')
        elif status >= 300:
            self.failed = True
            category = 'redirect_rejected'
        self.events.append({'attempt': self.budget.used, 'http_status': status, 'category': category})
        return response

    async def aclose(self):
        await self.inner.aclose()
