# AI Restaurant Chatbot V2 — Agno

Service chatbot berbasis Python, FastAPI, dan Agno. Gateway memakai ulang bounded conversation core di `apps/assistant`; folder tersebut tetap dibutuhkan saat packaging. HTTP server lama tetap tersedia untuk rollback, bukan runtime kedua yang dijalankan bersama.

Gateway production memakai internal API yang sudah terikat tenant dan sesi:

- `GET /api/v1/internal/tenants/:slug/restaurant`
- `GET /api/v1/internal/tenants/:slug/menu`
- `GET /api/v1/internal/tenants/:slug/knowledge?q=...`

Tenant, sesi, dan konteks tidak dipercaya dari model atau browser. API bisnis menerbitkan context yang ditandatangani dan memverifikasinya pada setiap tool call.

## Menjalankan

Dari root workspace, siapkan konfigurasi privat dari template tanpa mencetak credential.

```sh
rtk proxy uv sync --project agno-v2 --locked --python 3.12
rtk proxy uv run --project agno-v2 --locked uvicorn app.main:app --app-dir agno-v2 --host 127.0.0.1 --port 8010 --no-access-log
rtk proxy uv run --project agno-v2 --locked python -m unittest discover -s agno-v2 -p "test_*.py"
```

Production hanya menyediakan health dan gateway terautentikasi. Playground dijalankan terpisah, dengan mock deterministik tanpa model, credential, internal API, atau inference:

```sh
rtk proxy uv run --project agno-v2 --locked uvicorn app.playground_server:app --app-dir agno-v2 --host 127.0.0.1 --port 8011 --no-access-log
```

Buka `http://127.0.0.1:8011/playground`. Simulator hanya untuk data sintetis lokal, bukan bukti kualitas model. Store dibatasi 100 run dan hilang ketika proses berhenti. Jangan expose service simulator ke jaringan publik.

Set `AGNO_MODEL_API_KEY`, `AGNO_MODEL_ID`, dan `AGNO_ALLOWED_MODELS` secara privat. Semua ID model wajib memiliki suffix `:free`, dan model aktif harus tercantum dalam allowlist. Endpoint model dibatasi ke OpenRouter. Runtime membatasi maksimal tiga inference request, tiga tool call, output, dan deadline 30 detik; retry model dinonaktifkan. Jumlah request aktual serta kategori kegagalan dipertahankan. Fakta tanpa bukti menghasilkan abstention; tool gagal tidak menjadi jawaban sukses.

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

## Pengujian browser

Panduan command, batas stub versus PostgreSQL nyata, hasil lokal dan pemeriksaan yang belum dijalankan tersedia di [Pengujian chatbot lokal](../docs/Pengujian%20Chatbot%20Lokal.md).

## Status

Chatbot lama sekarang dapat diarahkan ke gateway ini melalui `ASSISTANT_ORIGIN=http://127.0.0.1:8010`. UI dan endpoint `/chat/*` tetap tidak berubah.
Chatbot production dapat membaca availability tanpa menahan meja. Ia tidak memiliki tool tulis: proposal, konfirmasi reservasi, pembayaran, dan admin tetap berjalan melalui form web privat serta API bisnis.
