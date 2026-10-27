# Setup Lokal

## Kondisi layanan

Web Next.js dan API NestJS sudah memiliki skeleton yang dapat dibangun. Assistant Python baru menyediakan health dan dependency Agno; belum menerima chat atau melakukan inference. Endpoint health bukan bukti database atau model sudah siap.

## PostgreSQL melalui Docker

Compose mengelola satu container `multi-tenant`: image `pgvector/pgvector:0.8.1-pg17`, host `127.0.0.1`, port host `55432`, port container `5432`, volume `multi-tenant_postgres_data`. Database dan role lokal bernama `restaurant`. PostgreSQL 17.8 terverifikasi lewat psql; tabel tenants/outlets dan migrasi dasar sudah tersedia, dengan dua tenant/outlet sintetis. Image menyediakan pgvector, tetapi extension belum diaktifkan.

```sh
rtk proxy docker compose up -d --wait database
rtk proxy docker compose ps
```

Password baru diprovisikan ke `.local/postgres-password` dan dibaca melalui Docker secret. `.local/` diabaikan Git. File tidak dicetak atau dikirim ke layanan lain. Clone baru perlu file privat tersebut disiapkan secara aman sebelum startup; jangan commit file. Jangan menggunakan dump `docker inspect` lengkap karena environment atau metadata lain dapat memuat credential.

Container dan volume lama telah diganti setelah pengguna menyatakan datanya tidak dipakai dan menyetujui penghapusan. Compose sekarang menjadi pengelola aktif, bukan alternatif database lain. Jangan menjalankan reset/drop/down dengan penghapusan volume tanpa persetujuan baru. Mengubah secret file saja tidak mengubah password pada database yang sudah diinisialisasi.

## File konfigurasi yang diisi sendiri

| Template | Salinan privat | Variabel |
| --- | --- | --- |
| `apps/api/.env.example` | `apps/api/.env` | `DATABASE_URL` |
| `apps/assistant/.env.example` | `apps/assistant/.env` | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_ALLOWED_MODELS` |

Buat salinan menggunakan editor; jangan kirim nilai credential lewat chat atau menempelkannya ke command terminal. `.env` diabaikan Git; `.env.example` hanya nama variabel dengan nilai kosong.

Untuk URL database, gunakan skema PostgreSQL, role `restaurant`, host `127.0.0.1`, port `55432`, database `restaurant`, serta password dari file lokal melalui editor privat. Karakter khusus credential perlu di-encode sesuai format connection URL. Jangan mencetak URL lengkap. Koneksi psql dalam container tidak menggantikan tes autentikasi TCP dari aplikasi.

Untuk model, isi ID varian gratis yang benar-benar ada di katalog dan mendukung tools. Jangan memasukkan model berbayar atau fallback berbayar. Key hanya untuk service Python, tidak diletakkan di web atau memakai prefix publik.

API sudah memiliki loader `.env` dengan path eksplisit dari folder API, validasi URL PostgreSQL, dan koneksi Prisma melalui adapter pg. Environment proses memiliki prioritas; pesan validasi tidak memuat nilai URL. Konfigurasi privat API lokal sudah diprovisikan tanpa mencetak credential. Assistant sudah memiliki factory agent dan validasi mapping model/allowlist gratis, tetapi belum memiliki loader file privat atau runtime inference HTTP; mengisi file assistant belum mengaktifkan chatbot.

## Pemeriksaan tanpa credential

```sh
rtk proxy npx --yes pnpm@12.15.0 build
rtk proxy npx --yes pnpm@12.15.0 typecheck
rtk proxy npx --yes pnpm@12.15.0 test
rtk proxy uv run --project apps/assistant --locked python -m unittest discover -s apps/assistant -p "test_*.py"
rtk proxy uv run --project apps/assistant --locked python scripts/smoke_local.py
```

Smoke memakai port 3001 dan 8000, menjalankan proses sementara dan menghentikannya setelah tes. Pastikan port kosong. Tes import Agno hanya memeriksa dependency, bukan tool calling model live. Jangan menaruh API key pada source tes.

## Sources

- [Docker: Start containers](https://docs.docker.com/reference/cli/docker/container/start/)
- [OpenRouter: Authentication](https://openrouter.ai/docs/api/reference/authentication)
- [OpenRouter: Free variants](https://openrouter.ai/docs/guides/routing/model-variants/free)
