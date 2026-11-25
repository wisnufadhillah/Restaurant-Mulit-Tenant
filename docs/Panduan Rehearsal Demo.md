# Panduan Rehearsal Demo dan Video Cadangan

Target durasi total demonstrasi: **12 menit** (rentang 10–15 menit) dengan pembagian peran dua pengembang:
- **Presenter A (Customer Flow)**: Menjalankan website publik, chatbot widget, form reservasi, checkout pesanan sandbox.
- **Presenter B (Staff & Ketahanan Sistem)**: Menjalankan dashboard staf, verifikasi sesi/audit, simulasi fallback gangguan model, dan narasi arsitektur.

## Persiapan Pra-Demo (5 Menit Sebelum Presentasi)

1. Pastikan database PostgreSQL aktif (`docker compose up -d --wait database`) dan ter-seed (`pnpm --filter @restaurant/api db:seed`).
2. Jalankan API + Agno gateway (`pnpm dev:api`) dan Web (`pnpm dev:web`).
3. Verifikasi liveness: `http://127.0.0.1:3001/api/v1/health` dan `http://127.0.0.1:8001/health`.
4. Siapkan satu browser window profil bersih untuk Customer (`http://127.0.0.1:3000`) dan satu Incognito/window terpisah untuk Staff (`http://127.0.0.1:3000/staff/login`).
5. Siapkan data sintetis baku:
   - Tenant demo: `demo-padang` (Restoran Padang Demo)
   - Nama pemesan sintetis: `Budi Santoso`
   - Kontak sintetis (hanya di form privat): `081200000001` / `budi.demo@example.test`
   - Tanggal reservasi uji: besok + 2 hari, jam `19:00`, `4` tamu.

## Skrip Alur Demonstrasi (6 Skenario)

### 1. Pelanggan Biasa Tanpa Chatbot (Menit 00:00 – 01:30 | Presenter A)
- Buka `http://127.0.0.1:3000`.
- Tunjukkan profil restoran, alamat, jam operasional hari ini, dan katalog menu beserta label tersedia/habis.
- Tekankan bahwa seluruh alur informasi dan reservasi utama bekerja penuh tanpa membuka widget chat.

### 2. Percakapan Informasi dan Ketersediaan (Menit 01:30 – 03:30 | Presenter A)
- Buka widget chatbot di pojok kanan bawah.
- Kirim pertanyaan: `"Menu apa yang tersedia dan jam berapa buka hari ini?"` -> tunjukkan jawaban bersumber API + kartu menu.
- Kirim pertanyaan: `"Cek ketersediaan meja tanggal <H+2> jam 19:00 untuk 4 orang"` -> tunjukkan status ketersediaan dari API dan pesan bahwa meja **belum ditahan**, disertai tombol navigasi ke `#reservasi`.
- Uji privasi singkat: ketik nomor telepon sintetis di chat -> tunjukkan respons `input` disamarkan (`[nomor disamarkan]`).

### 3. Reservasi dan Pembatalan Privat (Menit 03:30 – 05:30 | Presenter A)
- Klik tombol navigasi ke form reservasi `#reservasi`.
- Isi data sintetis (`Budi Santoso`, kontak privat, 4 orang, tanggal H+2 jam 19:00).
- Klik **Periksa Ringkasan** -> tunjukkan ringkasan terstruktur (belum booking).
- Klik **Konfirmasi Reservasi** -> tunjukkan bukti reservasi privat (`confirmed`) dan kode referensi.
- Buka halaman kelola reservasi dari sesi privat tersebut dan lakukan **Batalkan Reservasi** (sebelum batas 2 jam) -> tunjukkan status berubah menjadi `cancelled`.

### 4. Pesanan dan Pembayaran Sandbox Midtrans (Menit 05:30 – 08:00 | Presenter A)
- Di widget chat, ketik: `"Buatkan usulan pesanan 2 Rendang Sapi"`.
- Tunjukkan draft usulan pesanan dengan harga dari database + tombol aksi **Tambah ke pesanan**.
- Klik **Checkout Pesanan** -> isi nama pemesan sintetis -> muncul modal/halaman Midtrans Snap Sandbox.
- Selesaikan simulasi pembayaran di Snap Sandbox (Bank Transfer / VA Simulator).
- Tunjukkan status pesanan di antarmuka pelanggan diperbarui menjadi **Lunas (`settlement`)** setelah notifikasi webhook terverifikasi.

### 5. Operasional Staf & Keamanan Sesi (Menit 08:00 – 10:30 | Presenter B)
- Login di `http://127.0.0.1:3000/staff/login` menggunakan akun staf demo.
- Tunjukkan daftar meja, toggle ketersediaan menu (misal menandai 1 menu habis dan terlihat di halaman publik), daftar reservasi, serta daftar pesanan & riwayat transisi pembayaran (`pending -> settlement`) tanpa ada token Snap atau URL pembayaran privat yang terekspos.
- Jelaskan batas keamanan sesi: idle timeout 30 menit dan batas absolut 8 jam yang ditegakkan server.

### 6. Ketahanan Sistem / Fallback (Menit 10:30 – 12:00 | Presenter B)
- Hentikan sementara service assistant (atau simulasikan timeout/gangguan OpenRouter).
- Kirim pesan `"Saya ingin reservasi"` di widget chat.
- Tunjukkan bahwa antarmuka chat tidak crash dan langsung menampilkan pesan fallback terarah beserta tombol navigasi ke form web `#reservasi`.

## Prosedur Rekaman Cadangan (Mitigasi Gangguan Live)

1. Rekam layar (OBS / Windows Game Bar `Win+Alt+R`, resolusi minimal 1080p) saat menjalankan skenario 1–6 di lingkungan lokal yang stabil.
2. Tambahkan overlay/label teks permanen di sudut layar atau slide pembuka: **"ARSIP REKAMAN CADANGAN — BUKAN EKSEKUSI LIVE"**.
3. Simpan berkas MP4 ke direktori presentasi `.local/demo-backup/demo-rehearsal-backup.mp4` (atau folder presentasi tim).
4. Jika saat presentasi terjadi gangguan kuota OpenRouter atau Midtrans Sandbox, putar rekaman cadangan dan bacakan catatan narasi per segmen waktu di atas secara sinkron.
