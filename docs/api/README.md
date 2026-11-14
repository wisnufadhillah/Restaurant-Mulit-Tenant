# Dokumentasi API

## Status dan penggunaan

Dokumen OpenAPI 3.1.1 ada di `openapi.json` dalam folder ini. File dapat dibuka menggunakan viewer OpenAPI lokal atau diimpor ke client API yang mendukung versi tersebut. Scalar tersedia pada http://127.0.0.1:3001/docs saat development; spesifikasi JSON pada /openapi.json. Keduanya dimatikan saat NODE_ENV=production. Scalar memakai browser bundle CDN versi 1.76.0, sehingga tampilan memerlukan internet; spesifikasi tetap dilayani lokal. Agent, telemetry, persistAuth dan Test Request dinonaktifkan; tidak menggunakan proxy Scalar atau credential bawaan. Jangan mengunggah credential/file .env ke viewer publik.

Kontrak hanya memuat endpoint NestJS yang sudah tersedia. Service Python health dijelaskan terpisah pada panduan setup, bukan dianggap bagian API bisnis. Login/logout dan pembacaan sesi staff tersedia pada kode API; migration akun/sesi sudah diterapkan dan diuji pada DB lokal; provisioning akun operasional belum dijalankan. Menu publik dan pengelolaan menu tenant-scoped tersedia. Availability reservasi read-only dan endpoint chat tersedia. Create, lihat privat dan batal booking belum tersedia sebagai endpoint.

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
| GET | /public/tenants/{slug}/availability | Publik | Availability satu kunjungan; tanpa hold atau data customer |
| GET | /public/tenants/{slug}/hours | Publik | Jadwal mingguan, bukan status buka tanggal tertentu |
| GET | /staff/tenants/{slug}/hours | Owner/staff | Jadwal outlet tenant sesi |
| PUT | /staff/tenants/{slug}/hours | Owner + Origin | Simpan satu hari mingguan |
| GET | /public/tenants/{slug}/menu | Publik | Menu aktif, harga, tersedia/habis |
| GET | /staff/tenants/{slug}/menu | Owner/staff | Daftar menu tenant sesi |
| POST | /staff/tenants/{slug}/menu | Owner + Origin | Tambah menu |
| PATCH | /staff/tenants/{slug}/menu/{id} | Owner + Origin | Edit/aktif/nonaktif menu |
| PATCH | /staff/tenants/{slug}/menu/{id}/availability | Owner/staff + Origin | Tersedia/habis saja |
| GET | /health | Publik lokal | Proses API hidup, bukan DB/model readiness |
| GET | /chat/orders/capabilities | Cookie chat aktif, Origin terpercaya bila ada; bukan cross-site | `{data:{paymentsEnabled:boolean}}`, no-store; flag aktif dan kedua credential terkonfigurasi, bukan provider readiness |
| GET | /public/tenants/{slug}/restaurant | Katalog publik | Profil tenant active dan outlet isActive |
| POST | /staff/login | Origin terpercaya + credential privat | Cookie sesi HttpOnly; body tenantSlug, username, password |
| GET | /staff/tenants/{slug}/session | Cookie sesi + tenant cocok | Identitas dan role dari DB |
| POST | /staff/tenants/{slug}/logout | Cookie sesi + Origin terpercaya | Cabut sesi dan hapus cookie |

`PAYMENTS_ENABLED=false` menolak create pesanan dan notifikasi dengan HTTP 503, `error.code=PAYMENTS_DISABLED`, pesan `Pembayaran belum tersedia.`, dan `Cache-Control: no-store` sebelum akses sesi/DB/provider. Status pesanan lama tetap read-only dan tenant/session-scoped. String `true` mengaktifkan perilaku sandbox existing; unset tetap enabled demi kompatibilitas lokal/test. Nilai lain menggagalkan startup. Capability memerlukan sesi sah dan mengembalikan true hanya bila flag aktif serta `MIDTRANS_SERVER_KEY` dan `MIDTRANS_SIGNATURE_SECRET` keduanya terkonfigurasi. Ini bukan pemeriksaan validitas credential atau provider readiness; tidak ada nilai/diagnostik secret dalam respons. Credential kurang menolak create/notifikasi dengan HTTP 503 sebelum akses sesi/DB/provider. UI menyembunyikan checkout ketika disabled atau capability belum terverifikasi; BFF same-origin meneruskan cookie server-side.

Midtrans hanya sandbox (`MIDTRANS_IS_PRODUCTION=false`). `MIDTRANS_SERVER_KEY` mengotorisasi Snap dan Get Status melalui Basic Auth; `MIDTRANS_SIGNATURE_SECRET` wajib terpisah untuk notifikasi, tanpa fallback ke Server Key. Signature adalah SHA512 biasa dari `order_id + status_code + gross_amount + SignatureSecretKey`, bukan HMAC. Get Status tetap otoritatif: order ID, nominal tersimpan, IDR, status dan fraud tetap divalidasi sebelum transisi/audit atomic. Callback browser bukan bukti lunas. Lihat [Midtrans Access Keys](https://docs.midtrans.com/docs/access-keys.md).

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

## Availability reservasi

`GET /public/tenants/{slug}/availability?date=2026-12-01&time=19%3A00&partySize=4` menerima tepat tiga query parameter, masing-masing satu kali: `date` tanggal kalender `YYYY-MM-DD`, `time` lokal `HH:MM`, dan `partySize` desimal 1–12 tanpa nol awal. Tanggal contoh harus diganti agar memenuhi notice 60 menit dan maksimum 30 hari dari jam server. Field tambahan, duplikasi parameter, pecahan, eksponen dan tanggal mustahil ditolak dengan 400.

Server memilih tenant aktif dari slug dan satu outlet aktif; outlet tidak aktif/tidak ada menghasilkan 404, lebih dari satu outlet aktif menghasilkan 409. Snapshot jadwal, meja dan interval confirmed dibaca dalam transaksi RepeatableRead. Tanggal khusus mengalahkan jadwal mingguan. Kegagalan DB/konfigurasi menghasilkan 503, bukan hasil tersedia palsu.

Respons berisi `data.startAt`, `endAt`, `timezone`, `held=false`, `available`, `source=restaurant_api` dan `retrieved_at`. Jika tidak tersedia, `data.reason` membedakan `hours_unconfigured`, `closed`, `outside_hours`, atau `no_table`. Tidak ada ID meja, ID tenant/outlet, nama customer, kontak, atau token privat. Respons menggunakan `Cache-Control: no-store`. Availability bukan jaminan booking: tidak ada write, hold atau transaksi create pada endpoint ini. Form reservasi dan tool availability chatbot belum diaktifkan.

## Operasional reservasi dan audit

Owner/staff membaca daftar melalui `GET /staff/tenants/{slug}/reservations` dan detail privat melalui `GET /staff/tenants/{slug}/reservations/{id}`. Transisi memakai `POST /staff/tenants/{slug}/reservations/{id}/transitions`, cookie aktif, Origin terpercaya, JSON dan `Idempotency-Key` UUID. Tenant dan aktor selalu dari sesi server dan diperiksa ulang dalam transaksi.

Body tepat salah satu: `{ "status": "cancelled", "reason": "Alasan operasional" }`, `{ "status": "completed" }`, atau `{ "status": "no_show", "reviewed": true }`. Alasan dipangkas, wajib nonkosong, maksimal 500 karakter, tanpa karakter kontrol. `reviewed` merupakan pengakuan eksplisit staff setelah memeriksa kehadiran. Hanya `confirmed` boleh berubah; selesai/tidak hadir memerlukan jam server **lebih besar** dari `endAt`, bukan sama. Pembatalan staff tidak memakai cutoff customer. Tidak ada ubah jadwal, hapus, atau membuka kembali status akhir.

Status dan satu event disimpan atomic dengan tenant advisory lock. UUID key menjadi ID event, terpisah dari key pembuatan reservasi. Retry key/payload normalisasi/reservasi/aktor sama mengembalikan receipt `{ data: { reservationId, status, eventId, changedAt } }`. Perbedaan payload, operasi, aktor atau sasaran menghasilkan 409; status akhir dengan key baru juga 409. Reservasi asing/tidak ada menghasilkan 404. Jika respons terputus atau 503, pertahankan key dan payload semula; jangan membuat key baru untuk percobaan belum pasti. Limiter proses membatasi 60 percobaan valid per aktor per menit.

`GET /staff/tenants/{slug}/audit?page=1` hanya baca, 20 baris per halaman, `page` desimal tunggal 1–999. Snapshot konsisten menggabungkan audit operasional dan event reservasi tenant sesi. Urutan: timestamp menurun, sumber menaik, ID menurun. Respons `{ data, page, pageSize: 20, total }`; baris hanya berisi ID event, sumber, waktu, aksi dikenal, tipe pelaku dan ID/status reservasi bila relevan. Customer/sistem dilabeli tersendiri. Audit operasional tidak menyimpan ID sasaran, sehingga UI tidak mengarangnya. Tidak ada nama/kontak tamu, nama akun, alasan bebas, payload, token atau ekspor. Semua respons privat `no-store`. Dashboard audit memakai pagination; ikhtisar menampilkan lima aktivitas pertama dari endpoint sama.

## Status HTTP

Scalar mencantumkan sukses dan error per operasi, bukan semua status pada semua route:

| Status | Penggunaan |
| --- | --- |
| 200 | Pembacaan, login, edit menu/meja/profil/jadwal |
| 201 | Menu atau meja berhasil dibuat |
| 204 | Logout berhasil, tanpa body |
| 400 | Payload mutasi atau query availability invalid |
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

404 dan hasil GET diuji lewat integration HTTP. Availability memiliki fault injection repository pada tes HTTP yang memeriksa respons 503 aman. Ini bukan simulasi kegagalan PostgreSQL nyata; 500 dan seluruh failure path endpoint lain belum diuji dengan fault injection khusus. Pesan internal bukan bahan diagnosis untuk customer; gunakan bukti tes/log aman saat mengembangkan observability.

## Pemeliharaan kontrak

Saat route/response berubah, perbarui file OpenAPI, panduan dan test pada perubahan yang sama. File kontrak ditulis manual, bukan auto-generated; cek kesesuaian implementasi penting untuk menghindari drift. Jalankan:

```sh
rtk proxy npx --yes pnpm@12.15.0 --filter @restaurant/api test
rtk proxy npx --yes pnpm@12.15.0 --filter @restaurant/api test:database
```

Test kontrak dasar memeriksa route yang didokumentasikan, schema references, dan shape response aktual pada integration test. Ini bukan validator OpenAPI lengkap. Viewer/importer spesifik belum diuji.

## Sources

- [OpenAPI Specification 3.1.1](https://spec.openapis.org/oas/v3.1.1.html)
