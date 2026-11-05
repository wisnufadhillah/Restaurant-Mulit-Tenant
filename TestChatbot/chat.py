"""Interactive live chatbot simulator; it never writes to the business database."""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / "apps" / "assistant" / ".env"
MODEL_URL = "https://openrouter.ai/api/v1/chat/completions"
MAX_TURNS = 3

TENANTS = {
    "demo-padang": {
        "name": "Restoran Padang Demo",
        "address": "Alamat sintetis untuk pengujian",
        "timezone": "Asia/Jakarta",
        "hours": "Setiap hari pukul 10.00-21.30 WIB",
        "menu": [
            {"name": "Rendang Demo", "category": "utama", "price": 32000, "available": True},
            {"name": "Ayam Pop Demo", "category": "utama", "price": 26000, "available": True},
            {"name": "Teh Talua Demo", "category": "minuman", "price": 22000, "available": True},
        ],
        "tables": [{"table": "Meja 01", "capacity": 2}, {"table": "Meja 02", "capacity": 4}],
    },
    "demo-keluarga": {
        "name": "Restoran Keluarga Demo",
        "address": "Alamat sintetis untuk pengujian",
        "timezone": "Asia/Jakarta",
        "hours": "Setiap hari pukul 10.00-21.30 WIB",
        "menu": [
            {"name": "Rendang Keluarga Demo", "category": "utama", "price": 31000, "available": True},
            {"name": "Ayam Keluarga Demo", "category": "utama", "price": 25000, "available": True},
            {"name": "Teh Keluarga Demo", "category": "minuman", "price": 21000, "available": True},
        ],
        "tables": [{"table": "Meja 01", "capacity": 2}, {"table": "Meja 02", "capacity": 4}],
    },
}


def load_env(path: Path = ENV_FILE) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    values.update({key: value for key, value in os.environ.items() if key.startswith("OPENROUTER_")})
    return values


def model_settings() -> tuple[str, str]:
    env = load_env()
    model = env.get("OPENROUTER_MODEL", "")
    allowed = {item.strip() for item in env.get("OPENROUTER_ALLOWED_MODELS", "").split(",") if item.strip()}
    if not model or model not in allowed or not model.endswith(":free") or not env.get("OPENROUTER_API_KEY"):
        raise RuntimeError("Konfigurasi model gratis tidak lengkap atau model tidak diizinkan.")
    return model, env["OPENROUTER_API_KEY"]


def mask_private(text: str) -> str:
    text = re.sub(r"(?:\+?62|0)\d[\d -]{7,14}\d", "[TELEPON DISEMBUNYIKAN]", text)
    return re.sub(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "[EMAIL DISEMBUNYIKAN]", text)


IN_SCOPE_TERMS = ("restoran", "rumah makan", "menu", "harga", "jam buka", "lokasi", "alamat", "meja", "tersedia", "availability", "reservasi", "booking", "tamu", "orang")
OUT_OF_SCOPE_TERMS = ("coffee shop", "coffe shop", "kedai kopi", "landing page", "html", "javascript", "system prompt", "api key", "password", "sql", "shell", "ignore previous", "abaikan aturan", "model apa", "model yang dipakai", "siapa kamu")
FACT_REQUEST_TERMS = ("menu", "harga", "jam", "buka", "lokasi", "alamat", "meja", "tersedia", "availability", "reservasi", "booking", "restoran")


def is_in_scope(text: str) -> bool:
    lowered = text.casefold()
    if any(term in lowered for term in OUT_OF_SCOPE_TERMS):
        return False
    if any(term in lowered for term in IN_SCOPE_TERMS):
        return True
    return lowered.strip() in {"halo", "hai", "hallo", "selamat pagi", "selamat siang", "selamat malam"}


def requires_tool(text: str) -> bool:
    lowered = text.casefold()
    return any(term in lowered for term in FACT_REQUEST_TERMS)


def _money_values(text: str) -> set[int]:
    return {int(value.replace(".", "").replace(" ", "")) for value in re.findall(r"Rp\s*([\d. ]+)", text, flags=re.IGNORECASE)}


def validate_output(user_text: str, answer: str, tool_results: list[dict[str, Any]]) -> bool:
    lowered = answer.casefold()
    if not answer.strip() or "```" in answer or "<html" in lowered or "<script" in lowered:
        return False
    if any(term in lowered for term in ("reservasi berhasil", "booking berhasil", "sudah dipesan", "telah dibuat")):
        return False
    if requires_tool(user_text) and not tool_results:
        return False
    for item in tool_results:
        result = item["result"]
        if item["name"] == "search_menu":
            expected_prices = {entry["price"] for entry in result.get("items", [])}
            if not _money_values(answer).issubset(expected_prices):
                return False
        if item["name"] == "check_availability":
            if result.get("available") is False and re.search(r"\b(tersedia|ada meja|bisa dipesan)\b", lowered):
                return False
        if item["name"] == "prepare_reservation" and result.get("write_performed") is not False:
            return False
    return True


def validate_args(name: str, args: Any) -> dict[str, Any]:
    if not isinstance(args, dict):
        raise ValueError("Parameter tool harus berupa object.")
    if name == "get_restaurant_info":
        if args:
            raise ValueError("Tool info restoran tidak menerima parameter.")
        return {}
    if name == "search_menu":
        query = args.get("query", "")
        if not isinstance(query, str) or len(query) > 100:
            raise ValueError("Query menu tidak valid.")
        return {"query": query.strip()}
    if name == "check_availability":
        required = {"date", "time", "pax"}
        if set(args) != required or not isinstance(args["date"], str) or not isinstance(args["time"], str):
            raise ValueError("Availability membutuhkan date, time, dan pax.")
        if not isinstance(args["pax"], int) or not 1 <= args["pax"] <= 12:
            raise ValueError("Jumlah tamu harus 1 sampai 12.")
        datetime.strptime(f"{args['date']} {args['time']}", "%Y-%m-%d %H:%M")
        return args
    if name == "prepare_reservation":
        clean = validate_args("check_availability", args)
        return clean
    raise ValueError("Tool tidak diizinkan.")


def run_tool(name: str, args: dict[str, Any], tenant: str) -> dict[str, Any]:
    data = TENANTS[tenant]
    if name == "get_restaurant_info":
        return {"tenant": tenant, "name": data["name"], "address": data["address"], "hours": data["hours"], "timezone": data["timezone"]}
    if name == "search_menu":
        query = args["query"].lower()
        items = [item for item in data["menu"] if not query or query in item["name"].lower() or query in item["category"]]
        return {"tenant": tenant, "items": items}
    if name in {"check_availability", "prepare_reservation"}:
        requested = args["pax"]
        available = next((table for table in data["tables"] if table["capacity"] >= requested), None)
        hour, minute = map(int, args["time"].split(":"))
        within_hours = 10 * 60 <= hour * 60 + minute and hour * 60 + minute + 90 <= 21 * 60 + 30
        result = {"tenant": tenant, **args, "available": bool(available and within_hours), "duration_minutes": 90}
        if available and within_hours:
            result["table"] = available["table"]
            result["end_time"] = f"{(hour * 60 + minute + 90) // 60:02d}:{(hour * 60 + minute + 90) % 60:02d}"
        if name == "prepare_reservation":
            result["proposal_id"] = f"proposal-{uuid.uuid4().hex[:10]}"
            result["write_performed"] = False
        return result
    raise ValueError("Tool tidak diizinkan.")


TOOL_DEFINITIONS = [
    {"type": "function", "function": {"name": "get_restaurant_info", "description": "Ambil profil dan jam operasional restoran.", "parameters": {"type": "object", "properties": {}, "additionalProperties": False}}},
    {"type": "function", "function": {"name": "search_menu", "description": "Cari menu dan harga terkini.", "parameters": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"], "additionalProperties": False}}},
    {"type": "function", "function": {"name": "check_availability", "description": "Cek meja untuk tanggal YYYY-MM-DD, waktu HH:MM, dan jumlah tamu.", "parameters": {"type": "object", "properties": {"date": {"type": "string"}, "time": {"type": "string"}, "pax": {"type": "integer"}}, "required": ["date", "time", "pax"], "additionalProperties": False}}},
    {"type": "function", "function": {"name": "prepare_reservation", "description": "Buat proposal reservasi saja; tidak melakukan booking.", "parameters": {"type": "object", "properties": {"date": {"type": "string"}, "time": {"type": "string"}, "pax": {"type": "integer"}}, "required": ["date", "time", "pax"], "additionalProperties": False}}},
]


def call_model(messages: list[dict[str, Any]], model: str, api_key: str) -> dict[str, Any]:
    body = json.dumps({"model": model, "messages": messages, "tools": TOOL_DEFINITIONS, "tool_choice": "auto", "temperature": 0.2, "max_tokens": 512}).encode()
    request = Request(MODEL_URL, data=body, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, method="POST")
    try:
        with urlopen(request, timeout=30) as response:
            return json.loads(response.read(2_000_000))
    except (HTTPError, URLError, TimeoutError, OSError, json.JSONDecodeError) as error:
        raise RuntimeError(f"Model tidak tersedia: {type(error).__name__}") from None


def run_turn(user_text: str, state: dict[str, Any], model: str, api_key: str, tenant: str, trace: list[dict[str, Any]]) -> str:
    safe_text = mask_private(user_text)
    turn = {"input": safe_text, "tool": None, "args_valid": None, "success": False}
    if not is_in_scope(user_text):
        trace.append({**turn, "scope_allowed": False, "outcome": "refused", "success": True})
        return "Maaf, saya hanya dapat membantu informasi dan simulasi reservasi restoran ini."
    messages = state.setdefault("messages", [{"role": "system", "content": "Kamu adalah asisten restoran. Jawab Bahasa Indonesia. Fakta menu, harga, jam, dan availability wajib melalui tool. Jangan mengaku booking berhasil; hanya buat proposal. Jika data kurang, tanya balik."}])
    tool_results: list[dict[str, Any]] = []
    messages.append({"role": "user", "content": safe_text})
    for _ in range(MAX_TURNS):
        response = call_model(messages, model, api_key)
        message = response.get("choices", [{}])[0].get("message", {})
        tool_calls = message.get("tool_calls") or []
        messages.append(message)
        if not tool_calls:
            answer = str(message.get("content") or "Model tidak menghasilkan jawaban.")
            turn["scope_allowed"] = True
            turn["grounded"] = validate_output(user_text, answer, tool_results)
            turn["output_valid"] = turn["grounded"]
            turn["success"] = turn["output_valid"]
            trace.append(turn)
            return answer if turn["output_valid"] else "Maaf, saya belum dapat memastikan jawaban itu dari data restoran. Silakan coba pertanyaan yang lebih spesifik."
        for call in tool_calls:
            function = call.get("function", {})
            name = function.get("name", "")
            try:
                args = json.loads(function.get("arguments", "{}"))
                clean_args = validate_args(name, args)
                result = run_tool(name, clean_args, tenant)
                turn["tool"] = name
                turn["args_valid"] = True
                tool_results.append({"name": name, "result": result})
            except (ValueError, TypeError, json.JSONDecodeError):
                result = {"error": "Tool request ditolak karena parameter tidak valid."}
                turn["tool"] = name
                turn["args_valid"] = False
            messages.append({"role": "tool", "tool_call_id": call.get("id", "unknown"), "name": name, "content": json.dumps(result, ensure_ascii=False)})
    turn["error"] = "tool_loop_limit"
    trace.append(turn)
    return "Maaf, proses terlalu panjang. Silakan coba dengan pertanyaan yang lebih spesifik."


def print_metrics(trace: list[dict[str, Any]]) -> None:
    total = len(trace)
    successes = sum(item.get("success") is True for item in trace)
    valid_tools = [item for item in trace if item.get("tool")]
    valid = sum(item.get("args_valid", False) for item in valid_tools)
    print(json.dumps({"turns": total, "task_success_rate": successes / total if total else None, "tool_argument_valid_rate": valid / len(valid_tools) if valid_tools else None, "trace": trace}, ensure_ascii=False, indent=2))


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    parser = argparse.ArgumentParser(description="Simulator chatbot restoran live")
    parser.add_argument("--tenant", choices=sorted(TENANTS), default="demo-padang")
    args = parser.parse_args()
    try:
        model, api_key = model_settings()
    except RuntimeError as error:
        print(str(error), file=sys.stderr)
        return 2
    state: dict[str, Any] = {}
    trace: list[dict[str, Any]] = []
    print(f"Chatbot live siap untuk {TENANTS[args.tenant]['name']} dengan model {model}.")
    print("Perintah: /metrics, /reset, /quit. Reservasi hanya proposal simulasi.")
    while True:
        try:
            text = input("Anda> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not text:
            continue
        if text == "/quit":
            break
        if text == "/metrics":
            print_metrics(trace)
            continue
        if text == "/reset":
            state = {}
            print("Sesi direset.")
            continue
        try:
            print("Bot>", run_turn(text, state, model, api_key, args.tenant, trace))
        except RuntimeError as error:
            trace.append({"input": mask_private(text), "success": False, "error": str(error)})
            print("Bot>", error)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
