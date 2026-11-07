# FAQ website restoran

## Status dan penggunaan

Lima jawaban bantuan penggunaan website berikut telah disetujui dan dipublikasikan pada database lokal untuk tenant demo-padang sebagai revision 1. Publikasi tidak berlaku bagi tenant lain dan bukan deployment publik. Jawaban tidak menetapkan kebijakan restoran yang belum diketahui. Perubahan teks berikutnya memerlukan revision dan persetujuan baru.

## Kandidat pertanyaan dan jawaban

### Apakah saya perlu akun untuk menggunakan website?

Halaman publik dan form reservasi dapat digunakan tanpa membuat akun customer. Pengelolaan reservasi memerlukan sesi privat yang sesuai; kode referensi saja tidak memberi akses. State pemulihan terikat tab. Browser yang sama, tab baru, atau perangkat lain tidak menjamin akses maupun pemulihan.

### Apakah saya bisa membuat atau membatalkan booking lewat chat?

Chat membantu informasi restoran, menu dan FAQ. Untuk membuat, melihat atau membatalkan booking, gunakan bagian Reservasi pada website. Jangan kirim kontak atau kode akses melalui chat.

### Mengapa saya diminta memeriksa ringkasan sebelum mengonfirmasi?

Ringkasan membantu memeriksa detail kunjungan. Ringkasan bukan booking dan tidak menahan meja. Backend memeriksa ulang saat konfirmasi; booking hanya dinyatakan tersimpan setelah transaksi berhasil.

### Apakah kode referensi cukup untuk melihat booking?

Tidak. Kode referensi adalah penanda booking, bukan credential. Gunakan akses privat yang masih sah. Pembatalan memerlukan sesi berwenang serta referensi yang cocok dengan reservasi yang ditampilkan. Jangan membagikan cookie, token atau data akses. Jika akses tidak dapat dipulihkan, jangan menganggap booking otomatis batal dan jangan membuat booking pengganti tanpa memastikan statusnya.

### Apa yang dilakukan jika respons konfirmasi terputus?

Jika website masih menyediakan pemulihan percobaan tersebut, gunakan alur itu dengan key dan detail yang sama. Jangan mengirim form baru, membuat booking pengganti atau mengganti detail ketika hasil belum pasti. Pemulihan tidak dijamin setelah state tab hilang atau saat berpindah perangkat. Ketersediaan yang berubah bukan bukti bahwa percobaan sebelumnya gagal.

## Dasar klaim dan tinjauan isi

| Kandidat | Dasar teknis yang perlu diperiksa saat publikasi | Status persetujuan isi |
| --- | --- | --- |
| Tanpa akun customer | Form reservasi publik dan sesi pembuat pada service reservasi; bukan login customer | Published lokal, revision 1 |
| Chat dan form terpisah | Allowlist tools conversation runner dan form Reservasi | Published lokal, revision 1 |
| Ringkasan belum menahan meja | Perhitungan availability held=false dan validasi ulang transaksi create | Published lokal, revision 1 |
| Referensi bukan credential | Pemeriksaan creator/management session pada API; referensi tampilan hanya pencocokan saat cancel | Published lokal, revision 1 |
| Respons terputus | Replay key/payload sama pada repository serta state pemulihan UI | Published lokal, revision 1 |

Dasar teknis ini tidak membuktikan kebijakan fasilitas restoran. Saat publikasi, developer perlu mencocokkan setiap jawaban dengan perilaku aplikasi terkini dan mencatat persetujuan isi; jangan menyalin nama file internal atau metadata approval ke cuplikan customer.

## Fakta yang tidak disimpan sebagai FAQ

Harga, menu tersedia/habis, jam buka/hari khusus, kapasitas, slot meja, cutoff dan status booking harus dibaca dari API yang sesuai. Penjelasan umum tidak menggantikan validasi transaksi. Kontak customer, reservasi individual dan credential tidak boleh dimasukkan ke dokumen knowledge.

## Pertanyaan yang menunggu fakta dari pemilik

- Apakah boleh membawa kue atau makanan dari luar?
- Apakah tersedia parkir, akses kursi roda, ruang privat atau fasilitas keluarga?
- Apakah ada sertifikasi halal, batas diet atau informasi alergen yang sudah diverifikasi?
- Apa kebijakan hewan peliharaan, dekorasi, acara atau barang tertinggal?

Tidak ada jawaban positif/negatif untuk pertanyaan ini sampai pemilik menyediakan fakta dan menyetujui redaksinya. Dokumen tidak boleh mengisi kekosongan dengan asumsi atau data simulator.

## Publikasi

Developer menyiapkan draft per tenant, memeriksa sumber dan privasi, lalu meminta persetujuan isi. Hanya revision yang dipublikasikan dan ditunjuk sebagai revision aktif boleh dipakai retrieval. Penggantian revision dan unpublish perlu mengubah snapshot retrieval secara konsisten. Lima jawaban di atas telah dimasukkan melalui transaksi publikasi lokal. Tidak ada jawaban fasilitas atau kebijakan restoran lain yang ikut diterbitkan.
