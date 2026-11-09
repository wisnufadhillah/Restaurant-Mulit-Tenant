import asyncio
import logging
import re
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import HTMLResponse

from .agent import build_agent
from .config import settings
from .schemas import ChatRequest, ChatResponse, GatewayRequest
from .playground import SCENARIOS, evaluate, execute_playground, store
from .playground_ui import HTML

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
    if value != settings.service_api_key:
        raise HTTPException(status_code=401, detail="Invalid service API key")


async def run_gateway(request: GatewayRequest) -> dict:
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", request.sessionId):
        raise HTTPException(status_code=400, detail="Invalid session")
    cards: list[dict] = []

    def on_tool(name: str, _arguments: dict, result: dict) -> None:
        if len(cards) >= 3:
            return
        data = result.get("data")
        if name == "search_menu" and isinstance(data, list):
            cards.append({"type": "menu", "data": data[:100]})
        elif name == "get_restaurant_info" and isinstance(data, dict):
            cards.append({"type": "restaurant", "data": data})
        elif name == "search_knowledge" and isinstance(data, list):
            cards.append({"type": "knowledge", "data": data[:3]})

    try:
        headers = {"x-internal-context": request.context, "x-session-id": request.sessionId}
        agent = build_agent(request.tenantSlug, headers, on_tool)
        result = await agent.arun(request.message, session_id=request.sessionId)
    except Exception:
        return {"status": "unavailable", "message": "Asisten belum tersedia. Silakan gunakan halaman restoran atau coba lagi nanti.", "cards": [], "actions": build_actions(request.message, [], "unavailable"), "attempted_requests": 0, "diagnostics": []}
    content = result.content if isinstance(result.content, str) else str(result.content)
    return {"status": "ok", "message": content[:8000], "cards": cards, "actions": build_actions(request.message, cards, "ok"), "attempted_requests": 1, "diagnostics": []}


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "agno-v2"}


@app.get("/playground", response_class=HTMLResponse)
async def playground() -> str:
    return HTML


@app.get("/api/playground/scenarios")
async def scenarios() -> list[dict]:
    return SCENARIOS


@app.get("/api/playground/runs")
async def runs() -> dict[str, list[dict]]:
    return {"runs": store.list()}


@app.post("/api/playground/chat")
async def playground_chat(request: dict) -> dict:
    message = str(request.get("message", "")).strip()
    if not message:
        raise HTTPException(status_code=400, detail="message wajib diisi")
    run = store.create(message)
    try:
        await execute_playground(message, run, request.get("session_id"))
    except Exception as exc:
        return {**run.as_dict(), "error": str(exc)}
    return run.as_dict()


@app.post("/api/playground/scenarios/run")
async def scenario_run(request: dict) -> dict:
    scenario = next((item for item in SCENARIOS if item["id"] == request.get("scenario_id")), None)
    if scenario is None:
        raise HTTPException(status_code=404, detail="scenario tidak ditemukan")
    run = store.create(scenario["message"], scenario["id"])
    try:
        await execute_playground(run.message, run)
    except Exception:
        pass
    run.evaluation = evaluate(run, scenario)
    return run.as_dict()


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
    try:
        return await asyncio.wait_for(run_gateway(request), timeout=30.0)
    except asyncio.TimeoutError:
        return {"status": "timeout", "message": "Asisten belum selesai memproses pertanyaan. Silakan coba lagi atau gunakan halaman restoran.", "cards": [], "actions": build_actions(request.message, [], "timeout"), "attempted_requests": 0, "diagnostics": [{"category": "timeout", "http_status": None}]}
