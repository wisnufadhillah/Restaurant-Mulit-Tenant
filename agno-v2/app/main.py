import logging
import hmac
import re
from fastapi import FastAPI, Header, HTTPException

from .runtime import run_turn
from .config import settings
from .schemas import ChatRequest, ChatResponse, GatewayRequest

app = FastAPI(title="AI Restaurant Chatbot V2 — Agno", version="0.1.0")
for _logger_name in ("agno", "agno.tools", "agno.tools.function"):
    logging.getLogger(_logger_name).disabled = True


def build_actions(message: str, cards: list[dict], status: str) -> list[dict[str, str]]:
    """Build allowlisted UI actions from application context, never model text."""
    text = message.casefold()
    actions: list[dict[str, str]] = []

    def add(action: dict[str, str]) -> None:
        if action["id"] not in {item["id"] for item in actions} and len(actions) < 3:
            actions.append(action)

    if any(word in text for word in ("reservasi", "booking", "pesan meja", "meja")):
        add({"id": "reservation-form", "type": "navigate", "label": "Buka form reservasi", "target": "#reservasi"})
    if any(card.get("type") == "menu" for card in cards) or any(word in text for word in ("menu", "harga", "makanan", "minuman")):
        add({"id": "menu-section", "type": "navigate", "label": "Lihat menu lengkap", "target": "#menu"})
    if any(word in text for word in ("jam buka", "buka jam", "operasional", "kapan buka")):
        add({"id": "opening-hours", "type": "prompt", "label": "Tanya jam buka", "message": "Jam buka hari ini kapan?"})
    if any(card.get("type") == "knowledge" for card in cards):
        add({"id": "restaurant-policy", "type": "prompt", "label": "Tanya kebijakan lain", "message": "Apa kebijakan restoran lain yang perlu saya tahu?"})
    if status != "ok" and not actions:
        add({"id": "reservation-form", "type": "navigate", "label": "Buka form reservasi", "target": "#reservasi"})
    return actions


def require_service_key(value: str | None) -> None:
    if len(settings.service_api_key) < 32:
        raise HTTPException(status_code=503, detail="Agno service authentication is not configured")
    if value is None or len(value) > 1024 or not hmac.compare_digest(value.encode(), settings.service_api_key.encode()):
        raise HTTPException(status_code=401, detail="Invalid service API key")


async def run_gateway(request: GatewayRequest, *, model_settings=None, model_transport=None, api_transport=None) -> dict:
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", request.sessionId):
        raise HTTPException(status_code=400, detail="Invalid session")
    try:
        result = await run_turn(request, model_settings_override=model_settings,
            model_transport=model_transport, api_transport=api_transport)
    except Exception:
        result = {"status": "unavailable", "message": "Asisten belum tersedia. Silakan gunakan halaman restoran atau coba lagi nanti.", "cards": [], "attempted_requests": 0, "diagnostics": []}
    result["actions"] = build_actions(request.message, result["cards"], result["status"])
    return result


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "agno-v2"}


@app.post("/v2/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    x_agno_api_key: str | None = Header(default=None),
) -> ChatResponse:
    require_service_key(x_agno_api_key)

    raise HTTPException(status_code=410, detail="Use the authenticated /turn gateway")


@app.post("/turn")
async def turn(
    request: GatewayRequest,
    x_assistant_service_token: str | None = Header(default=None),
) -> dict:
    require_service_key(x_assistant_service_token)
    return await run_gateway(request)
