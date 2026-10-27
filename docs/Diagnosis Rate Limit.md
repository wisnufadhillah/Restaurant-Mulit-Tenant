# Diagnosis Rate Limit

## Bukti terbaru

Pemeriksaan read-only akun sebelumnya: key diterima HTTP 200, kuota gratis harian used 1 dari limit 50, remaining 49. Ini tidak membuktikan bebas rate limit per menit atau upstream.

Parser metadata terpilih sekarang memeriksa angka header rate-limit/retry-after, presence provider_code dan error_type yang di-allowlist. Error body dibaca maksimal 64 KiB dalam memori untuk parsing; tidak dicetak atau disimpan. Error mentah tetap diteruskan ke SDK secara internal, sehingga logging provider harus dimatikan pada script diagnosis.

38 test assistant lulus sebelum percobaan. Satu inference diagnosis disetujui dan dijalankan pada 27 Oktober 2026 dengan google/gemma-4-26b-a4b-it:free, prompt sintetis pendek, max_tokens 32, tanpa tools, retry atau fallback. Hasil: satu request, HTTP 429, rate_limited, limit_scope unknown. Tidak ada indikator platform numerik atau penanda upstream yang dikenali parser.

## Kesimpulan

Akar penyebab spesifik masih belum terverifikasi. Sudah terbukti autentikasi endpoint akun berhasil, kuota harian yang dilaporkan masih tersisa pada pemeriksaan sebelumnya, dan bahkan request pendek tanpa tools ditolak 429. Karena itu masalah tidak khusus loop Agno atau schema tools. Tetap tidak dapat menyimpulkan rate limit provider atau platform tertentu tanpa indikator tambahan.

Tidak perlu terus mengubah kode agent untuk mengatasi 429, dan jangan mengulang request tanpa batas. Opsi selanjutnya: pengguna memeriksa Activity/Logs OpenRouter pada waktu percobaan dan melihat rincian error, atau menghubungi dukungan provider/platform dengan waktu dan model. Jangan kirim key, Authorization header atau screenshot credential. Jika error detail ditunjukkan ke tim, samarkan identitas/account data terlebih dahulu.

Tidak ada smoke tool sukses; pekerjaan pembuktian model tetap terbuka. Tidak ada pekerjaan fitur lanjutan, perubahan credential atau status Linear pada diagnosis ini. Tes berikutnya memerlukan keputusan baru dan tidak otomatis dijalankan.

## Kode

- error_metadata.py: ekstraksi bounded metadata tanpa raw message.
- model_transport.py: counter dan klasifikasi response.
- scripts/diagnose_model_live.py: satu inference eksplisit dengan --allow-live, bukan loop pengujian otomatis.

## Sources

- [OpenRouter: Limits](https://openrouter.ai/docs/api/reference/limits)
