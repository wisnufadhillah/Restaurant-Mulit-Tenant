"""Reuse the bounded conversation core while the legacy HTTP server remains rollback."""
from pathlib import Path
import sys

_core = Path(__file__).resolve().parents[2] / 'apps' / 'assistant'
if str(_core) not in sys.path:
    sys.path.insert(0, str(_core))

from agent_factory import ModelSettings
from conversation_runner import run_conversation

from .config import settings, validate_model_settings
from .backend import internal_headers


def model_settings():
    validate_model_settings()
    return ModelSettings(settings.model_id, settings.allowed_models, settings.model_api_key)


async def run_turn(request, *, model_settings_override=None, model_transport=None, api_transport=None, history=None):
    checked = model_settings_override or model_settings()
    headers = internal_headers({'x-internal-context': request.context, 'x-session-id': request.sessionId})
    return await run_conversation(request.message, checked, request.tenantSlug, headers,
        history=history,
        model_transport=model_transport, api_transport=api_transport,
        api_origin=settings.restaurant_api_base_url)
