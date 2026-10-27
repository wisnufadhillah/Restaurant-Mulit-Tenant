"""Approved bounded smoke of explicit free candidates; no configuration rewrite."""
import argparse
import asyncio
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'apps/assistant'))
import httpx
from agent_factory import ModelSettings
from private_config import load_model_settings
from async_runner import _run_with_transports
from model_failover import run_failover

MODELS = ('nvidia/nemotron-3.5-lightning:free', 'poolside/laguna-xs-2.1:free')


async def smoke():
    logging.disable(logging.CRITICAL)
    original = load_model_settings((ROOT / 'apps/assistant/.env').resolve(), {})
    async with httpx.AsyncClient(timeout=15, trust_env=False, follow_redirects=False) as client:
        response = await client.get('https://openrouter.ai/api/v1/models')
        response.raise_for_status()
        catalogue = {m['id']: m for m in response.json()['data']}
    for model in MODELS:
        entry = catalogue.get(model)
        if not entry or 'tools' not in entry.get('supported_parameters', []) or any(float(entry.get('pricing', {}).get(k, '1')) != 0 for k in ('prompt', 'completion')):
            raise ValueError('Candidate failed free/tools preflight')
    reports = []
    async def attempt(model, budget, deadline):
        diagnostics, tool_calls = [], []
        def fixture(request):
            tool_calls.append(True)
            return httpx.Response(200, json={'data': {'slug': 'demo-padang', 'name': 'Restoran Padang Demo', 'outlets': []}, 'retrieved_at': datetime.now(timezone.utc).isoformat(), 'source': 'restaurant_api'})
        settings = ModelSettings(model, MODELS, original.api_key)
        result = await _run_with_transports('Apa nama restoran ini? Gunakan tool informasi restoran untuk memastikan.', settings, 'demo-padang', httpx.AsyncHTTPTransport(retries=0), httpx.MockTransport(fixture), request_limit=budget, timeout_seconds=deadline, diagnostics=diagnostics)
        reports.append({'model': model, 'status': result.status, 'attempted_requests': result.attempted_requests, 'tool_calls': len(tool_calls), 'expected_name_present': 'restoran padang demo' in result.message.lower(), 'passed': result.status == 'ok' and len(tool_calls) == 1 and 'restoran padang demo' in result.message.lower(), 'request_diagnostics': diagnostics})
        return result, diagnostics
    await run_failover(MODELS, attempt, total_request_limit=4)
    report = {'checked_at': datetime.now(timezone.utc).isoformat(), 'attempts': reports, 'total_inference_requests': sum(r['attempted_requests'] for r in reports), 'provider': 'not captured', 'raw_response_stored': False, 'source': 'synthetic fixture'}
    path = ROOT / '.local' / ('failover-smoke-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '.json')
    path.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--allow-live', action='store_true', required=True)
    parser.parse_args()
    try:
        asyncio.run(smoke())
    except Exception:
        print('Smoke stopped; sensitive diagnostic details suppressed')
        sys.exit(1)
