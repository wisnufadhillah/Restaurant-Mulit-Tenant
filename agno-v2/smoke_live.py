"""Explicit bounded live model smoke with synthetic tool data, never business DB."""
import argparse
import asyncio
from dataclasses import replace
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
import re
import secrets
import time

import httpx
from app import backend
from app.main import run_gateway
from app.runtime import model_settings
from app.schemas import GatewayRequest

ROOT = Path(__file__).resolve().parents[1]


class LiveTransport(httpx.AsyncBaseTransport):
    used = 0
    stopped = False
    providers = set()
    http_statuses = []
    limit = 14

    async def handle_async_request(self, request):
        if LiveTransport.stopped or LiveTransport.used >= LiveTransport.limit:
            raise RuntimeError('Live budget closed')
        LiveTransport.used += 1
        async with httpx.AsyncClient(timeout=20, trust_env=False, follow_redirects=False,
                                     transport=httpx.AsyncHTTPTransport(retries=0)) as client:
            response = await client.send(request)
            body = await response.aread()
        LiveTransport.http_statuses.append(response.status_code)
        if response.status_code in (401, 402, 403, 429):
            LiveTransport.stopped = True
        if response.status_code == 200:
            try:
                provider = json.loads(body).get('provider')
                if isinstance(provider, str) and re.fullmatch(r'[A-Za-z0-9 ._/-]{1,100}', provider):
                    self.providers.add(provider)
            except (ValueError, AttributeError):
                pass
        headers = {k: v for k, v in response.headers.items() if k.lower() not in ('content-encoding', 'content-length', 'transfer-encoding')}
        return httpx.Response(response.status_code, headers=headers, content=body, request=request)


async def main():
    logging.disable(logging.CRITICAL)
    report = {'checked_at': datetime.now(timezone.utc).isoformat(), 'source': 'live OpenRouter; synthetic API tools; not website or business DB',
              'request_limit': LiveTransport.limit, 'attempted_requests': 0, 'results': [], 'status': 'blocked'}
    output = ROOT / 'docs/evidence' / ('chatbot-live-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '.json')
    output.parent.mkdir(parents=True, exist_ok=True)
    try:
        checked = model_settings()
        report['model'] = checked.model_id
        async with httpx.AsyncClient(timeout=15, trust_env=False, follow_redirects=False) as client:
            response = await client.get('https://openrouter.ai/api/v1/models')
            response.raise_for_status()
            entry = next((x for x in response.json()['data'] if x.get('id') == checked.model_id), None)
        if not entry or 'tools' not in entry.get('supported_parameters', []) or any(float(entry.get('pricing', {}).get(k, '1')) != 0 for k in ('prompt', 'completion')):
            report['reason'] = 'Configured model is not currently listed as free and tools-capable'
            return
        report['catalogue_free_tools'] = True
        backend.settings = replace(backend.settings, internal_service_token=secrets.token_urlsafe(32))
        cases = [('menu', 'Harga rendang?'), ('profile', 'Apa nama restoran dan alamatnya?'),
                 ('faq', 'Boleh membawa kue?'), ('no-source', 'Apakah tersedia parkir?'), ('reservation', 'Mau reservasi')]
        for name, message in cases:
            if LiveTransport.stopped or LiveTransport.used + 3 > LiveTransport.limit:
                break
            reads = []
            def api(request):
                resource = request.url.path.rsplit('/', 1)[-1]
                reads.append(resource)
                if resource == 'menu':
                    data = {'source': 'restaurant_api', 'data': [{'id': 'synthetic', 'name': 'Rendang', 'description': 'Menu sintetis', 'price': 35000, 'isAvailable': True}]}
                elif resource == 'restaurant':
                    data = {'source': 'restaurant_api', 'retrieved_at': datetime.now(timezone.utc).isoformat(), 'data': {'slug': 'demo-padang', 'name': 'Restoran Sintetis', 'outlets': []}}
                elif resource == 'knowledge':
                    excerpts = [] if name == 'no-source' else [{'documentId': '11111111-1111-4111-8111-111111111111', 'revision': 1, 'position': 0, 'title': 'Kue sintetis', 'text': 'Customer boleh membawa kue sendiri tanpa biaya tambahan.'}]
                    data = {'source': 'restaurant_knowledge', 'data': excerpts}
                else:
                    return httpx.Response(404, json={})
                return httpx.Response(200, json=data)
            before = LiveTransport.used
            started = time.monotonic()
            result = await run_gateway(GatewayRequest(message=message, tenantSlug='demo-padang', sessionId='synthetic-session', context='synthetic-context'),
                model_settings=checked, model_transport=LiveTransport(), api_transport=httpx.MockTransport(api))
            answer = result['message']
            if checked.api_key in answer or re.search(r'sk-[A-Za-z0-9_-]{12,}|Bearer\s+\S+', answer):
                answer = '[Output suppressed by credential safety check]'
            passed = result['status'] == 'ok'
            if name == 'menu': passed = passed and '35.000' in answer and 'menu' in reads
            elif name == 'profile': passed = passed and 'Restoran Sintetis' in answer and 'restaurant' in reads
            elif name == 'faq': passed = passed and 'kue' in answer.casefold() and 'knowledge' in reads
            elif name == 'no-source': passed = passed and 'belum memiliki sumber FAQ' in answer
            else: passed = passed and 'form' in answer.casefold() and LiveTransport.used == before
            report['results'].append({'case': name, 'input': message, 'status': result['status'], 'answer': answer,
                'tool_reads': reads, 'attempted_requests': LiveTransport.used - before, 'latency_seconds': round(time.monotonic()-started, 3),
                'diagnostics': result.get('diagnostics', []), 'passed': passed})
            report['attempted_requests'] = LiveTransport.used
            if not passed or LiveTransport.stopped:
                break
        report['providers'] = sorted(LiveTransport.providers) or ['not returned']
        report['status'] = 'passed' if len(report['results']) == 5 and all(x['passed'] for x in report['results']) else 'stopped'
    except Exception:
        report['reason'] = 'Configuration, catalogue or execution failed; private details suppressed'
    finally:
        report['attempted_requests'] = LiveTransport.used
        report['provider_http_statuses'] = LiveTransport.http_statuses
        output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        print(json.dumps(report, ensure_ascii=True, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--allow-live', required=True, action='store_true')
    parser.parse_args()
    asyncio.run(main())
