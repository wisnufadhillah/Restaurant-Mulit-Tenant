# Restaurant Workspace

Workspace lokal untuk website restoran, API bisnis, dan service assistant. Halaman web memakai desain Senja dengan foto lokal dan contoh menu berlabel; reservasi serta asisten menampilkan status belum tersedia, tanpa hasil transaksi palsu. Skema tenant/outlet dan seed sintetis tersedia pada database lokal. Profil publik tersedia di GET /api/v1/public/tenants/:slug/restaurant. Kode API login/logout dan sesi staff tenant-scoped tersedia; migration akun/sesi telah diterapkan dan diuji pada DB lokal. UI login/logout dan dashboard terproteksi sudah terhubung serta diuji sampai DB lokal. Akun operasional belum diprovision. Menu publik dan dashboard menu sudah memakai API/DB: pemilik tambah/edit/nonaktifkan, staff mengubah tersedia/habis. Alur dijelaskan pada docs/Alur Pengelolaan Menu.md. Belum ada reservasi nyata atau retrieval terintegrasi.

## Prasyarat

- Node.js 22.22 atau lebih baru dalam seri 22.
- pnpm 12.15.0; jika belum tersedia global, gunakan `npx --yes pnpm@12.15.0` sebagai pengganti `pnpm` pada command.
- uv dan Python 3.12.
- Docker untuk container PostgreSQL lokal yang sudah tersedia.

## Instalasi dan pemeriksaan

```sh
rtk proxy npx --yes pnpm@12.15.0 install --frozen-lockfile
rtk proxy uv sync --project apps/assistant --locked --python 3.12
rtk proxy npx --yes pnpm@12.15.0 build
rtk proxy npx --yes pnpm@12.15.0 typecheck
rtk proxy npx --yes pnpm@12.15.0 test
rtk proxy uv run --project apps/assistant --locked python -m unittest discover -s apps/assistant -p "test_*.py"
rtk proxy uv run --project apps/assistant --locked python scripts/smoke_local.py
rtk proxy uv run --project apps/assistant --locked python scripts/smoke_restaurant_tool.py
```

Isi konfigurasi database privat sebelum build API karena Prisma config memvalidasi DATABASE_URL. Build API menghasilkan Prisma Client dan output TypeScript. Build API sebelum menjalankan unit test Node karena test memuat output kompilasi. Belum tersedia lint command atau UI test suite. Lockfile JavaScript dan Python harus disimpan bersama perubahan dependensi.

## Menjalankan layanan

Jalankan di terminal terpisah:

```sh
rtk proxy npx --yes pnpm@12.15.0 dev:web
rtk proxy npx --yes pnpm@12.15.0 dev:api
rtk proxy uv run --project apps/assistant --locked python apps/assistant/health.py
```

- Web: http://127.0.0.1:3000
- API liveness: http://127.0.0.1:3001/api/v1/health
- Assistant liveness: http://127.0.0.1:8000/health

API dev mengompilasi saat mulai dan memantau output JavaScript. Untuk kompilasi ulang otomatis, jalankan `rtk proxy npx --yes pnpm@12.15.0 --filter @restaurant/api watch:types` di terminal terpisah; alternatifnya jalankan build setelah mengubah TypeScript. Smoke script memakai port 3001 dan 8000 yang harus kosong dan menghentikan proses yang dibuatnya setelah pemeriksaan. Semua service bind ke loopback. Health hanya membuktikan proses hidup, bukan database/model siap. Service assistant belum menerima chat, belum membuat agent runtime, dan tidak memanggil OpenRouter. Tes hanya memverifikasi dependency adapter dapat diimpor tanpa credential.

## Database lokal

Compose mengelola container `multi-tenant`, image `pgvector/pgvector:0.8.1-pg17`, binding `127.0.0.1:55432`, dan volume `multi-tenant_postgres_data`. Database serta role lokal bernama `restaurant`. Koneksi psql dalam container telah diuji; belum ada tabel aplikasi.

```sh
rtk proxy docker compose up -d --wait database
rtk proxy docker compose ps
```

Password dibaca melalui Docker secret dari `.local/postgres-password`, bukan nilai hardcoded pada Compose. File tersebut dibuat lokal dan diabaikan Git. Jangan mencetak, menyalin ke chat, atau menghapusnya; clone baru memerlukan provision secret privat sebelum startup. Mengganti file tidak otomatis mengganti password pada volume yang sudah diinisialisasi.

Isi `apps/api/.env` secara privat berdasarkan template `.env.example`; gunakan host `127.0.0.1`, port `55432`, database dan role `restaurant`, serta password dari file lokal melalui editor privat. Loader membaca `.env` dari folder API secara eksplisit, dengan environment proses sebagai prioritas. Prisma schema/migrasi tenant/outlet serta seed dua tenant tersedia; autentikasi TCP aplikasi telah diuji. Jangan menjalankan reset atau penghapusan volume tanpa persetujuan terpisah.

Setelah target DB lokal dikonfirmasi, command berikut menerapkan migrasi yang sudah ditinjau dan seed sintetis:

```sh
rtk proxy npx --yes pnpm@12.15.0 --filter @restaurant/api db:migrate
rtk proxy npx --yes pnpm@12.15.0 --filter @restaurant/api build
rtk proxy npx --yes pnpm@12.15.0 --filter @restaurant/api db:seed
rtk proxy npx --yes pnpm@12.15.0 --filter @restaurant/api test:database
```

Seed memakai ID sintetis tetap dan tidak menambah duplikat pada retry. Integration test membutuhkan seed tersebut serta izin DDL lokal untuk probe FK dalam transaksi yang di-rollback. Ini bukan perintah untuk produksi. API health tetap liveness, belum memeriksa database.

## Dokumentasi API

Panduan endpoint tersedia di `docs/api/README.md` dan kontrak OpenAPI 3.1.1 di `docs/api/openapi.json`. Hanya route yang sudah berjalan dicantumkan. Scalar development tersedia di http://127.0.0.1:3001/docs, JSON di /openapi.json; fitur agent, telemetry, penyimpanan auth dan Test Request dimatikan. UI Scalar memakai CDN versi terkunci dan memerlukan internet. Alur simulasi async dijelaskan di `docs/Runner Async.md`.

## Batas integrasi

API memiliki business logic dan database. Wrapper Python sekarang hanya membaca katalog publik dengan konteks slug terikat aplikasi; endpoint internal yang memverifikasi service dan konteks sesi belum tersedia. Penjelasan kode, tes dan batasnya tersedia di `docs/Alur Tool Restoran.md`. Tidak ada tool tulis, credential database di Python, atau key model di browser. Jangan membuka endpoint publik sebelum tenant/auth/validation tersedia. Model gratis perlu smoke test terpisah menggunakan data sintetis; dependency import bukan bukti model mendukung tool calling.
