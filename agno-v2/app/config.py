from dataclasses import dataclass
import os
import re
from pathlib import Path

from dotenv import load_dotenv

_service_root = Path(__file__).resolve().parents[1]
_project_root = _service_root.parent
load_dotenv(_service_root / ".env")
load_dotenv(_project_root / ".env.local")
load_dotenv(_project_root / ".env")
load_dotenv(_project_root / "apps" / "assistant" / ".env")


@dataclass(frozen=True)
class Settings:
    restaurant_api_base_url: str = os.getenv("RESTAURANT_API_BASE_URL", "http://127.0.0.1:3001").rstrip("/")
    model_id: str = os.getenv("AGNO_MODEL_ID") or os.getenv("OPENROUTER_MODEL") or os.getenv("AI_MODEL", "")
    allowed_models: tuple[str, ...] = tuple(item.strip() for item in (os.getenv("AGNO_ALLOWED_MODELS") or os.getenv("OPENROUTER_ALLOWED_MODELS", "")).split(",") if item.strip())
    model_api_key: str = os.getenv("AGNO_MODEL_API_KEY") or os.getenv("OPENROUTER_API_KEY") or os.getenv("AI_API_KEY", "")
    model_base_url: str = (os.getenv("AGNO_MODEL_BASE_URL") or os.getenv("AI_BASE_URL") or "https://openrouter.ai/api/v1").rstrip("/")
    model_name: str = os.getenv("AGNO_MODEL_NAME", "OpenRouter")
    service_api_key: str = os.getenv("AGNO_SERVICE_API_KEY") or os.getenv("ASSISTANT_GATEWAY_TOKEN", "")
    internal_service_token: str = os.getenv("INTERNAL_TOOL_SERVICE_TOKEN", "")


settings = Settings()


def validate_model_settings() -> None:
    free_model = re.compile(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.:-]+:free$")
    if not settings.model_api_key or not settings.model_id or not settings.allowed_models:
        raise RuntimeError("Agno model configuration is incomplete")
    if settings.model_id not in settings.allowed_models or any(not free_model.fullmatch(model) for model in settings.allowed_models):
        raise RuntimeError("Only explicitly allowlisted free models are permitted")
