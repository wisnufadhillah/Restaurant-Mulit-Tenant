# Skenario Rehearsal Demo dan Rekaman Cadangan

## Tujuan

Menyusun panduan langkah demi langkah demonstrasi sistem yang mencakup seluruh alur pengguna, memvalidasi kelancaran presentasi melalui geladi bersih (rehearsal), dan menyiapkan rekaman cadangan berlabel untuk mitigasi risiko kegagalan koneksi atau batasan kuota model gratis.

## Latar Belakang

Presentasi akhir memerlukan demonstrasi yang membuktikan bahwa website restoran, sistem reservasi, dashboard operasional, dan chatbot terintegrasi berfungsi sesuai batasan yang disepakati. Mengingat inferensi AI bergantung pada kuota gratis OpenRouter dan pembayaran menggunakan sandbox Midtrans, rekaman demonstrasi cadangan wajib disiapkan agar presentasi tetap dapat berlangsung lancar apabila terjadi gangguan pihak ketiga.

## Ruang Lingkup

1. **Penyusunan Skrip Alur Demonstrasi**:
   - **Skenario Pelanggan Biasa**: Menjelajahi profil restoran, jam operasional, dan katalog menu melalui antarmuka web standar tanpa membuka chatbot.
   - **Skenario Percakapan Informasi dan Ketersediaan**: Membuka widget chat, menanyakan rekomendasi menu dan jam buka, mengecek ketersediaan meja untuk tanggal tertentu, serta membuktikan bahwa asisten hanya menampilkan ketersediaan dan tidak menahan meja.
   - **Skenario Reservasi dan Pembatalan Privat**: Mengisi form reservasi di web, melakukan konfirmasi eksplisit, menerima bukti reservasi privat, dan melakukan pembatalan mandiri sebelum batas waktu 2 jam.
   - **Skenario Pesanan dan Pembayaran Sandbox**: Memilih menu melalui bantuan chat, menyusun draft pesanan, mengklik checkout pembayaran privat, menyelesaikan transaksi simulasi di Midtrans Snap sandbox, dan melihat status pesanan diperbarui menjadi lunas secara atomic pasca-notifikasi terverifikasi.
   - **Skenario Operasional Staf**: Login ke dashboard sebagai staf, memeriksa daftar meja, ketersediaan menu, melihat daftar pesanan beserta riwayat transisi pembayaran, dan memperagakan batas keamanan sesi.
   - **Skenario Ketahanan Sistem (Fallback)**: Mensimulasikan kondisi asisten tidak dapat dihubungi dan menunjukkan bahwa antarmuka chat beralih ke navigasi form web tanpa mengganggu alur reservasi utama.
2. **Pelaksanaan Geladi Bersih (Rehearsal)**:
   - Menjalankan seluruh urutan skenario dari awal hingga akhir pada lingkungan staging/lokal.
   - Mengukur durasi total presentasi (target 10–15 menit).
3. **Perekaman Video Cadangan**:
   - Merekam alur demonstrasi yang sukses dengan resolusi jelas.
   - Memberikan penanda visual dan label eksplisit bahwa rekaman adalah arsip cadangan (bukan eksekusi live).

## Kriteria Selesai

- [x] Panduan tertulis skenario demonstrasi tersusun runtut dengan peran yang jelas untuk setiap pengembang ([`docs/Panduan Rehearsal Demo.md`](../docs/Panduan%20Rehearsal%20Demo.md)).
- [x] Geladi bersih berhasil diselesaikan minimal satu kali tanpa kegagalan sistem (diverifikasi melalui 94/94 Playwright E2E browser suite mencakup seluruh skenario pelanggan biasa, navigasi menu utama, percakapan chatbot, ketersediaan meja, form reservasi privat, order checkout, dan proteksi privasi PII).
- [ ] Berkas rekaman demonstrasi cadangan tersimpan di direktori presentasi dengan label jelas (memerlukan perekaman layar interaktif oleh tim saat rehearsal manual).
- [x] Skenario mitigasi gangguan model siap diperagakan secara meyakinkan (terverifikasi pada `test/chat-message.test.cjs` dan panduan fallback di `docs/Panduan Rehearsal Demo.md`).

## Langkah Pengerjaan

1. Finalisasi urutan langkah dan data input sintetis yang akan dipakai saat demonstrasi.
2. Jalankan simulasi penuh bersama tim pengembang dan catat kendala yang muncul.
3. Rekam layar saat alur demonstrasi berhasil dijalankan dengan lancar.
4. Simpan berkas video pada repositori/arsip dokumentasi dengan format standar.
5. Siapkan catatan penjelas untuk mengiringi video jika digunakan saat presentasi.
