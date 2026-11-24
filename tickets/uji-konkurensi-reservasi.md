# Uji Konkurensi Reservasi dan Pencegahan Overlap

## Tujuan

Membuktikan secara empiris bahwa exclusion constraint PostgreSQL pada database aplikasi mencegah terjadinya pemesanan ganda (double-booking) saat terjadi permintaan reservasi bersamaan pada meja dan rentang waktu yang identik.

## Latar Belakang

Sistem menggunakan durasi reservasi 90 menit dengan interval waktu `[start_at, end_at)`. Integritas reservasi bergantung pada constraint database tingkat rendah (`tsrange` overlap prevention), bukan sekadar pengecekan ketersediaan di memori aplikasi yang rentan terhadap race condition.

## Ruang Lingkup

1. Menyiapkan skrip pengujian konkurensi terarah pada lingkungan lokal PostgreSQL.
2. Melakukan simulasi 50 permintaan pembuatan reservasi secara serentak (`Promise.all` atau proses paralel) untuk satu meja aktif dan interval waktu yang persis sama.
3. Memverifikasi respons aplikasi:
   - Tepat satu permintaan berhasil membuat reservasi dengan status `confirmed`.
   - Sebanyak 49 permintaan lainnya ditolak dengan respons konflik yang terstruktur (bukan galat server internal yang tidak tertangani).
4. Memverifikasi pengulangan dengan kunci idempotensi yang sama menghasilkan data lama, sedangkan kunci sama dengan payload berbeda ditolak.
5. Memastikan log audit mencatat percobaan dan tidak ada status transaksi menggantung.

## Kriteria Selesai

- [x] Skrip pengujian otomatis tersedia di repositori tanpa bergantung pada data staging aktif (`apps/api/package.json` script `test:concurrency`).
- [x] Eksekusi pengujian pada PostgreSQL membuktikan tepat 1 baris berstatus `confirmed` untuk meja dan slot waktu uji (`test/reservation-http.integration.cjs` 50 request konkuren).
- [x] 49 permintaan lainnya mengembalikan status penolakan konflik yang aman (HTTP 409).
- [x] Audit operasional mencatat transisi status dengan benar (tepat 1 event `confirmed`, dan event `cancelled` saat pembatalan).
- [x] Tidak ada reservasi duplikat atau pelanggaran constraint yang tidak tertangkap (exclusion constraint `23P01` tervalidasi pada `reservation-storage.integration.cjs`).

## Bukti Eksekusi

Command:
```sh
rtk proxy env ALLOW_LOCAL_RESERVATION_WRITES=1 pnpm --filter @restaurant/api test:concurrency
```

Hasil:
- `local PostgreSQL reservation HTTP isolates tenants and serializes fifty fixed-table attempts`: 50 request paralel menghasilkan tepat 1 status 200, 49 status 409, 1 baris confirmed di database, 1 event audit. Replay key sama menghasilkan data lama; payload berbeda ditolak.
- `local recovery serializes both create orders, retries lost responses and isolates fixtures`: lolos.
- `local reservations roll back audit failure, preserve configuration and recover a lost HTTP response`: rollback otomatis saat kegagalan audit terbukti.
- `reservation storage enforces overlap, tenant keys and atomic event writes on local PostgreSQL`: exclusion constraint `23P01`, foreign key komposit `23503`, dan check constraint `23514` terverifikasi langsung pada PostgreSQL.
- Total: 4 test suite lulus, 0 gagal.

## Langkah Pengerjaan

1. Buat berkas pengujian integrasi konkurensi pada direktori pengujian API.
2. Gunakan satu meja uji dari data seed dan tentukan slot waktu masa depan yang valid.
3. Kirim 50 permintaan reservasi paralel menggunakan variasi payload nama dan identitas pemesan.
4. Periksa hasil HTTP status code dari setiap panggilan.
5. Jalankan kueri verifikasi langsung ke database untuk menghitung jumlah baris reservasi yang tersimpan pada interval tersebut.
6. Dokumentasikan hasil uji dan waktu eksekusi sebagai bukti verifikasi.
