"""Read only selected quota indicators; never print credentials or raw account data."""
import asyncio
import json
import logging
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'apps/assistant'))
import httpx
from private_config import load_model_settings


def summarize(data):
    result = {'label_is_masked_key_identifier': isinstance(data.get('label'), str) and data.get('label', '').startswith('sk-'), 'free_tier': data.get('is_free_tier'), 'key_spend_cap_configured': data.get('limit') is not None}
    quota = data.get('free_model_daily_requests')
    if isinstance(quota, dict):
        result['free_model_daily_requests'] = {k: quota[k] for k in ('used', 'limit', 'remaining') if type(quota.get(k)) in (int, float)}
    else:
        result['free_model_daily_requests'] = 'not returned'
    result['effective_budget_present'] = bool(data.get('effective_budget'))
    return result


async def main():
    logging.disable(logging.CRITICAL)
    settings = load_model_settings((ROOT / 'apps/assistant/.env').resolve(), {})
    async with httpx.AsyncClient(timeout=15, trust_env=False, follow_redirects=False) as client:
        response = await client.get('https://openrouter.ai/api/v1/key', headers={'Authorization': 'Bearer ' + settings.api_key})
        if response.status_code != 200:
            print(json.dumps({'http_status': response.status_code, 'account_details': 'suppressed'}))
            return
        print(json.dumps({'http_status': 200, **summarize(response.json().get('data', {}))}, indent=2))


if __name__ == '__main__':
    try:
        asyncio.run(main())
    except Exception:
        print('Read-only quota check failed; sensitive details suppressed')
        sys.exit(1)
