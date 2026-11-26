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

- [x] Perintah dump database berjalan sukses tanpa galat izin atau pemotongan skema (`pg_dump` ke `.local/backups/restaurant_*.dump`).
- [x] Perintah restore pada database sementara selesai dengan kode keluar 0 (`pg_restore` ke `restaurant_restore_test`).
- [x] Verifikasi skema mengonfirmasi keberadaan seluruh 22 tabel dan constraint integritas (exclusion constraint `reservations_confirmed_no_overlap` aktif).
- [x] Data kueri sampel membuktikan akun staf, meja, katalog menu, dan jam buka berfungsi normal pasca-pemulihan (tenants 2, outlets 2, dining_tables 9, menu_items 16, weekly_hours 14, reservations 1, orders 2, staff 4).
- [x] Prosedur langkah-langkah pemulihan terdokumentasi jelas dan siap dipakai jika terjadi insiden saat demonstrasi (`scripts/rehearsal_backup_restore.ps1`).

## Prosedur Pemulihan Darurat (Runbook)

Skrip otomatis tersedia di [`scripts/rehearsal_backup_restore.ps1`](../scripts/rehearsal_backup_restore.ps1):

```powershell
powershell -ExecutionPolicy Bypass -File scripts/rehearsal_backup_restore.ps1
```

Langkah manual darurat jika terjadi insiden saat demo:
1. Pastikan database target aktif (`docker compose up -d --wait database`).
2. Buat cadangan: `pg_dump -h 127.0.0.1 -p <port> -U restaurant -Fc -f .local/backups/restaurant.dump restaurant`.
3. Pulihkan ke database bersih: `createdb` lalu `pg_restore -h 127.0.0.1 -p <port> -U restaurant -d <target_db> --no-owner --no-privileges .local/backups/restaurant.dump`.
4. Pulihkan berkas foto menu ke `.local/menu-images/` dari arsip `.local/backups/menu-images_*.zip`.
5. Verifikasi jumlah tabel, exclusion constraint (`SELECT conname FROM pg_constraint WHERE contype = 'x';`), dan kueri sampel entitas utama sebelum mengarahkan layanan.

## Status Eksekusi

- Skrip rehearsal `scripts/rehearsal_backup_restore.ps1` berhasil dieksekusi secara live terhadap database lokal (PostgreSQL 17.8 via Docker) dalam 2.16 detik.
- Hasil verifikasi pasca-restore: 22 tabel, exclusion constraint `reservations_confirmed_no_overlap` terverifikasi aktif, seluruh baris entitas inti utuh, dan database pengujian sementara dibersihkan secara otomatis.

## Langkah Pengerjaan

1. Eksekusi perintah `pg_dump` dengan format custom/tar terkompresi pada database lokal sumber.
2. Buat database pengujian lokal baru menggunakan perintah pembuatan database standar.
3. Jalankan `pg_restore` ke database pengujian baru tersebut dan catat seluruh pesan keluaran.
4. Jalankan kueri validasi penghitungan baris tabel dan uji insert reservasi uji coba untuk memastikan exclusion constraint aktif.
5. Verifikasi keterbacaan berkas aset foto menu terhadap kunci penyimpanan di database.
6. Catat durasi proses dan panduan perintah pemulihan darurat.
