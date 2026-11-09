# AI Restaurant Chatbot V2 — Agno

Service chatbot berbasis Python, FastAPI, dan Agno. Playground tetap tersedia untuk eksperimen terisolasi.

Gateway production memakai internal API yang sudah terikat tenant dan sesi:

- `GET /api/v1/internal/tenants/:slug/restaurant`
- `GET /api/v1/internal/tenants/:slug/menu`
- `GET /api/v1/internal/tenants/:slug/knowledge?q=...`

Tenant, sesi, dan konteks tidak dipercaya dari model atau browser. API bisnis menerbitkan context yang ditandatangani dan memverifikasinya pada setiap tool call.

## Menjalankan

```powershell
cd agno-v2
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .
Copy-Item .env.example .env
uvicorn app.main:app --reload --port 8010
```

Set `AGNO_MODEL_API_KEY`, `AGNO_MODEL_ID`, dan `AGNO_ALLOWED_MODELS` secara privat. Semua ID model wajib memiliki suffix `:free`, dan model aktif harus tercantum dalam allowlist. Runtime membatasi tool call, retry, output, dan deadline per turn.

Gateway production menerima kontrak internal `/turn`:

```json
{
  "message": "Apa menu yang tersedia?",
  "tenantSlug": "demo-padang",
  "sessionId": "session-id-dari-api",
  "context": "context-bertanda-tangan-dari-api"
}
```

Caller API mengirim `X-Assistant-Service-Token`. Set nilai yang sama secara server-side pada `AGNO_SERVICE_API_KEY` dan `ASSISTANT_GATEWAY_TOKEN`. `INTERNAL_TOOL_SERVICE_TOKEN` harus sama dengan secret API bisnis.

## Status

Chatbot lama sekarang dapat diarahkan ke gateway ini melalui `ASSISTANT_ORIGIN=http://127.0.0.1:8010`. UI dan endpoint `/chat/*` tetap tidak berubah.
Chatbot production hanya read-only: tidak ada availability, proposal, reservasi, pembayaran, atau tool admin. Reservasi tetap melalui form web privat.
