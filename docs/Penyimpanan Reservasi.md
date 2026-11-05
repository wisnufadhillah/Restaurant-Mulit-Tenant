# Penyimpanan reservasi

Schema Prisma memuat `Reservation` dan `ReservationEvent`. Migrasi SQL baru menambahkan tabel `reservations`, `reservation_events` dan extension PostgreSQL `btree_gist` dalam satu transaksi. File migrasi belum menjadi bukti bahwa database lokal telah diperbarui.

## Batas data dan constraint

- Reservasi mengacu outlet melalui pasangan tenant/outlet dan meja melalui tenant/outlet/meja. Relasi silang tenant atau outlet ditolak oleh foreign key komposit.
- Kode referensi dan idempotency key unik per tenant. Key pada tabel ini hanya untuk operasi create; operasi lain memerlukan kontrak idempotency tersendiri.
- Management credential hanya disimpan sebagai hash heksadesimal 64 karakter, bukan token mentah. Expiry harus sesudah akhir kunjungan dan maksimal 24 jam setelahnya. Pembuatan token, pertukaran management session serta rotasi belum diimplementasikan.
- Waktu memakai `timestamptz(3)`, durasi 90 menit, jumlah tamu 1–12. Nilai timestamp infinite ditolak.
- Status yang diterima: confirmed, cancelled, completed dan no_show. Source hanya web/chat; keduanya bukan bukti persetujuan customer.
- Exclusion constraint GiST menolak interval confirmed yang beririsan pada tenant dan meja sama. Range memakai `[start,end)` sehingga interval bersebelahan diperbolehkan. Status terminal tidak memblokir slot.
- Event terikat reservasi dan staff pada tenant sama. Event awal menuju confirmed; event berikutnya hanya confirmed menuju status terminal. Pembatalan oleh staff memerlukan alasan tidak kosong.

Pemeriksaan bentuk event tidak memaksa transisi row reservasi maupun memastikan row/event selalu ditulis bersamaan. Service bisnis harus memeriksa status lama, izin, cutoff dan jam server, lalu memperbarui reservasi/event secara atomic. Kapasitas aktual meja, jam operasional, notice, advance, status meja serta aturan kebijakan tetap harus divalidasi dalam transaksi create. Constraint tidak menggantikan aturan tersebut.

## Belum aktif sebagai layanan booking

Belum ada endpoint create, adapter snapshot availability, konfirmasi customer, proposal, idempotency replay/receipt recovery, management session atau transaksi service reservasi. Schema ini tidak membuat booking melalui chat maupun form menjadi tersedia. Runtime AI tetap tidak mempunyai write tool.

Client Prisma perlu digenerate ulang setelah schema berubah. Tidak perlu menerapkan migrasi hanya untuk memvalidasi bentuk schema. Penerapan migrasi menambah tabel/index/extension dan memerlukan persetujuan target database serta hak role yang sesuai. Jangan memakai reset atau menghapus volume untuk menerapkannya.

## Pengujian PostgreSQL

`apps/api/test/reservation-storage.integration.cjs` ditujukan hanya untuk PostgreSQL lokal pada loopback port 55432, database restaurant. Pengujian mengasumsikan migrasi sudah diterapkan; tidak menjalankan migrasi otomatis.

Semua data sintetis dibuat dalam satu transaksi yang sengaja di-rollback. Savepoint mengisolasi penolakan yang diharapkan: overlap, foreign key lintas tenant, status invalid, jumlah tamu, durasi dan duplikasi idempotency key. Tes juga memeriksa batas interval bersebelahan dan rollback event ketika operasi berikutnya gagal. Tes ini belum membuktikan request paralel melalui API atau transaksi create service.

Setelah target DB disetujui dan migrasi diterapkan, tes dapat dijalankan:

```sh
rtk proxy node --test apps/api/test/reservation-storage.integration.cjs
```

## Hasil pemeriksaan lokal

Migrasi reservasi telah diterapkan pada PostgreSQL lokal `127.0.0.1:55432/restaurant`. Pemeriksaan Prisma sesudahnya melaporkan sembilan migrasi dan schema up to date.

Tes integrasi penyimpanan lulus pada PostgreSQL nyata: overlap confirmed ditolak, interval bersebelahan diterima, relasi lintas tenant ditolak, bentuk status/durasi/jumlah tamu dan unique idempotency diperiksa. Rollback savepoint mencegah event parsial, dan transaksi luar sengaja di-rollback sehingga data sintetis pengujian tidak dipertahankan.

Hasil ini tidak membuktikan request paralel, transaksi create service, replay idempotency atau alur HTTP booking; bagian tersebut belum tersedia.

## Sources

- [PostgreSQL: Range constraints](https://www.postgresql.org/docs/current/rangetypes.html#RANGETYPES-CONSTRAINT) — exclusion constraint, range overlap dan btree_gist.
- [Prisma: Unsupported database features](https://www.prisma.io/docs/orm/prisma-schema/data-model/unsupported-database-features) — fitur database di luar schema Prisma disimpan dalam migrasi SQL khusus.
