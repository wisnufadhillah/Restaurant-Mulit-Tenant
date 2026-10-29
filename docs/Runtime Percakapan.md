# Runtime Percakapan

Modul conversation_runner.py menjalankan satu agent Agno dengan tools get_restaurant_info dan search_menu. Tenant, header service, signature konteks dan sesi diberikan aplikasi server, bukan argumen tool/model. API tujuan tetap loopback dan route internal allowlisted; tidak ada DB bisnis pada Python.

Satu turn dibatasi 30 detik, tiga inference request, tiga tool call dan output 512 token per request. Routing model hanya allowlist varian gratis yang divalidasi. Retry provider dimatikan; tidak ada fallback berbayar. Tool membaca respons maksimal 64 KiB dan memvalidasi profil/menu sebelum menyerahkan data ke model maupun kartu UI.

Hasil berisi status, message, cards dan attempted_requests. Kartu berasal hasil tool tervalidasi, bukan JSON karangan model. Kegagalan tool/provider/budget mengosongkan kartu dan memberi fallback. Agent tidak mempunyai write tools, SQL, shell, booking privat atau kemampuan membatalkan reservasi.

```sh
rtk proxy uv run --project apps/assistant --locked python -m unittest discover -s apps/assistant -p test_conversation_runner.py
```

Tes memakai model dan API transport stub deterministik: model meminta menu, hasil card sesuai harga tool, service credential tidak masuk payload inference, serta 429 memberi fallback. Tidak menggunakan kuota atau memanggil provider live. Error log sintetis dari SDK pada kasus 429 bukan pesan provider nyata.

## Batas

Service HTTP loopback conversation_server.py tersedia pada port 8001, POST /turn, dengan ASSISTANT_GATEWAY_TOKEN minimal 32 karakter. Gateway NestJS /api/v1/chat/messages memverifikasi Origin dan cookie sesi, hanya menerima message, menyamarkan email/nomor/nilai token panjang, membatasi lima turn per menit per sesi dan satu turn aktif. Response ke UI memakai input tersamarkan; raw input tidak dipersist. Masking bukan jaminan privasi sempurna: hanya data sintetis untuk demo.

Jalankan service dengan konfigurasi privat apps/assistant/.env yang berisi nama variabel OPENROUTER_MODEL, OPENROUTER_ALLOWED_MODELS, OPENROUTER_API_KEY, ASSISTANT_GATEWAY_TOKEN dan INTERNAL_TOOL_SERVICE_TOKEN. Gateway API memakai ASSISTANT_GATEWAY_TOKEN yang sama serta INTERNAL_CONTEXT_SECRET dan INTERNAL_TOOL_SERVICE_TOKEN. Jangan menyalin nilainya ke docs/chat. Tidak ada credential otomatis diprovision pada perubahan ini.

```sh
rtk proxy uv run --project apps/assistant --locked python apps/assistant/conversation_server.py
```

Widget memiliki input percakapan bebas yang meneruskan ke Next.js /chat/messages. Kartu katalog manual tetap tersedia tanpa model. Kartu hasil turn Python kini divalidasi ulang gateway Node: hanya menu/profil publik bounded, tipe tak dikenal dan field privat menu ditolak. Widget merender kartu menu/profil dari hasil tersebut tanpa raw HTML. Pemicu chat fixed pada pojok kanan bawah dengan safe-area; panel desktop muncul di atas pemicu, mobile memakai inset 12px. Health service tidak mengklaim model siap. SDK stdout/stderr ditahan pada proses server agar prompt/provider detail tidak masuk log. Tidak ada retry otomatis atau inference live dijalankan dalam verifikasi ini. Pemulihan sesi menyediakan tombol Mulai sesi baru: DELETE dengan Origin terpercaya bersifat idempotent, mencabut token valid jika ada dan menghapus cookie stale sebelum membuat sesi baru. Riwayat/kartu UI dibersihkan hanya pada tindakan eksplisit tersebut.

Tes service Python kini membuka HTTPServer loopback sungguhan pada port acak, memeriksa service token invalid 401 dan turn bound berhasil dengan runner stub. Suite conversation-http.integration.cjs juga menjalankan proses Python HTTP sebenarnya pada port acak dan gateway NestJS sebenarnya; hanya runner model/tools diganti fixture deterministik. Redaksi input, penerusan kartu dan fallback exception lintas proses lulus. Fixture tidak membaca .env, tidak memakai provider, dan tidak dianggap bukti fakta restoran live. Ini belum seluruh tiga proses FE/API/assistant dengan inference nyata. Belum ada history multi-turn pada model; daftar percakapan UI terbatas 20 pesan dan hilang saat refresh. Sesi in-memory hilang saat API restart. Status model/provider gratis aktual dan seluruh alur HTTP tiga service perlu smoke test terpisah yang diizinkan. Jangan membuka endpoint ke customer nyata.

## Diagnosis aman

Respons turn menyediakan attempted_requests (0–3) dan diagnostics maksimal delapan entry. Setiap entry hanya category allowlisted, http_status numerik/null, limit_scope enum, dan indikator numerik Retry-After/rate-limit bila provider mengirimkannya. Nilai header nonnumerik dan field bebas tidak diteruskan. Tidak ada prompt, header, body error provider, model key atau cookie. rate_limited/429 berarti provider membatasi request; tool_http_error menunjukkan status API internal; tool_invalid_response berarti schema tool gagal. Gateway memfilter ulang metadata, bukan meneruskan field bebas Python. Restart API dan Python setelah perubahan runtime sebelum smoke test baru. Metadata membantu isolasi kegagalan, tidak membuktikan akar penyebab tanpa hasil request aktual.

## Sources

- [Agno Tools](https://docs.agno.com/agents/tools)
