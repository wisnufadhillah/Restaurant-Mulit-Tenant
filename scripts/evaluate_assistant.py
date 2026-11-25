"""Bounded evaluator for 30 restaurant assistant scenarios (offline deterministic & live OpenRouter)."""
import argparse
import asyncio
from datetime import datetime, timezone
import json
import logging
from pathlib import Path
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "apps/assistant"))

import httpx
from agent_factory import ModelSettings
from conversation_runner import run_conversation
from private_config import load_model_settings

FIXTURE_RESTAURANT = {
    "data": {
        "slug": "demo-padang",
        "name": "Restoran Padang Demo",
        "outlets": [{
            "name": "Cabang Sudirman",
            "address": "Jl. Jend. Sudirman No. 10, Jakarta",
            "contactPhone": "021-5550100",
            "timezone": "Asia/Jakarta",
            "durationMinutes": 90,
            "minNoticeMinutes": 60,
            "maxAdvanceDays": 30,
            "cancelCutoffMinutes": 120,
            "maxPartySize": 12,
            "weeklyHours": [{"weekday": d, "openMinute": 600, "closeMinute": 1320} for d in range(7)],
            "todayHours": {"weekday": 2, "date": "2026-11-25", "timezone": "Asia/Jakarta", "configured": True, "openMinute": 600, "closeMinute": 1320, "source": "weekly"},
        }],
    },
    "retrieved_at": "2026-11-25T07:00:00+00:00",
    "source": "restaurant_api",
}

FIXTURE_MENU = {
    "data": [
        {"id": "00000000-0000-4000-8000-000000000001", "name": "Rendang Sapi", "description": "Rendang daging sapi khas Padang", "price": 35000, "isAvailable": True},
        {"id": "00000000-0000-4000-8000-000000000002", "name": "Dendeng Balado", "description": "Dendeng sapi renyah sambal balado", "price": 38000, "isAvailable": True},
        {"id": "00000000-0000-4000-8000-000000000003", "name": "Ayam Pop", "description": "Ayam kampung ungkep khas Padang", "price": 28000, "isAvailable": True},
        {"id": "00000000-0000-4000-8000-000000000004", "name": "Gulai Tunjang", "description": "Gulai kikil sapi", "price": 32000, "isAvailable": False},
        {"id": "00000000-0000-4000-8000-000000000005", "name": "Es Teh Manis", "description": "Teh manis dingin", "price": 8000, "isAvailable": True},
    ],
    "source": "restaurant_api",
}

FIXTURE_KNOWLEDGE = [
    {"documentId": "10000000-0000-4000-8000-000000000001", "revision": 1, "title": "Parkir", "position": 0, "text": "Area parkir tersedia gratis untuk tamu restoran di halaman depan."},
    {"documentId": "10000000-0000-4000-8000-000000000002", "revision": 1, "title": "Halal", "position": 0, "text": "Seluruh bahan dan menu kami bersertifikasi halal."},
    {"documentId": "10000000-0000-4000-8000-000000000003", "revision": 1, "title": "Kue Ulang Tahun", "position": 0, "text": "Tamu diperbolehkan membawa kue ulang tahun dari luar dengan pemberitahuan."},
    {"documentId": "10000000-0000-4000-8000-000000000004", "revision": 1, "title": "Pembatalan Reservasi", "position": 0, "text": "Pembatalan reservasi mandiri dapat dilakukan melalui form web maksimal 2 jam sebelum jadwal."},
]


def make_api_transport(scenario_category: str):
    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path.endswith("/restaurant"):
            return httpx.Response(200, json=FIXTURE_RESTAURANT)
        if path.endswith("/menu"):
            return httpx.Response(200, json=FIXTURE_MENU)
        if path.endswith("/knowledge"):
            q = (request.url.params.get("q") or "").lower()
            if scenario_category == "out_of_domain":
                return httpx.Response(200, json={"data": [], "source": "restaurant_knowledge"})
            matches = [k for k in FIXTURE_KNOWLEDGE if any(w in q for w in k["title"].lower().split())]
            if not matches and "batal" in q:
                matches = [FIXTURE_KNOWLEDGE[3]]
            if not matches and ("kue" in q or "luar" in q):
                matches = [FIXTURE_KNOWLEDGE[2]]
            return httpx.Response(200, json={"data": matches[:3], "source": "restaurant_knowledge"})
        if path.endswith("/availability"):
            party = int(request.url.params.get("partySize", "2"))
            avail = party <= 8
            data = {
                "startAt": "2026-12-01T11:30:00.000Z",
                "endAt": "2026-12-01T13:00:00.000Z",
                "timezone": "Asia/Jakarta",
                "held": False,
                "available": avail,
            }
            if not avail:
                data["reason"] = "NO_TABLE_CAPACITY"
            return httpx.Response(200, json={"data": data, "source": "restaurant_api", "retrieved_at": "2026-11-25T07:00:00Z"})
        return httpx.Response(404, json={"error": "not_found"})
    return httpx.MockTransport(handler)


def make_offline_model_transport(scenario: dict):
    def handler(request: httpx.Request) -> httpx.Response:
        payload = json.loads(request.content.decode("utf-8"))
        messages = payload.get("messages", [])
        last_role = messages[-1]["role"] if messages else ""
        cat = scenario["category"]
        sid = scenario["id"]

        if last_role == "user":
            if cat == "injection_redteam":
                reply = "Maaf, saya tidak dapat menjalankan perintah tersebut. Saya hanya membantu informasi menu, jam buka, dan mengarahkan ke form reservasi di website."
                return httpx.Response(200, json={"id": "off-1", "choices": [{"message": {"role": "assistant", "content": reply}, "finish_reason": "stop"}]})
            tool_name = {
                "G01": "get_restaurant_info", "G02": "get_restaurant_info",
                "G03": "search_menu", "G04": "search_menu", "G05": "search_menu", "G10": "search_menu",
                "G06": "search_knowledge", "G07": "search_knowledge", "G08": "search_knowledge", "G09": "search_knowledge",
                "O01": "search_knowledge", "O02": "search_knowledge", "O03": "search_knowledge", "O04": "search_knowledge", "O05": "search_knowledge",
                "A01": "check_availability", "A02": "check_availability", "A03": "check_availability", "A04": "check_availability", "A05": "check_availability",
                "D01": "search_menu", "D02": "search_menu", "D03": "search_menu", "D04": "search_menu", "D05": "search_menu",
            }[sid]
            args = {}
            if tool_name == "search_knowledge":
                args = {"query": scenario["prompt"][:100]}
            elif tool_name == "check_availability":
                args = {"date": "2026-12-01", "time": "19:00", "party_size": 20 if sid == "A04" else 4}
            return httpx.Response(200, json={
                "id": "off-tc",
                "choices": [{
                    "message": {
                        "role": "assistant",
                        "content": None,
                        "tool_calls": [{"id": "call_1", "type": "function", "function": {"name": tool_name, "arguments": json.dumps(args)}}],
                    },
                    "finish_reason": "tool_calls",
                }],
            })

        # Tool result synthesis
        replies = {
            "G01": "Restoran Padang Demo berlokasi di Jl. Jend. Sudirman No. 10, Jakarta (Cabang Sudirman).",
            "G02": "Restoran Padang Demo buka setiap hari pukul 10:00 hingga 22:00 WIB.",
            "G03": "Harga Rendang Sapi adalah Rp 35.000 per porsi.",
            "G04": "Menu yang tersedia saat ini antara lain Rendang Sapi (Rp 35.000), Dendeng Balado (Rp 38.000), Ayam Pop (Rp 28.000), dan Es Teh Manis (Rp 8.000).",
            "G05": "Maaf, Gulai Tunjang saat ini sedang habis (tidak tersedia).",
            "G06": "Ya, area parkir tersedia gratis untuk tamu restoran di halaman depan sesuai FAQ resmi.",
            "G07": "Ya, seluruh bahan dan menu kami bersertifikasi halal sesuai FAQ resmi.",
            "G08": "Tamu diperbolehkan membawa kue ulang tahun dari luar dengan pemberitahuan sesuai kebijakan resmi.",
            "G09": "Pembatalan reservasi dapat dilakukan mandiri melalui form web maksimal 2 jam sebelum jadwal.",
            "G10": "Dendeng Balado tersedia dengan harga Rp 38.000.",
            "A01": "Meja tersedia untuk 4 orang. Meja belum ditahan; silakan lanjutkan melalui form reservasi di website.",
            "A02": "Meja tersedia pada 2026-12-01 pukul 12:00 untuk 2 orang. Silakan isi form reservasi di web.",
            "A03": "Meja tersedia untuk 6 orang pada jam tersebut. Lanjutkan pemesanan melalui form reservasi.",
            "A04": "Maaf, meja tidak tersedia karena kapasitas tidak mencukupi untuk 20 orang. Silakan cek opsi lain di form reservasi.",
            "A05": "Untuk membuat reservasi meja, silakan isi form reservasi pada website.",
            "D01": "Berikut draft usulan pesanan: 2x Rendang Sapi (Rp 35.000/porsi, total Rp 70.000). Lanjutkan checkout di UI pesanan.",
            "D02": "Draft usulan pesanan: 1x Dendeng Balado (Rp 38.000) dan 2x Es Teh Manis (Rp 8.000), total Rp 54.000.",
            "D03": "Maaf, Gulai Tunjang saat ini sedang habis (tidak tersedia) sehingga belum bisa dimasukkan ke pesanan.",
            "D04": "Draft usulan pesanan: 3x Ayam Pop (Rp 28.000/porsi, total Rp 84.000).",
            "D05": "Estimasi draft pesanan: 2x Rendang Sapi (Rp 70.000) + 1x Ayam Pop (Rp 28.000) = Rp 98.000.",
        }
        reply = replies.get(sid, "Maaf, informasi belum tersedia.")
        return httpx.Response(200, json={"id": "off-2", "choices": [{"message": {"role": "assistant", "content": reply}, "finish_reason": "stop"}]})

    return httpx.MockTransport(handler)


def evaluate_response(scenario: dict, result: dict) -> tuple[bool, list[str]]:
    reasons = []
    msg = (result.get("message") or "").lower()
    if result.get("status") not in ("ok", "partial"):
        reasons.append(f"status={result.get('status')}")
    must_any = scenario.get("must_contain_any", [])
    if must_any and not any(term.lower() in msg for term in must_any):
        reasons.append(f"missing_any:{must_any}")
    for forbidden in scenario.get("must_not_contain", []):
        if forbidden.lower() in msg:
            reasons.append(f"forbidden_present:{forbidden}")
    return len(reasons) == 0, reasons


async def main():
    logging.disable(logging.CRITICAL)
    parser = argparse.ArgumentParser()
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--offline", action="store_true")
    mode.add_argument("--allow-live", action="store_true")
    parser.add_argument("--delay", type=float, default=3.5)
    parser.add_argument("--limit", type=int, default=30)
    args = parser.parse_args()

    data = json.loads((ROOT / "apps/assistant/evaluation_scenarios.json").read_text(encoding="utf-8"))
    scenarios = data["scenarios"][: args.limit]
    headers = {"x-internal-service-token": "eval-service", "x-internal-context": "eval-context", "x-session-id": "eval-session"}

    if args.offline:
        settings = ModelSettings("example/offline-deterministic:free", ("example/offline-deterministic:free",), "synthetic-eval-key")
        provider = "offline_mock"
    else:
        settings = load_model_settings((ROOT / "apps/assistant/.env").resolve(), {})
        provider = "openrouter"

    results = []
    for idx, sc in enumerate(scenarios):
        if args.allow_live and idx > 0:
            await asyncio.sleep(args.delay)
        t0 = time.monotonic()
        model_tx = make_offline_model_transport(sc) if args.offline else httpx.AsyncHTTPTransport(retries=0)
        api_tx = make_api_transport(sc["category"])
        res = await run_conversation(sc["prompt"], settings, data["tenant_slug"], headers, api_transport=api_tx, model_transport=model_tx)
        passed, reasons = evaluate_response(sc, res)
        results.append({
            "id": sc["id"],
            "category": sc["category"],
            "status": res.get("status"),
            "attempted_requests": res.get("attempted_requests"),
            "passed": passed,
            "reasons": reasons,
            "latency_seconds": round(time.monotonic() - t0, 3),
        })

    by_cat = {}
    for r in results:
        c = by_cat.setdefault(r["category"], {"total": 0, "passed": 0})
        c["total"] += 1
        if r["passed"]:
            c["passed"] += 1

    summary = {
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "mode": "offline_deterministic" if args.offline else "live_openrouter",
        "provider": provider,
        "model": settings.model_id,
        "total": len(results),
        "passed": sum(1 for r in results if r["passed"]),
        "by_category": by_cat,
        "results": results,
    }
    out_path = ROOT / ".local/ai-evaluation-report.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in summary.items() if k != "results"}, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
