from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from .playground_tools import build_playground_tools


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class TraceEvent:
    type: str
    at: str
    data: dict[str, Any] = field(default_factory=dict)


@dataclass
class PlaygroundRun:
    run_id: str
    message: str
    scenario_id: str | None = None
    status: str = "RUNNING"
    response: str | None = None
    events: list[TraceEvent] = field(default_factory=list)
    evaluation: dict[str, Any] | None = None
    created_at: str = field(default_factory=now)

    def event(self, event_type: str, **data: Any) -> None:
        self.events.append(TraceEvent(event_type, now(), data))

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


SCENARIOS = [
    {"id": "menu-question", "name": "Pertanyaan menu", "message": "Apa menu makanan yang tersedia?", "expects_tool": "get_restaurant_data", "description": "Agent harus memakai data mock."},
]


class PlaygroundStore:
    def __init__(self) -> None:
        self.runs: dict[str, PlaygroundRun] = {}

    def create(self, message: str, scenario_id: str | None = None) -> PlaygroundRun:
        run = PlaygroundRun(str(uuid4()), message, scenario_id)
        if len(self.runs) >= 100:
            del self.runs[next(iter(self.runs))]
        self.runs[run.run_id] = run
        return run

    def list(self) -> list[dict[str, Any]]:
        return [run.as_dict() for run in reversed(list(self.runs.values()))]


store = PlaygroundStore()


async def execute_playground(message: str, run: PlaygroundRun, session_id: str | None = None) -> PlaygroundRun:
    run.event("agent.started", message=message)
    tools = build_playground_tools(
        on_tool_start=lambda name, args: run.event("tool.started", tool=name, arguments=args),
        on_tool_end=lambda name, result: run.event("tool.finished", tool=name, result=result),
    )
    # This simulator never imports production settings, model clients or API tools.
    run.response = 'Simulasi mock tanpa inference. Data contoh: ' + tools[0]()
    run.event("response.created", content=run.response)
    run.status = "COMPLETED"
    return run


def evaluate(run: PlaygroundRun, scenario: dict[str, Any]) -> dict[str, Any]:
    actual = [e.data.get("tool") for e in run.events if e.type == "tool.started"]
    expected = scenario["expects_tool"]
    if run.status != "COMPLETED":
        status, reason = "REVIEW", "Agent gagal dijalankan; periksa trace dan konfigurasi model."
    elif expected in actual:
        status, reason = "PASS", f"Tool {expected} dipanggil."
    else:
        status, reason = "FAIL", f"Tool yang diharapkan: {expected}; aktual: {actual or 'tidak ada'}."
    return {"status": status, "reason": reason, "expected_tool": expected, "actual_tools": actual}
