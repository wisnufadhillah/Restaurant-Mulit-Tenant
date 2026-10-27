"""Approved two-request smoke displaying only a synthetic final answer."""
import argparse
import asyncio
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'apps/assistant'))
import httpx
from agent_factory import ModelSettings
from private_config import load_model_settings
from async_runner import _run_with_transports

MODEL = 'nvidia/nemotron-3.5-lightning:free'


async def preview(load_settings, get_catalogue, run_model):
    report = {'model': MODEL, 'stage': 'configuration', 'status': 'failed', 'attempted_requests': 0, 'tool_calls': 0, 'request_diagnostics': []}
    try:
        private = load_settings()
        report['stage'] = 'catalogue'
        catalogue = await get_catalogue()
        entry = next((m for m in catalogue if m.get('id') == MODEL), None)
        if not entry or 'tools' not in entry.get('supported_parameters', []) or any(float(entry.get('pricing', {}).get(k, '1')) != 0 for k in ('prompt', 'completion')):
            report['failure_category'] = 'candidate_unavailable'
            return report
        report['stage'] = 'inference'
        # Unknown until the runner returns; never misreport zero after execution starts.
        report['attempted_requests'] = None
        result = await run_model(private, report)
        report['attempted_requests'] = result.attempted_requests
        report['status'] = result.status
        answer = result.message
        if private.api_key in answer or re.search(r'sk-or-v1-[A-Za-z0-9_-]+', answer):
            answer = '[Output suppressed by credential safety check]'
        report['final_answer'] = answer
        report['stage'] = 'complete'
    except Exception as error:
        report['failure_category'] = ('timeout' if isinstance(error, (TimeoutError, httpx.TimeoutException)) else 'http_error' if isinstance(error, httpx.HTTPStatusError) else 'configuration_invalid' if report['stage'] == 'configuration' else 'execution_error')
    return report


async def main():
    logging.disable(logging.CRITICAL)
    async def catalogue():
        async with httpx.AsyncClient(timeout=15, trust_env=False, follow_redirects=False) as client:
            response = await client.get('https://openrouter.ai/api/v1/models')
            response.raise_for_status()
            return response.json()['data']
    async def run_model(private, report):
        def fixture(request):
            report['tool_calls'] += 1
            return httpx.Response(200, json={'data': {'slug': 'demo-padang', 'name': 'Restoran Padang Demo', 'outlets': []}, 'retrieved_at': datetime.now(timezone.utc).isoformat(), 'source': 'restaurant_api'})
        return await _run_with_transports('Apa nama restoran ini? Gunakan tool informasi restoran untuk memastikan.', ModelSettings(MODEL, (MODEL,), private.api_key), 'demo-padang', httpx.AsyncHTTPTransport(retries=0), httpx.MockTransport(fixture), request_limit=2, timeout_seconds=30, diagnostics=report['request_diagnostics'])
    report = await preview(lambda: load_model_settings((ROOT / 'apps/assistant/.env').resolve(), {}), catalogue, run_model)
    report['checked_at'] = datetime.now(timezone.utc).isoformat()
    report['source'] = 'synthetic fixture; not website chat'
    # Print safe report before saving so a filesystem failure cannot hide a result.
    print(json.dumps(report, ensure_ascii=True, indent=2))
    path = ROOT / '.local' / ('answer-preview-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '.json')
    try:
        path.parent.mkdir(exist_ok=True)
        with path.open('x', encoding='utf-8') as handle:
            handle.write(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    except OSError:
        print('Safe report displayed; local report could not be saved')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--allow-live', action='store_true', required=True)
    parser.parse_args()
    asyncio.run(main())
