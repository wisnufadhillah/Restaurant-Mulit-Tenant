# Hasil Smoke Model

## Hasil aktual

Smoke live dilakukan sekali dengan persetujuan pengguna pada 27 Oktober 2026, menggunakan model liquid/lfm-2.5-2.6b:free. Katalog publik saat preflight mencantumkan dukungan tools dan tarif prompt/completion nol. Tidak ada fallback model berbayar atau retry otomatis.

| Ukuran | Hasil |
| --- | --- |
| Status gateway | unavailable |
| Lulus end-to-end | Tidak |
| Request model yang diteruskan | 2 |
| Tool call | 1 |
| Durasi loop | 1,859 detik |
| Nama restoran cocok pada jawaban akhir | Tidak |
| Provider upstream | Belum ditangkap |
| Raw response disimpan | Tidak |

Pertanyaan meminta nama restoran dengan tool. Tool memberikan profil sintetis Restoran Padang Demo melalui fixture HTTP, bukan database nyata. Nama/key/telepon customer tidak dikirim. API key dipakai hanya oleh SDK server untuk autentikasi dan tidak ditampilkan dalam output atau docs.

## Percobaan kedua

Smoke ulang disetujui terpisah dan dijalankan 27 Oktober 2026 pukul 10:18:32 UTC, dengan model dan fixture sama. Hasil: unavailable, satu request model, nol tool call, durasi 1,797 detik. Metadata request pertama: HTTP 429, category rate_limited. Tidak ada retry otomatis atau model cadangan.

Percobaan kedua terhenti karena rate limiting sebelum tool dijalankan. Metadata ini belum membedakan pembatasan akun OpenRouter dengan kapasitas/rate limit provider upstream. Jangan menganggap key invalid atau menyimpulkan batas harian tanpa pemeriksaan tambahan. Hasil pertama tetap dicatat di atas dan penyebabnya belum dapat direkonstruksi dari percobaan kedua.

Tidak dilakukan panggilan ketiga. Tunggu ketersediaan/kuota atau pilih kandidat gratis lain setelah keputusan pengguna; jangan mengakali limit dengan akun tambahan. PRO-110 tetap belum selesai.

## Arti hasil

Model meminta tool dan fungsi dijalankan sekali. Ini bukti sebagian tool calling live, bukan bukti jawaban akhir benar. Setelah dua request, gateway memetakan kondisi menjadi unavailable. Belum ada metadata HTTP/status upstream yang cukup untuk menyimpulkan akar kegagalan. Jangan menyebut key invalid, kuota habis atau model tidak mendukung tools tanpa bukti tambahan.

Fallback aman dihasilkan alih-alih menyatakan jawaban sukses. Nama restoran tidak muncul pada fallback sehingga expected_name_present false; itu tidak berarti tool kehilangan nama. Tidak ada percobaan ulang otomatis untuk mengubah hasil gagal menjadi laporan sukses.

## Implementasi dan cara menjalankan

`scripts/smoke_model_live.py` memerlukan flag --allow-live, membaca konfigurasi privat melalui loader path eksplisit dan memeriksa katalog publik sebelum inference. Runner internal memakai BudgetTransport maksimal tiga percobaan, deadline kooperatif 30 detik, retry SDK/agent/transport nol dan tool fixture sintetis. Log framework dimatikan untuk proses smoke agar detail provider/credential tidak tercetak.

Ringkasan metadata aman disimpan di `.local/model-smoke-result.json`, diabaikan Git. Tidak menyimpan key, header atau raw prompt/response. Jangan melakukan dump objek model/config. Jumlah request katalog preflight tidak termasuk counter inference model.

Perintah berikut adalah contoh untuk pengulangan yang memerlukan persetujuan baru, bukan instruksi otomatis menjalankannya sekarang:

```sh
rtk proxy uv run --project apps/assistant --locked python scripts/smoke_model_live.py --allow-live
```

## Verifikasi offline

Sesudah refactor runner internal untuk reuse, 30 test assistant lulus. Fungsi run_simulated tetap memaksa MockTransport pada kedua sisi. Jalur live smoke hanya melalui script eksplisit dan tidak membuka endpoint chat. Tool/API/PostgreSQL nyata sudah diuji pada smoke terpisah; smoke model ini sengaja memakai fixture untuk tidak mengirim data DB.

## Langkah diagnosis berikutnya

Metadata aman HTTP status dan kategori kegagalan sudah ditambahkan serta diuji offline; panduan ada di Diagnosis Model.md. Provider belum ditangkap. Sebanyak 32 test assistant lulus, tanpa body/header/error mentah tersimpan. Satu smoke ulang sudah dilakukan dengan izin dan menghasilkan HTTP 429 rate_limited, sebagaimana dicatat pada percobaan kedua. Percobaan berikutnya memerlukan keputusan dan persetujuan baru; jangan mengganti model atau melakukan retry live diam-diam.

Sebelum produksi masih dibutuhkan auth/session, rate limit, redaksi input, kebijakan provider dan kontrol logging aplikasi. Tidak ada perubahan Linear pada smoke ini; pekerjaan pembuktian model belum selesai.

## Sources

- [OpenRouter: Model catalogue](https://openrouter.ai/api/v1/models)
- [OpenRouter: Free variants](https://openrouter.ai/docs/guides/routing/model-variants/free)
