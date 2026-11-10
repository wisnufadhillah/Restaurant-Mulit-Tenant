"""Run the actual ASGI gateway with deterministic HTTP model/API boundaries."""
from pathlib import Path
import sys
import socket
import threading
import json
import secrets
from dataclasses import replace

import httpx
import uvicorn

sys.path.insert(0, str(Path(__file__).resolve().parent))
from app import main
from app import backend
from app.runtime import ModelSettings

original = main.run_gateway
backend.settings = replace(backend.settings, internal_service_token=secrets.token_urlsafe(32))
model_settings = ModelSettings('example/demo:free', ('example/demo:free',), secrets.token_urlsafe(32))


async def fixture(request):
    calls = []
    def model(req):
        calls.append(True)
        if 'Gangguan' in request.message:
            return httpx.Response(503, json={'error': {'message': 'Synthetic unavailable'}})
        message = {'role': 'assistant', 'content': 'Rendang Rp35.000.'}
        if len(calls) == 1:
            message = {'role': 'assistant', 'content': None, 'tool_calls': [{'id': 'menu', 'type': 'function', 'function': {'name': 'search_menu', 'arguments': '{}'}}]}
        return httpx.Response(200, json={'id': 'synthetic', 'object': 'chat.completion', 'created': 1, 'model': model_settings.model_id,
            'choices': [{'index': 0, 'message': message, 'finish_reason': 'tool_calls' if len(calls) == 1 else 'stop'}]})
    def api(req):
        return httpx.Response(200, json={'source': 'restaurant_api', 'data': [{'id': 'synthetic', 'name': 'Rendang', 'description': 'Demo', 'price': 35000, 'isAvailable': True}]})
    return await original(request, model_settings=model_settings,
        model_transport=httpx.MockTransport(model), api_transport=httpx.MockTransport(api))


main.run_gateway = fixture
sock = socket.socket()
sock.bind(('127.0.0.1', 0))
sock.listen(128)
server = uvicorn.Server(uvicorn.Config(main.app, log_level='critical', access_log=False))
thread = threading.Thread(target=server.run, kwargs={'sockets': [sock]}, daemon=True)
thread.start()
import time
while not server.started and thread.is_alive():
    time.sleep(0.01)
print(json.dumps({'port': sock.getsockname()[1]}), flush=True)
thread.join()
