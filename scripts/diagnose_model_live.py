"""One explicitly approved diagnostic inference; metadata only."""
import asyncio
import json
import logging
from pathlib import Path
import sys
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'apps/assistant'))
import httpx
from private_config import load_model_settings
from model_transport import BudgetTransport
from execution_gateway import RequestBudget

MODEL = 'google/gemma-4-26b-a4b-it:free'

async def main():
    logging.disable(logging.CRITICAL)
    settings = load_model_settings((ROOT / 'apps/assistant/.env').resolve(), {})
    async with httpx.AsyncClient(timeout=15, trust_env=False) as client:
        catalogue = await client.get('https://openrouter.ai/api/v1/models')
        catalogue.raise_for_status()
        entry = next(m for m in catalogue.json()['data'] if m['id'] == MODEL)
        if 'tools' not in entry.get('supported_parameters', []) or any(float(entry.get('pricing', {}).get(k, '1')) != 0 for k in ('prompt', 'completion')):
            raise ValueError('Free tools model preflight failed')
    budget = RequestBudget(1)
    transport = BudgetTransport(httpx.AsyncHTTPTransport(retries=0), budget, MODEL)
    async with httpx.AsyncClient(transport=transport, timeout=15, trust_env=False, follow_redirects=False) as client:
        response = await client.post('https://openrouter.ai/api/v1/chat/completions', headers={'Authorization': 'Bearer ' + settings.api_key}, json={'model': MODEL, 'messages': [{'role': 'user', 'content': 'Balas singkat dalam Bahasa Indonesia: ini tes sintetis.'}], 'max_tokens': 32})
        await response.aclose()
    print(json.dumps({'model': MODEL, 'attempted_requests': budget.used, 'diagnostics': transport.events, 'raw_response_stored': False}, indent=2))

if __name__ == '__main__':
    if sys.argv[1:] != ['--allow-live']:
        raise SystemExit('Explicit --allow-live required')
    try:
        asyncio.run(main())
    except Exception:
        print('Diagnostic stopped; sensitive details suppressed')
        sys.exit(1)
