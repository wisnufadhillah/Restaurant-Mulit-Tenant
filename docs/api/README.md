# Dokumentasi API

## Status dan penggunaan

Dokumen OpenAPI 3.1.1 ada di `openapi.json` dalam folder ini. File dapat dibuka menggunakan viewer OpenAPI lokal atau diimpor ke client API yang mendukung versi tersebut. Scalar tersedia pada http://127.0.0.1:3001/docs saat development; spesifikasi JSON pada /openapi.json. Keduanya dimatikan saat NODE_ENV=production. Scalar memakai browser bundle CDN versi 1.76.0, sehingga tampilan memerlukan internet; spesifikasi tetap dilayani lokal. Agent, telemetry, persistAuth dan Test Request dinonaktifkan; tidak menggunakan proxy Scalar atau credential bawaan. Jangan mengunggah credential/file .env ke viewer publik.

Kontrak hanya memuat endpoint NestJS yang sudah tersedia. Service Python health dijelaskan terpisah pada panduan setup, bukan dianggap bagian API bisnis. Login/logout dan pembacaan sesi staff tersedia pada kode API; migration akun/sesi sudah diterapkan dan diuji pada DB lokal; provisioning akun operasional belum dijalankan. Menu publik dan pengelolaan menu tenant-scoped tersedia. Availability reservasi, booking dan chat belum tersedia sebagai endpoint.

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
| GET | /public/tenants/{slug}/hours | Publik | Jadwal mingguan, bukan status buka tanggal tertentu |
| GET | /staff/tenants/{slug}/hours | Owner/staff | Jadwal outlet tenant sesi |
| PUT | /staff/tenants/{slug}/hours | Owner + Origin | Simpan satu hari mingguan |
| GET | /public/tenants/{slug}/menu | Publik | Menu aktif, harga, tersedia/habis |
| GET | /staff/tenants/{slug}/menu | Owner/staff | Daftar menu tenant sesi |
| POST | /staff/tenants/{slug}/menu | Owner + Origin | Tambah menu |
| PATCH | /staff/tenants/{slug}/menu/{id} | Owner + Origin | Edit/aktif/nonaktif menu |
| PATCH | /staff/tenants/{slug}/menu/{id}/availability | Owner/staff + Origin | Tersedia/habis saja |
| GET | /health | Publik lokal | Proses API hidup, bukan DB/model readiness |
| GET | /public/tenants/{slug}/restaurant | Katalog publik | Profil tenant active dan outlet isActive |
| POST | /staff/login | Origin terpercaya + credential privat | Cookie sesi HttpOnly; body tenantSlug, username, password |
| GET | /staff/tenants/{slug}/session | Cookie sesi + tenant cocok | Identitas dan role dari DB |
| POST | /staff/tenants/{slug}/logout | Cookie sesi + Origin terpercaya | Cabut sesi dan hapus cookie |

Auth memakai Cache-Control: no-store. STAFF_ORIGIN berisi exact origin web; production wajib HTTPS dan NODE_ENV=production untuk cookie Secure. Development default http://127.0.0.1:3000. UI login tersedia di http://127.0.0.1:3000/login melalui route server same-origin /staff/login dan /staff/logout. Dashboard memverifikasi sesi ke API saat render; cookie web HttpOnly ber-path / agar diterima pada dashboard. Cookie tenant hanya memilih konteks yang tetap diverifikasi backend, bukan izin. Tidak ada credential bawaan atau endpoint registrasi. Detail batas limiter dan sesi terdapat pada panduan keamanan sesi staff.

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

## Status HTTP

Scalar mencantumkan sukses dan error per operasi, bukan semua status pada semua route:

| Status | Penggunaan |
| --- | --- |
| 200 | Pembacaan, login, edit menu/meja/profil/jadwal |
| 201 | Menu atau meja berhasil dibuat |
| 204 | Logout berhasil, tanpa body |
| 400 | Payload/validasi invalid pada mutasi |
| 401 | Sesi hilang, invalid, expired/revoked, atau tenant tidak cocok |
| 403 | Role tidak berhak atau Origin mutasi ditolak |
| 404 | Katalog tenant tidak ada/nonaktif, atau ID data tidak dalam scope |
| 409 | Nama meja duplikat atau satu outlet aktif tidak terpenuhi |
| 429 | Rate/concurrency limit login |
| 500 | Kegagalan internal tak terduga |
| 503 | Dependency belum tersedia |

Semua respons error didokumentasikan dengan schema ApiError dan contoh kode/pesan aman. Contoh request_id bukan ID aktual. 405/422 bukan kontrak route saat ini; metode tak terdaftar umumnya menghasilkan 404, validasi aplikasi menggunakan 400. Status 502 kategori proxy web bukan respons API bisnis dan tidak dicampur ke kontrak NestJS.

Dokumen dimuat API saat startup. Setelah mengubah OpenAPI, restart BE jika proses tidak memakai watcher pada file dokumen, kemudian refresh /docs. Pemeriksaan kontrak tidak membuktikan semua error pernah direproduksi lewat HTTP.

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
