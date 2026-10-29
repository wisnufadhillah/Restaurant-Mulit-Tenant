"""Deterministic HTTP fixture; never invokes a provider or reads private config."""
import json
import os
from http.server import ThreadingHTTPServer
from agent_factory import ModelSettings
import conversation_server


def settings(*_args):
    return ModelSettings('example/demo:free', ('example/demo:free',), 'synthetic-test-value')


async def runner(message, _settings, tenant, headers):
    if tenant != 'demo-padang' or not headers['x-session-id'] or '@' in message:
        raise ValueError('Unsafe bound turn')
    if message == 'Gangguan sintetis':
        raise RuntimeError('Synthetic failure')
    return {'status': 'ok', 'message': 'Rendang contoh Rp35.000.', 'cards': [{'type': 'menu', 'data': [{'id': 'synthetic', 'name': 'Rendang contoh', 'description': 'Fixture deterministik, bukan data restoran', 'price': 35000, 'isAvailable': True}]}], 'attempted_requests': 0}


if __name__ == '__main__':
    conversation_server.load_model_settings = settings
    conversation_server.run_conversation = runner
    server = ThreadingHTTPServer(('127.0.0.1', 0), conversation_server.ConversationHandler)
    print(json.dumps({'port': server.server_port}), flush=True)
    server.serve_forever()
