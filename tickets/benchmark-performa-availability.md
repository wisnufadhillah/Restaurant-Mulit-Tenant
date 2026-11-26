# Benchmark Performa Ketersediaan Meja

## Tujuan

Memvalidasi bahwa endpoint kalkulasi ketersediaan meja (`GET /api/v1/public/tenants/:slug/availability`) tetap responsif (latensi p95 < 50ms) saat database PostgreSQL berisi volume data operasional realistis sebesar 20 meja dan 1.000 reservasi per tenant.

## Latar Belakang

Sesuai target fase demo pada PRD dan timeline pengerjaan (*Ukur performa dan perbaiki penghambat demo*), query ketersediaan meja melakukan pemindaian interval waktu `[start_at, end_at)` dan pencarian kapasitas meja terkecil yang sesuai. Pengujian ini membuktikan bahwa index database, composite foreign keys, dan algoritma alokasi meja di NestJS/Prisma bekerja optimal tanpa bottleneck ketika volume reservasi meningkat.

## Ruang Lingkup

1. **Penyusunan Fixture Data Sintetis**:
   - 1 tenant dan 1 outlet terisolasi.
   - 20 meja makan dengan variasi kapasitas (2, 4, 6, dan 8 kursi).
   - Jadwal operasional 7 hari seminggu (10:00 – 22:00 WIB).
   - 1.000 reservasi sintetis berstatus `confirmed` yang terdistribusi secara valid (tanpa melanggar exclusion constraint) sepanjang rentang 30 hari ke depan.
2. **Pengujian Beban Kueri (100 Iterasi)**:
   - Skenario slot sibuk (banyak meja terisi).
   - Skenario slot renggang (banyak meja kosong).
   - Skenario variasi jumlah tamu (2, 4, 6, 8 orang).
3. **Pengukuran Metrik Performa**:
   - Menghitung rata-rata (mean), p50 (median), p95, dan latensi maksimum (max ms).
   - Target batas toleransi: p95 < 50ms pada lingkungan PostgreSQL lokal.
4. **Pembersihan Bersih (Teardown)**:
   - Menghapus seluruh fixture data uji sintetis secara atomic di blok `finally`.

## Kriteria Selesai

- [x] Skrip benchmark mandiri tersedia di repositori (`apps/api/test/availability-benchmark.test.cjs`, script `pnpm --filter @restaurant/api test:benchmark`).
- [x] Database lokal berhasil diinjeksi 20 meja dan 1.000 reservasi tanpa melanggar constraint (1.000 baris confirmed non-overlapping).
- [x] 100 eksekusi kueri availability menghasilkan latensi p95 di bawah 50ms (**p95: 32.35 ms, p50: 10.07 ms, mean: 13.43 ms**).
- [x] Logika alokasi tetap memilih meja terkecil yang muat dengan benar (slot sibuk menolak dengan alasan, slot kosong meloloskan).
- [x] Teardown membersihkan seluruh data uji tanpa menyisakan baris di database (0 baris tersisa di blok `finally`).

## Hasil Benchmark Aktual

Command:
```sh
rtk proxy env ALLOW_LOCAL_BENCHMARK_WRITES=1 pnpm --filter @restaurant/api test:benchmark
```

Hasil Pengukuran (100 Kueri):
```text
=== AVAILABILITY BENCHMARK RESULTS (20 Tables, 1,000 Reservations) ===
Total Queries: 100
Min:           7.26 ms
Mean:          13.43 ms
p50 (Median):  10.07 ms
p95:           32.35 ms
p99:           48.83 ms
Max:           48.83 ms
====================================================================
```

SLA PRD: p95 < 50 ms tercapai dengan margin aman (32.35 ms). Kueri RepeatableRead pada PostgreSQL 17.8 berjalan stabil tanpa lonjakan latensi.

## Langkah Pengerjaan

1. Buat skrip benchmark di `apps/api/test/availability-benchmark.test.cjs`.
2. Gunakan batch insert teroptimasi untuk menginjeksi 1.000 reservasi valid pada 20 meja.
3. Jalankan 100 permintaan perhitungan ketersediaan dengan variasi waktu dan jumlah tamu.
4. Catat distribusi latensi dan simpan hasil uji ke laporan.
5. Jalankan verifikasi pembersihan data.
