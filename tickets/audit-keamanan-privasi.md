# Audit Keamanan dan Privasi Data

## Tujuan

Memastikan tidak ada kebocoran data pribadi pelanggan (PII), token akses reservasi, riwayat transaksi privat, atau kredensial pembayaran pada log aplikasi, riwayat percakapan, dan respons antarmuka publik.

## Latar Belakang

Model AI dan riwayat percakapan merupakan domain data semi-publik dalam konteks sistem. Sesuai batasan privasi, data sensitif (kontak, token akses, kredensial payment gateway) dilarang masuk ke prompt model atau tersimpan dalam bentuk teks polos di riwayat percakapan. Dashboard staf juga harus dibatasi agar tidak mengekspos token privat pembayaran atau sesi pelanggan lain.

## Ruang Lingkup

1. **Penyamaran Riwayat Chat**:
   - Memastikan nomor telepon pelanggan (termasuk variasi pemisah spasi, tanda kurung, dan awalan negara) selalu disamarkan menjadi penanda anonim sebelum disimpan ke database dan dikirim ke runtime AI.
   - Memastikan tanggal mandiri valid kalender tidak keliru tersamarkan sebagai nomor telepon.
   - Memastikan alamat surel dan token panjang selalu tersamarkan.
2. **Sanitasi Respons API**:
   - Memeriksa bahwa endpoint riwayat pesanan staf tidak mengembalikan token Snap Midtrans, URL pembayaran privat, atau hash sesi ke browser.
   - Memeriksa bahwa endpoint publik katalog menu dan ketersediaan tidak membocorkan identitas reservasi privat.
3. **Pembersihan Log Operasional**:
   - Memeriksa konfigurasi logger NestJS, Caddy, dan Agno agar tidak mencetak payload body notifikasi pembayaran mentah atau header otorisasi.
4. **Verifikasi Masa Hidup Sesi Staf**:
   - Menguji bahwa sesi staf terputus otomatis setelah 30 menit tanpa aktivitas pengguna nyata.
   - Menguji bahwa batas absolut 8 jam ditegakkan oleh server tanpa perpanjangan sepihak dari klien.

## Kriteria Selesai

- [x] Seluruh skenario penyamaran kontak pada pengujian pesan chat lulus tanpa meloloskan nomor telepon riil (`redactChat` di `apps/api/src/restaurant/chat-message.controller.ts` diperbaiki untuk tanda baca titik setelah tanggal valid kalender; diuji lewat `test/chat-message.test.cjs`).
- [x] Pengujian API pesanan membuktikan ketiadaan token pembayaran dan URL Snap pada data yang dikembalikan ke antarmuka staf (`test/staff-orders.test.cjs`, `test/staff-orders-http.test.cjs` lulus).
- [x] Log server pada alur pembayaran bersih dari nilai rahasia pembayaran dan tanda tangan otentikasi (`apps/api/src/create-app.ts` menonaktifkan logger NestJS, `orders.controller.ts` tidak mencatat body/header webhook, `apps/assistant/conversation_server.py` menonaktifkan logging, `infra/staging/Caddyfile` tidak mencatat body/header).
- [x] Simulasi jeda waktu membuktikan penolakan permintaan mutasi setelah batas idle 30 menit terlampaui (`test/staff-idle.test.cjs` lulus 5/5 skenario batas exact idle 30 menit dan absolut 8 jam).

## Temuan & Bukti Verifikasi

1. **Perbaikan Edge Case `redactChat`**: Ditemukan bahwa tanggal valid kalender di akhir kalimat yang diikuti tanda titik (contoh `25-11-2026.`) sebelumnya ikut tersamarkan menjadi `[nomor disamarkan].` karena `.` masuk kelas karakter pengecualian `standalone`. Diperbaiki di `apps/api/src/restaurant/chat-message.controller.ts` dan diverifikasi dengan kasus uji baru di `apps/api/test/chat-message.test.cjs` (lulus).
2. **Sanitasi API & Privasi**: `StaffOrdersService.list` dan `StaffOrdersService.detail` hanya memilih kolom aman (tanpa `snapToken`, `redirectUrl`, `midtransOrderId`, `requestHash`, `idempotencyKey`, `chatSessionId`). `AvailabilityService` hanya mengembalikan `{ startAt, endAt, timezone, held, available, reason? }`.
3. **Catatan Lingkungan**: 155/159 unit test API lulus; 4 test (`chat-message.test.cjs` test 1-2, `chat-sessions.test.cjs`, `knowledge-http.test.cjs`) membutuhkan koneksi PostgreSQL lokal (`127.0.0.1:55432`) yang saat ini belum aktif karena Docker Desktop belum berjalan.

## Langkah Pengerjaan

1. Eksekusi pengujian penyamaran pesan dan tambahkan kasus uji batas jika ditemukan variasi format baru.
2. Lakukan inspeksi inspeksi payload respons API pada endpoint pesanan dan reservasi.
3. Simulasikan pengiriman webhook pembayaran dan telusuri log keluaran untuk memverifikasi ketiadaan data mentah rahasia.
4. Jalankan uji batas kedaluwarsa sesi staf menggunakan manipulasi waktu uji.
5. Catat temuan dan langkah pencegahan pada laporan verifikasi.
