# Pemeriksaan Kuota Model

## Pemeriksaan read-only

Endpoint GET https://openrouter.ai/api/v1/key diperiksa dengan key dari file privat lokal setelah izin pengguna. Tidak ada inference baru, pergantian key, perubahan account setting atau pembelian kredit.

Hasil pada 27 Oktober 2026:

- HTTP 200: key diterima untuk endpoint akun.
- is_free_tier true.
- Kuota request model gratis harian: used 1, limit 50, remaining 49.
- Tidak ada spend cap khusus key atau effective budget yang dilaporkan pada respons.
- Tidak ada key, saldo, ID akun, label key, atau raw response dicetak/disimpan.

Kesimpulan terbatas: pada waktu pemeriksaan, kuota harian yang dilaporkan belum habis. HTTP 429 sebelumnya tidak bisa dijelaskan sebagai kehabisan kuota harian berdasarkan hasil ini. Rate limit per menit, kapasitas upstream, atau proteksi platform tetap mungkin; hasil read-only ini tidak menentukan penyebab spesifik request yang sudah lewat.

## Interpretasi label

Perbandingan awal label API dengan nama tampilan Chatbot-key menghasilkan false. Itu bukan bukti key berbeda: dokumentasi endpoint menunjukkan label dapat berupa identifier key tersamarkan, bukan nama display dashboard. Perbandingan nama sudah dihapus dari script karena tidak valid sebagai diagnosis. Tidak ada perubahan key dilakukan.

## Mengapa belum akar penyebab pasti

Metadata yang sudah tersimpan dari inference hanya HTTP 429 dan category rate_limited. Tidak ada penanda scope, provider_code atau indikator platform rate-limit yang ditangkap pada saat respons itu diterima. Tidak bisa merekonstruksi nilai tersebut dari endpoint key sesudahnya. Kuota harian tersisa bukan bukti tidak ada limit per menit/provider.

Langkah berikutnya adalah menambah parser metadata error terpilih: presence provider_code, kategori error_type yang di-allowlist dan indikator header rate-limit numerik bila ada. Jangan menyimpan raw error message/body/header auth. Uji parser offline terlebih dahulu. Jika diperlukan satu inference diagnosis baru, minta persetujuan dengan batas request baru; tidak dilakukan pada pemeriksaan ini.

## Script

scripts/check_model_quota.py membaca key hanya untuk autentikasi server ke endpoint resmi, lalu mencetak indikator terpilih. Tidak melakukan inference atau memodifikasi environment/config. Jangan mencetak object konfigurasi atau raw respons.

## Sources

- [OpenRouter: Limits](https://openrouter.ai/docs/api/reference/limits)
- [OpenRouter: Get current key](https://openrouter.ai/docs/api/api-reference/api-keys/get-current-key)
