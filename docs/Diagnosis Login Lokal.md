# Diagnosis Login Lokal

## Gejala dan bukti

Tes login web pernah gagal dengan HTTP 503, sementara tes auth terisolasi lulus. Pemeriksaan setelah kegagalan menunjukkan health API dan profil publik HTTP 200. Probe login bersamaan menghasilkan 429 pada satu request, lalu tes web dijalankan sendiri lulus. Penyebab 503 awal belum teridentifikasi; 429 membuktikan pembatasan konkurensi, bukan membuktikan penyebab 503.

Health hanya membuktikan proses HTTP hidup; tidak membuktikan database/auth siap atau proses tidak akan restart sesudah pemeriksaan.

## Perubahan diagnosis

Route web /staff/login sekarang mengembalikan kategori aman tanpa password, cookie, stack atau detail koneksi:

| Kode | Makna | Tindakan |
| --- | --- | --- |
| LOGIN_CONNECTION_FAILED | Fetch API gagal | Periksa proses BE, port 3001 dan restart watcher |
| LOGIN_TIMEOUT | Batas waktu login tercapai | Tunggu, pastikan BE/DB stabil, lalu coba sekali lagi |
| LOGIN_UPSTREAM_UNAVAILABLE | API mengembalikan kegagalan server | Periksa kesehatan DB dan jalankan tes auth terarah |
| LOGIN_RATE_LIMITED | API menolak dengan 429 | Tunggu batas rate/concurrency; jangan menonaktifkan limiter |
| LOGIN_REJECTED | Input, credential atau izin ditolak | Periksa field dan Origin, jangan bagikan credential |
| LOGIN_INVALID_RESPONSE | API sukses tetapi cookie/format tidak valid | Periksa kesesuaian versi FE/BE |

Tidak ada retry login otomatis. Credential invalid tidak diperlakukan sebagai gangguan koneksi. Response tetap no-store. UI menampilkan pesan pemulihan aman; kategori dapat diperiksa pada Network response. Jangan menyalin request payload, Set-Cookie, Cookie atau isi file privat ke laporan.

## Menjalankan pemeriksaan stabil

Kompilasi API sebelum menjalankan server tes:

```sh
rtk proxy node node_modules/typescript/bin/tsc --project apps/api/tsconfig.json
```

Terminal BE khusus verifikasi, tanpa watcher:

```sh
rtk proxy node apps/api/dist/main.js
```

Jangan jalankan dua proses BE pada port sama. Hentikan proses watch milik sendiri melalui Ctrl+C sebelum menjalankan server ini; jangan membunuh proses tidak dikenal. Untuk FE:

```sh
rtk proxy node apps/web/node_modules/next/dist/bin/next dev apps/web --hostname 127.0.0.1
```

Tes web dijalankan terpisah setelah kedua layanan siap:

```sh
rtk proxy node --test apps/api/test/staff-web.integration.cjs
```

Tes memeriksa health API dan halaman login sebelum membuat akun sintetis. Jika login gagal, tes hanya menampilkan status dan kode allowlisted, bukan payload. Jangan menjalankan kompilasi yang mengubah dist ketika node --watch aktif selama verifikasi: restart proses dapat memutus request. Ini risiko workflow yang diketahui, belum bukti penyebab insiden awal.

Tes unit/API terisolasi dapat dijalankan terpisah:

```sh
rtk proxy node --test apps/api/test/auth-crypto.test.cjs apps/api/test/staff-auth.test.cjs apps/api/test/staff-service.test.cjs
```

## Fault injection deterministik

```sh
rtk proxy node --test apps/api/test/login-proxy.test.cjs
```

Tes tidak menghentikan BE, tidak membaca akun demo, dan menggunakan password sintetis sementara tanpa mencetak nilainya. Harness mentranspilasi route dengan TypeScript lokal dan memuatnya dengan adapter minimal; ini bukan pengganti pengujian browser atau implementasi Next response sesungguhnya.

## Status verifikasi dan batas

Typecheck FE dan tes FE→API→DB lulus sesudah perubahan diagnosis. Fault-injection otomatis pada handler route asli sudah lulus untuk koneksi putus, timeout, upstream 503/429/401 dan sukses tanpa cookie valid. Adapter Next response/config serta fetch diganti pada harness tes, bukan server yang sedang dipakai. Setiap kegagalan memanggil upstream tepat sekali, tidak membuat cookie, memakai no-store dan tidak memantulkan password/detail error. Tes ini membuktikan pemetaan kegagalan, bukan penyebab insiden awal atau simulasi jaringan nyata. Tidak ada perubahan password, sesi keamanan, limiter atau retry policy. Root cause 503 tetap terbuka sampai kegagalan dapat direproduksi dengan kategori baru.
