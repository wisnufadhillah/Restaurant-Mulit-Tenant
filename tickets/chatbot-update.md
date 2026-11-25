Berikut poin perbaikan versi biasa, langsung bisa dipakai sebagai daftar kerja/backlog:

## Prioritas tinggi

1. **Perbaiki alur pemesanan agar mendukung banyak item**
   - Jangan langsung membuat nomor pesanan dan mengarahkan ke pembayaran setelah satu item ditambahkan.
   - Terapkan konsep keranjang: pelanggan bisa menambah item lain, mengubah jumlah, dan menghapus item.
   - Ganti tombol “Bayar Sekarang” menjadi “Lanjut ke Pembayaran”.
   - Tampilkan ringkasan pesanan sebelum pelanggan konfirmasi.
   - Buat nomor pesanan baru setelah konfirmasi, bukan saat item pertama masuk.

2. **Perbaiki perintah tambah item lewat chat**
   - Chatbot harus bisa memproses perintah seperti “tambahkan ayam pop 3”.
   - Setelah diproses, perbarui isi keranjang dan tampilkan konfirmasi singkat, misalnya total pesanan terbaru.
   - Jika perintah tidak dikenali, tampilkan pesan jelas dan arahkan ke tombol “Tambah ke Pesanan”, jangan hanya menampilkan daftar menu.

3. **Simpan sesi percakapan dan keranjang**
   - Riwayat chat dan isi keranjang harus tetap ada saat browser di-refresh.
   - Simpan sesi di penyimpanan browser atau server dengan ID sesi.
   - Sediakan tombol “Mulai percakapan baru” jika pelanggan memang ingin mengulang dari awal.

4. **Cegah penumpukan pesanan berstatus “Menunggu pembayaran”**
   - Pesanan yang belum dikonfirmasi/dibayar sebaiknya punya mekanisme kedaluwarsa atau pembatalan.
   - Jangan buat status pesanan terlalu dini sebelum pelanggan menyelesaikan konfirmasi.

## Prioritas sedang

5. **Tambahkan navigasi kembali ke menu utama**
   - Tampilkan tombol “Kembali ke menu utama” di setiap balasan submenu.
   - Tampilkan ulang pilihan cepat yang relevan setelah bot menjawab.
   - Pastikan chatbot memahami perintah ketik seperti “menu utama” atau “kembali”.
   - Pertimbangkan menu yang selalu terlihat di atas kolom ketik.

6. **Perbaiki teks dan bahasa**
   - Ubah keterangan pendek bergaya instruksi sistem menjadi kalimat utuh yang jelas, sopan, dan berorientasi pelanggan.
   - Contoh: “Tanpa akun · Durasi makan 90 menit” menjadi kalimat yang menjelaskan bahwa reservasi bisa dilakukan tanpa akun dan berlaku 90 menit.
   - Hindari frasa teknis yang membuat pelanggan harus menebak maksudnya.

## Saran pengembangan

7. **Tambahkan notifikasi status pembayaran dan pesanan**
   - Minta kontak pelanggan melalui form privat dengan persetujuan, bukan diketik di chat.
   - Simpan identitas pemesan pada tahap konfirmasi.
   - Kirim notifikasi saat pembayaran berhasil dan saat status pesanan berubah, misalnya diproses, siap diambil, atau diantar.

## Pengecekan akhir

8. **Uji ulang skenario utama**
   - Pesan lebih dari satu item dalam satu transaksi.
   - Tambah item lewat chat dengan jumlah tertentu.
   - Refresh browser saat percakapan dan keranjang berisi data.
   - Masuk submenu lalu kembali ke menu utama.
   - Konfirmasi pesanan dan cek status pembayaran/pesanan.