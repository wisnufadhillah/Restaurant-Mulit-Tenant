"""Browser fixture: real internal tools and deterministic model HTTP responses."""
import json
import logging
import secrets

import httpx
import uvicorn
from app import main
from app.runtime import ModelSettings

original = main.run_gateway
settings = ModelSettings('example/demo:free', ('example/demo:free',), secrets.token_urlsafe(32))


async def fixture(request):
    calls = []
    def model(req):
        calls.append(json.loads(req.content))
        message = {'role': 'assistant', 'content': 'Gunakan panduan yang sesuai dan jangan membuat reservasi baru saat hasil belum pasti.'}
        if 'menu' in request.message.casefold():
            message = {'role': 'assistant', 'content': None, 'tool_calls': [{'id': 'menu', 'type': 'function', 'function': {'name': 'search_menu', 'arguments': '{}'}}]} if len(calls) == 1 else {'role': 'assistant', 'content': 'Berikut menu yang tercatat.'}
        return httpx.Response(200, json={'id': 'synthetic', 'object': 'chat.completion', 'created': 1, 'model': settings.model_id,
            'choices': [{'index': 0, 'message': message, 'finish_reason': 'tool_calls' if message.get('tool_calls') else 'stop'}]})
    return await original(request, model_settings=settings, model_transport=httpx.MockTransport(model))


main.run_gateway = fixture
logging.disable(logging.CRITICAL)
uvicorn.run(main.app, host='127.0.0.1', port=8111, access_log=False, log_level='critical')
