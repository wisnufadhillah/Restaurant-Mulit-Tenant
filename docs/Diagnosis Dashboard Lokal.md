# Diagnosis Dashboard Lokal

## Bukti

Suite dashboard pernah mendapat HTTP 503 pada dua langkah berbeda (penolakan staff dan update owner), lalu lulus pada pemeriksaan berikutnya tanpa perubahan business logic. Penyebab historis belum teridentifikasi. Jangan menganggap retry atau hasil lulus tunggal membuktikan gangguan sudah hilang.

## Kategori aman menu

Route /staff/menu menambahkan kode aman pada kegagalan:

- MENU_UPSTREAM_REJECTED: API benar-benar memberi respons gagal; upstreamStatus berisi status HTTP saja.
- MENU_TIMEOUT: fetch melampaui batas waktu.
- MENU_CONNECTION_FAILED: fetch/parsing upstream gagal; tidak menyatakan database pasti bermasalah.

Tidak ada body upstream, cookie, password atau stack yang diteruskan. Tidak ada retry otomatis pada mutasi. Error API 401/403/400/404 tetap dipertahankan; error server dipetakan menjadi 503. Kode membantu membedakan lapisan, bukan memperbaiki penyebab infrastruktur.

Suite dashboard kini berhenti dengan kategori allowlisted dan status upstream bila mendapatkan 5xx. Path query dan credential tidak dicetak. Probe sesi dan tenant sintetis dibersihkan setelah tes.

```sh
rtk proxy node --test apps/api/test/dashboard-web.integration.cjs
```

Jalankan dengan FE dan BE stabil; jangan kompilasi ke dist saat BE --watch aktif selama tes. Health API bukan bukti DB siap. Jangan menghentikan proses tidak dikenal atau menurunkan limiter untuk meloloskan suite.

## Status

Dua pemeriksaan pada sesi diagnosis ini lulus: sebelum dan sesudah penambahan kategori. Root cause 503 tetap belum terbukti; tidak ada perubahan pool DB, timeout atau izin tanpa evidence. Fault-injection kategori menu kini lulus untuk koneksi gagal, timeout dan upstream 400/401/403/404/503. Handler route asli dimuat dengan adapter Next/fetch minimal. Tes memastikan error izin tetap, no-store, satu panggilan upstream tanpa retry, serta token/detail upstream tidak dipantulkan. Ini bukan simulasi jaringan penuh. Dua regresi dashboard berikutnya juga lulus tanpa perubahan logic produksi. Tidak ada kegagalan baru yang menyediakan kategori penyebab; jangan terus mengulang tes tanpa hipotesis baru. Jika terjadi lagi, gunakan kategori untuk menentukan probe berikutnya, bukan mengulang request mutasi diam-diam.
