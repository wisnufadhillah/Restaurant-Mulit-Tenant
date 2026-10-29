# Alur Hari Khusus

API owner PUT /api/v1/staff/tenants/:slug/special-hours menerima date (YYYY-MM-DD), openMinute, closeMinute. Keduanya null berarti tutup. Validasi interval memakai aturan jadwal mingguan; tanggal mustahil ditolak. Aktor audit diambil dari sesi server, tidak diterima dari body.

GET /api/v1/staff/tenants/:slug/special-hours/:date menyelesaikan jam tanggal lokal: jika ada override, gunakan override termasuk tutup; jika tidak ada, gunakan weekday jadwal mingguan; tanpa keduanya, configured=false. Parsing tanggal memakai UTC sebagai representasi date-only, bukan mengonversi waktu kunjungan. Waktu operasional tetap timezone outlet.

Update override dan baris operational_audits berada pada satu transaksi. FK komposit audit memastikan aktor berasal dari tenant sama. Audit hanya mencatat actor ID, tenant ID, action dan waktu; tidak menyimpan password, cookie, kontak, prompt atau body bebas.

```sh
rtk proxy node --test apps/api/test/special-hours.integration.cjs apps/api/test/operational-audit.integration.cjs
```

Tes PostgreSQL membuktikan override tutup mengalahkan jadwal mingguan dan kegagalan FK audit menggagalkan perubahan jadwal (rollback), tanpa audit parsial. Suite audit operasional juga memaksa aktor invalid untuk tambah/edit menu, ketersediaan, meja, jadwal mingguan dan profil: seluruh perubahan ditolak tanpa write parsial. Fixture sintetis dibersihkan. Tes dashboard HTTP memeriksa delapan action audit dan kecocokan aktor owner/staff dari sesi. Daftar override menolak lebih dari 366 baris dengan konflik, tidak memotong hasil diam-diam, dan mensyaratkan tepat satu outlet aktif.

## Batas implementasi

- UI Hari khusus tersedia di bawah jadwal mingguan: owner simpan/hapus dengan konfirmasi; staff membaca. GET daftar dan DELETE :date tersedia pada route special-hours. Penghapusan dan audit atomic. Endpoint publik tanggal efektif belum tersedia.
- Mutasi HTTP menu, ketersediaan, meja, profil dan jadwal mingguan kini meneruskan aktor dari sesi dan menulis audit dalam transaksi yang sama. Audit tidak menyimpan payload bebas atau data kontak.
- Belum ada booking; pemeriksaan perubahan jadwal terhadap booking confirmed wajib ditambahkan sebelum booking aktif. Tidak ada booking yang dihapus atau dibatalkan oleh kode ini.
- Tes HTTP route hari khusus mencakup tanpa sesi, Origin asing, injeksi staffId, owner berhasil dan role staff ditolak. Tes resolver/hapus dan rollback audit PostgreSQL lulus. UI owner simpan/hapus dengan konfirmasi telah diuji pada tanggal sintetis; override hilang dari UI/DB sesudah penghapusan, audit saved/removed memiliki aktor owner, dan resolver kembali unconfigured ketika jadwal mingguan belum diatur. Kontrak dan regresi dashboard lulus.
- Jadwal publik mingguan tetap menandai dateExceptionsSupported=false; jangan menyebut endpoint itu sebagai status buka tanggal tertentu.
