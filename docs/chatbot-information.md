# Informasi yang dapat dijawab chatbot

Chatbot membaca menu, harga, status menu, profil, alamat, kontak, lokasi aktif dan aturan reservasi dari API restoran. Jawaban singkat memakai teks biasa; kartu menu tetap berasal dari data API tervalidasi.

Profil menyertakan `weeklyHours` per outlet. `weekday` menggunakan Minggu=0 hingga Sabtu=6. Jam dinyatakan sebagai menit sejak tengah malam dalam zona waktu outlet. Nilai 600 berarti 10.00 dan 1440 berarti 24.00. Kedua endpoint bernilai null berarti tutup. Hari yang tidak tercatat berarti belum dikonfigurasi, bukan tutup.

Profil juga menyertakan `todayHours`, dihitung server berdasarkan tanggal Asia/Jakarta. Jadwal khusus hari ini mengalahkan jadwal mingguan, termasuk penutupan khusus. `configured: false` berarti belum ada jadwal, bukan tutup. Pertanyaan jam buka tanpa tanggal diarahkan ke jadwal hari ini. Pengecualian tanggal mendatang belum disertakan; pertanyaan besok atau tanggal lain tidak boleh dijawab sebagai kepastian berdasarkan mingguan saja. Jadwal buka tidak membuktikan sedang buka pada detik ini atau meja tersedia.

Daftar outlet hanya membuktikan lokasi aktif yang tercatat dalam sistem, bukan jumlah semua cabang restoran. Field yang tidak tersedia tidak membuktikan fasilitas atau layanan tidak ada. FAQ tanpa sumber, fasilitas, promo, sertifikasi dan pengantaran tidak boleh dikarang.

Instruksi model mengarahkan pemakaian sumber, tetapi bukan jaminan model selalu patuh. Tes stub membuktikan integrasi tool dan validasi data; kualitas bahasa dan pemilihan tool oleh model nyata memerlukan evaluasi live terpisah.
