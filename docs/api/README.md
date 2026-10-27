# Dokumentasi API

## Status dan penggunaan

Dokumen OpenAPI 3.1.1 ada di `openapi.json` dalam folder ini. File dapat dibuka menggunakan viewer OpenAPI lokal atau diimpor ke client API yang mendukung versi tersebut. Belum ada Swagger UI yang dilayani aplikasi pada /docs. Jangan mengunggah credential/file .env ke viewer publik.

Kontrak hanya memuat endpoint NestJS yang sudah tersedia. Service Python health dijelaskan terpisah pada panduan setup, bukan dianggap bagian API bisnis. Auth, menu, availability, reservasi, sesi dan chat belum diimplementasikan dan tidak dicantumkan sebagai route yang berjalan.

Base URL lokal: http://127.0.0.1:3001/api/v1

## Menjalankan API

Pastikan Docker database healthy, konfigurasi privat API tersedia, migrasi dan seed telah dijalankan, lalu:

```sh
rtk proxy npx --yes pnpm@12.15.0 --filter @restaurant/api build
rtk proxy npx --yes pnpm@12.15.0 dev:api
```

## Endpoint yang tersedia

| Metode | Path | Akses | Hasil |
| --- | --- | --- | --- |
| GET | /health | Publik lokal | Proses API hidup, bukan DB/model readiness |
| GET | /public/tenants/{slug}/restaurant | Katalog publik | Profil tenant active dan outlet isActive |

Contoh tanpa credential:

```sh
rtk proxy curl --fail http://127.0.0.1:3001/api/v1/health
rtk proxy curl --fail http://127.0.0.1:3001/api/v1/public/tenants/demo-padang/restaurant
```

Respons health:

```json
{"status":"ok","service":"restaurant-api"}
```

Profil sukses memiliki data (slug, name, outlets), retrieved_at timestamp berzona dan source restaurant_api. Setiap outlet berisi nama, alamat/kontak publik, timezone dan aturan durasi/notice/advance/cancel cutoff/max party. ID internal dan data customer tidak ditampilkan. Outlets boleh kosong bila tidak ada outlet aktif. Kontak kosong pada seed berarti belum tersedia, bukan nomor telepon nyata.

Jam buka, harga, slot meja, dan status reservasi tidak ada dalam profil ini. Jangan menyimpulkan available/open dari isActive. Respons belum memiliki pagination/cache headers atau jaminan SLA produksi. Slug memilih katalog dan bukan bukti akses data privat.

## Error

Bentuk respons:

```json
{
  "error": {"code":"NOT_FOUND","message":"Informasi tidak ditemukan."},
  "request_id":"00000000-0000-4000-8000-000000000000"
}
```

request_id contoh bukan ID aktual. Server menghasilkan UUID baru pada setiap error; nilai dari header client tidak dipercaya. Filter tidak mengirim stack, SQL atau pesan provider mentah.

- 404 NOT_FOUND: slug invalid/tidak ada atau tenant tidak aktif. POST pada path GET juga saat ini 404, bukan kontrak 405.
- 503 SERVICE_UNAVAILABLE: query DB gagal.
- 500 INTERNAL_ERROR: exception tak terduga.

404 dan hasil GET diuji lewat integration HTTP. 500/503 sudah dipetakan tetapi fault injection khusus belum ditambahkan; jangan menganggap seluruh failure path sudah diuji. Pesan internal bukan bahan diagnosis untuk customer; gunakan bukti tes/log aman saat mengembangkan observability.

## Pemeliharaan kontrak

Saat route/response berubah, perbarui file OpenAPI, panduan dan test pada perubahan yang sama. File kontrak ditulis manual, bukan auto-generated; cek kesesuaian implementasi penting untuk menghindari drift. Jalankan:

```sh
rtk proxy npx --yes pnpm@12.15.0 --filter @restaurant/api test
rtk proxy npx --yes pnpm@12.15.0 --filter @restaurant/api test:database
```

Test kontrak dasar memeriksa route yang didokumentasikan, schema references, dan shape response aktual pada integration test. Ini bukan validator OpenAPI lengkap. Viewer/importer spesifik belum diuji.

## Sources

- [OpenAPI Specification 3.1.1](https://spec.openapis.org/oas/v3.1.1.html)
