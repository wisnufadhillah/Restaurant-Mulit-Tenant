"""Explicitly approved, bounded live smoke using only a synthetic restaurant fixture."""
import argparse
import asyncio
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'apps/assistant'))
import httpx
from private_config import load_model_settings
from async_runner import _run_with_transports


async def smoke():
    logging.disable(logging.CRITICAL)
    settings = load_model_settings((ROOT / 'apps/assistant/.env').resolve(), {})
    async with httpx.AsyncClient(timeout=15, trust_env=False, follow_redirects=False) as client:
        response = await client.get('https://openrouter.ai/api/v1/models')
        response.raise_for_status()
        entry = next((m for m in response.json()['data'] if m['id'] == settings.model_id), None)
    if not entry or 'tools' not in entry.get('supported_parameters', []) or any(float(entry.get('pricing', {}).get(k, '1')) != 0 for k in ('prompt', 'completion')):
        raise ValueError('Configured model is not currently listed as free and tools-capable')
    tool_calls = []
    def fixture(request):
        tool_calls.append(True)
        return httpx.Response(200, json={'data': {'slug': 'demo-padang', 'name': 'Restoran Padang Demo', 'outlets': []}, 'retrieved_at': datetime.now(timezone.utc).isoformat(), 'source': 'restaurant_api'})
    diagnostics = []
    start = time.monotonic()
    result = await _run_with_transports('Apa nama restoran ini? Gunakan tool informasi restoran untuk memastikan.', settings, 'demo-padang', httpx.AsyncHTTPTransport(retries=0), httpx.MockTransport(fixture), request_limit=3, timeout_seconds=30, diagnostics=diagnostics)
    report = {
        'checked_at': datetime.now(timezone.utc).isoformat(), 'model': settings.model_id,
        'status': result.status, 'attempted_requests': result.attempted_requests,
        'tool_calls': len(tool_calls), 'latency_seconds': round(time.monotonic() - start, 3),
        'expected_name_present': 'Restoran Padang Demo'.lower() in result.message.lower(),
        'passed': result.status == 'ok' and len(tool_calls) == 1 and 'Restoran Padang Demo'.lower() in result.message.lower(),
        'data_source': 'synthetic catalogue fixture; not live database',
        'provider': 'not captured', 'request_diagnostics': diagnostics, 'raw_response_stored': False,
    }
    output = ROOT / '.local/model-smoke-result.json'
    output.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--allow-live', action='store_true', required=True)
    parser.parse_args()
    try:
        asyncio.run(smoke())
    except Exception:
        print('Live smoke stopped: configuration, catalogue or execution failed; sensitive details suppressed')
        sys.exit(1)
