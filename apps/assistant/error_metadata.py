"""Extract only bounded, allowlisted error indicators, never raw provider text."""
import httpx


def safe_error_metadata(status: int, headers: httpx.Headers, body: bytes) -> dict:
    import json
    result = {}
    for header, key in [('x-ratelimit-limit', 'rate_limit'), ('x-ratelimit-remaining', 'rate_remaining'), ('x-ratelimit-reset', 'rate_reset'), ('retry-after', 'retry_after_seconds')]:
        value = headers.get(header, '')
        if value.isascii() and value.isdigit() and len(value) <= 12:
            result[key] = int(value)
    try:
        parsed = json.loads(body)
        error = parsed.get('error', {}) if isinstance(parsed, dict) else {}
        metadata = error.get('metadata', {}) if isinstance(error, dict) else {}
        if not isinstance(metadata, dict):
            metadata = {}
        if 'provider_code' in metadata:
            result['provider_error_present'] = True
        kind = metadata.get('error_type')
        if kind in ('rate_limit_exceeded', 'provider_rate_limit_exceeded'):
            result['error_type'] = kind
    except (ValueError, TypeError):
        pass
    result['limit_scope'] = ('platform' if status == 429 and 'rate_limit' in result else 'upstream' if status == 429 and result.get('provider_error_present') else 'unknown')
    return result
