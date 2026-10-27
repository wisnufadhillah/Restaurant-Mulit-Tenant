# Smoke Model Berhasil

## Hasil aktual

Pada 27 Oktober 2026 pukul 14:55:16 UTC, satu percobaan live terkontrol memakai nvidia/nemotron-3.5-lightning:free berhasil melewati pemeriksaan dasar. Kandidat cadangan poolside/laguna-xs-2.1:free tidak dipanggil karena model utama sukses. Tidak ada perubahan file .env pengguna.

| Ukuran | Hasil |
| --- | --- |
| Status gateway | ok |
| Request inference | 2, keduanya HTTP 200 |
| Tool call | 1 |
| Nama restoran sesuai fixture | Ya |
| Pemeriksaan dasar script | passed true |
| Data tool | Fixture sintetis Restoran Padang Demo, bukan DB live |
| Provider aktual respons | Belum direkam |

Sebelum inference, katalog publik mencantumkan tools dan tarif prompt/completion nol. Pemeriksaan endpoint publik mencantumkan provider Nvidia untuk kandidat utama dan Poolside untuk cadangan; ini informasi katalog, bukan metadata provider yang terbukti pada respons aktual.

## Arti keberhasilan

Model nyata meminta get_restaurant_info, menerima profil sintetis dan mengembalikan jawaban akhir yang memuat nama yang benar. Ini memenuhi smoke dasar tool roundtrip, berbeda dari percobaan Liquid yang hanya berhasil pada request awal. Tidak ada retry otomatis, fallback berbayar, pengiriman data customer atau DB credential. Total dua request dari budget maksimum empat; satu agent, bukan multi-agent.

Pemeriksaan otomatis script mencocokkan nama restoran dan jumlah tool call, tidak membuktikan seluruh jawaban bebas halusinasi, Bahasa Indonesia sempurna, atau semua skenario lulus. Raw response tidak disimpan. Provider aktual belum dicatat; kualitas Bahasa Indonesia dan argumen invalid pada model live belum diverifikasi khusus. Tes schema invalid, timeout dan fallback yang ada berasal dari pengujian offline.

Cadangan belum lulus live dan belum boleh disebut model cadangan teruji. Model utama baru kandidat dengan satu keberhasilan dasar, bukan jaminan ketersediaan/SLA. Hasil 429 lama tetap valid untuk percobaan dan provider sebelumnya, tidak dihapus.

## Pembatas fallback

Default modul tetap tiga request total; percobaan yang secara eksplisit disetujui ini memakai total_request_limit empat, maksimum tiga per attempt, dua kandidat dan deadline bersama 30 detik. Cadangan hanya dimulai bila masih ada minimal dua request untuk roundtrip tool. HTTP 429 hanya dapat memicu pergantian ketika metadata mengidentifikasi scope upstream; platform/unknown tidak dipakai untuk mencoba melewati limit akun.

40 test assistant lulus sebelum live, termasuk budget empat request dan pemisahan 429 upstream/platform/unknown. Sukses utama tidak membuktikan pergantian live; failover masih bukti offline.

## Status pekerjaan

Belum ada perubahan Linear. Sebelum menutup issue pembuktian model, tim perlu menilai apakah bukti dasar ditambah tes negatif offline memenuhi acceptance, dan melengkapi catatan provider aktual serta penilaian Bahasa Indonesia yang belum tersedia. Tidak melanjutkan fitur berikutnya berdasarkan klaim selesai yang belum disepakati. Uji live tambahan tetap membutuhkan batas yang jelas dan persetujuan.

Ringkasan aman tersimpan pada file failover-smoke bertimestamp dalam .local yang diabaikan Git. Tidak menyimpan key, header auth atau body respons mentah.

## Sources

- [OpenRouter: Model catalogue](https://openrouter.ai/api/v1/models)
- [OpenRouter: Model fallbacks](https://openrouter.ai/docs/guides/routing/model-fallbacks)
