# Daftar reservasi untuk pengelola

Dashboard tab Reservasi terhubung ke endpoint read-only. Owner dan staff terautentikasi dapat membaca daftar/detail hanya untuk tenant sesi mereka. Tidak ada perubahan status, ekspor, atau akses customer melalui endpoint ini.

## Alur

```text
Dashboard ReservationManager
  → GET /staff/reservations dengan filter
  → proxy membaca cookie staff dan tenant
  → API /api/v1/staff/tenants/:slug/reservations
  → autentikasi role dan tenant
  → query tenant-scoped dengan select field terbatas
```

Daftar menerima date (YYYY-MM-DD), status confirmed/cancelled/completed/no_show dan page 1–999. Date berarti tanggal mulai kunjungan menurut WIB, bukan UTC. Ukuran halaman tetap 20; urutan startAt lalu id. Count dan rows dibaca dalam transaksi RepeatableRead. Detail memakai GET route /reservations/:id; proxy frontend menggunakan parameter id dan tidak boleh mencampurnya dengan filter.

Nama tamu ditampilkan pada daftar, kontak hanya pada detail. Hash token, idempotency key, request hash dan credential tidak dikirim. Referensi saja tidak memberikan akses; sesi staff aktif pada tenant yang cocok tetap wajib. Semua respons no-store. Jangan memasukkan detail booking ke chatbot, log atau screenshot dengan identitas nyata.

## Verifikasi dan batas

Tes lokal memeriksa filter ketat, konversi tanggal WIB, scope query/count, pemilihan field, dan foreign/missing ID sebagai 404. Typecheck API/web lulus. Tes HTTP menggunakan controller Nest dan StaffService nyata, dengan boundary DB tiruan: owner/staff diizinkan, cookie hilang/expired/revoked/tenant lain dan role asing ditolak, query invalid tidak memanggil query reservasi, list tidak mengirim phone/hash, detail missing 404, dan dependency failure disanitasi. Regresi API terbaru 76 tes lulus. Dua tes browser desktop/emulasi mobile memeriksa akses tanpa sesi: proxy 401 no-store dan dashboard redirect login. Tes browser terautentikasi tambahan kini lulus dengan PostgreSQL nyata: owner desktop melihat 21 booking dan pagination 20+1, filter tanggal bekerja, staff viewport 390px melihat booking tenant sendiri, detail menampilkan kontak sintetis dan foreign ID ditolak 404 melalui proxy. Cookie fixture dipasang pada browser; alur login/password tidak menjadi cakupan tes ini. OpenAPI memuat route list/detail; schema response detail masih ringkas.

Harness `staff-reservations.integration.cjs` disiapkan untuk dua tenant sintetis, satu outlet/meja/staff/session per tenant serta 22 reservasi pembeda. Seluruh 32 baris fixture berada dalam satu transaksi rollback; query/auth/controller nyata memakai transaksi yang sama, bukan fixture committed. Tes memeriksa pagination 20+1, filter tanggal/status, detail privat, foreign ID 404 dan cross-slug 401. Tes dijalankan setelah izin fixture pada PostgreSQL lokal 127.0.0.1:55432/restaurant dan lulus; rollback diverifikasi dengan nol tenant fixture tersisa. Flag ALLOW_LOCAL_STAFF_RESERVATION_WRITES=1 tetap wajib sebagai pengaman teknis. Mode RUN_STAFF_RESERVATION_BROWSER=1 menambahkan browser/proxy Next.js dengan server dev terisolasi port 3120. Transaksi snapshot independen belum diuji karena seluruh fixture dan query berbagi transaksi luar. Driver pg mengeluarkan deprecation warning saat request berbagi satu koneksi; ini keterbatasan harness, bukan bukti request production paralel lulus.

Review akhir memperbaiki pemisahan filter draft dan filter terapan: pagination memakai filter terakhir yang disubmit, bukan perubahan input yang belum diterapkan. Tes browser memeriksa edit tanggal sebelum Next tetap menghasilkan halaman kedua dari 21 booking. Detail gagal 401/403 menghapus daftar dan total privat; response lama ditahan oleh generation guard. BFF menolak id kosong. Typecheck API/web, 76 tes API, browser PostgreSQL rollback dan build Next lulus setelah perbaikan filter; koreksi kecil id kosong diperiksa terpisah lewat typecheck.

Tampilan reservasi memakai filter toolbar yang konsisten, referensi ringkas pada tabel dengan kode penuh pada detail, badge status tanpa pecah kata dan aksi Lihat detail tanpa mengulang UUID secara visual. Detail memakai panel read-only dengan grid berlabel, waktu, jumlah tamu, lokasi dan meja. Fokus pindah ke heading saat dibuka dan kembali ke pemicu saat ditutup. Tes browser fixture memeriksa fokus dan tidak ada overflow halaman pada desktop serta viewport 390px; tabel boleh digeser lokal. Kontras/screen reader, zoom 400% dan perangkat fisik belum diverifikasi.

Ikhtisar kini mengambil endpoint daftar reservasi yang sama: kartu jumlah menampilkan total semua tanggal/status dan panel menampilkan maksimal lima kunjungan menurut urutan kedatangan. Data dimuat saat tab dibuka atau tombol Segarkan data ditekan; bukan realtime/push. Kegagalan tampil sebagai tidak dapat dimuat, bukan nol palsu. Tes browser PostgreSQL membuktikan total 21 untuk owner dan 1 untuk staff tenant pembeda, dengan ringkasan maksimal lima. Tidak ada kontak telepon dalam ringkasan.

Pemeriksaan penutupan menambahkan pencabutan sesi fixture setelah daftar dan kontak detail tampil. Pada desktop, Muat ulang; pada viewport 390px, Lihat detail berikutnya: keduanya menghasilkan pesan sesi berakhir dan menghapus row, heading detail, telepon serta total lama. Tidak ada push revocation saat halaman idle; pembersihan diverifikasi pada request berikutnya. Regresi akhir: 76 tes API, 18 tes browser umum, compile API dan build Next lulus; integrasi browser PostgreSQL rollback juga lulus. Suite browser umum memakai mock untuk sebagian alur, berbeda dari harness PostgreSQL terautentikasi. Login/password tidak diuji ulang oleh harness ini.

Belum ada aksi cancel, completed atau no_show untuk staff. Pekerjaan ini tidak mengubah schema atau menulis database. Tahap berikutnya melengkapi tes HTTP/DB negatif dan UI browser, kemudian merancang mutasi status atomic dengan audit secara terpisah.
