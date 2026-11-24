# Rehearsal Backup dan Restore Database

## Tujuan

Memvalidasi bahwa prosedur pencadangan (backup) dan pemulihan (restore) data operasional restoran (database PostgreSQL beserta volume berkas foto menu) dapat dieksekusi secara cepat, andal, dan tanpa kehilangan integritas relasi maupun constraint.

## Latar Belakang

Kegagalan database atau kerusakan data pada saat demonstrasi atau operasional staging memerlukan prosedur pemulihan yang telah teruji sebelumnya. Prosedur ini harus dibuktikan pada basis data terpisah tanpa menimbulkan risiko kerusakan pada basis data staging aktif.

## Ruang Lingkup

1. **Pembuatan Cadangan Data**:
   - Menghasilkan berkas dump terkompresi dari database PostgreSQL yang mencakup seluruh 21 model aplikasi, tipe data khusus, ekstensi, dan exclusion constraint.
   - Mengarsipkan direktori penyimpanan foto menu yang tersimpan di sistem berkas.
2. **Pemulihan pada Lingkungan Bersih**:
   - Menyiapkan database pengujian sementara yang bersih (misal `restaurant_restore_test`).
   - Mengeksekusi perintah pemulihan data (`pg_restore` atau `psql`) ke database pengujian tersebut.
3. **Pemeriksaan Integritas Pasca-Pemulihan**:
   - Menghitung jumlah entitas utama (tenant, outlet, meja, menu, jam buka, reservasi, pesanan) untuk memastikan tidak ada data yang hilang.
   - Menguji bahwa relasi foreign key komposit tetap valid.
   - Menguji bahwa exclusion constraint pencegah overlap reservasi tetap aktif dan berfungsi pada database hasil pemulihan.
   - Memastikan berkas foto menu dapat diakses dan cocok dengan metadata database.
4. **Pembersihan Lingkungan Pengujian**:
   - Menghapus database dan direktori sementara setelah verifikasi selesai.

## Kriteria Selesai

- [ ] Perintah dump database berjalan sukses tanpa galat izin atau pemotongan skema.
- [ ] Perintah restore pada database sementara selesai dengan kode keluar 0.
- [ ] Verifikasi skema mengonfirmasi keberadaan seluruh tabel dan constraint integritas.
- [ ] Data kueri sampel membuktikan akun staf, meja, katalog menu, dan jam buka berfungsi normal pasca-pemulihan.
- [ ] Prosedur langkah-langkah pemulihan terdokumentasi jelas dan siap dipakai jika terjadi insiden saat demonstrasi.

## Langkah Pengerjaan

1. Eksekusi perintah `pg_dump` dengan format custom/tar terkompresi pada database lokal sumber.
2. Buat database pengujian lokal baru menggunakan perintah pembuatan database standar.
3. Jalankan `pg_restore` ke database pengujian baru tersebut dan catat seluruh pesan keluaran.
4. Jalankan kueri validasi penghitungan baris tabel dan uji insert reservasi uji coba untuk memastikan exclusion constraint aktif.
5. Verifikasi keterbacaan berkas aset foto menu terhadap kunci penyimpanan di database.
6. Catat durasi proses dan panduan perintah pemulihan darurat.
