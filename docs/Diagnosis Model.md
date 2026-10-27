# Diagnosis Model

## Metadata yang tersedia

BudgetTransport kini menyimpan event berisi tiga field saja: attempt (nomor request inference), http_status (angka atau null), dan category (kode tetap). Tidak membaca atau menyimpan response body, error message mentah, header, prompt, key, atau object exception. Provider upstream belum ditangkap; jangan menebak provider dari model ID.

Kategori: ok, invalid_request, authentication, credit_or_quota, access_denied, endpoint_or_model_missing, rate_limited, upstream_error, http_error, redirect_rejected, timeout, transport_error. Angka HTTP memberi petunjuk awal, bukan akar masalah pasti. Contohnya 402 dapat terkait kredit/kuota; jangan mengartikan selalu akun tidak punya saldo.

Redirect kini menandai transport failed. Client tidak mengikuti redirect, sehingga credential tidak diteruskan ke host lain. Request model tetap hanya endpoint dan model yang disetujui.

## Alur ke laporan smoke

Runner internal menerima diagnostics sink opsional milik aplikasi. Saat loop selesai/gagal, event terpilih disalin pada finally. Script smoke memasukkannya dalam request_diagnostics pada ringkasan lokal yang diabaikan Git. Sink tidak berasal dari pesan customer dan tidak dikirim ke model.

Event baru tercatat setelah respons header tersedia atau exception transport tertangkap. Pembatalan coroutine dapat terjadi sebelum event selesai, sehingga jumlah event mungkin kurang dari counter request. HTTP 200 tidak menjamin JSON/model output valid atau tool calling sukses; parse/semantic error dan stream error belum dicatat terperinci.

## Verifikasi offline

```sh
rtk proxy uv run --project apps/assistant --locked python -m unittest discover -s apps/assistant -p "test_*.py"
```

32 test assistant lulus. Tes metadata mencakup HTTP 200, 400, 401, 402, 403, 404, 429, 503, 302 dan ConnectTimeout. Body/header sintetis yang ditandai sensitif tidak masuk event. Kasus negatif framework tetap dapat mencetak log sintetis saat unit test; script live mematikan log proses untuk mencegah dump detail mentah.

## Status smoke live

Smoke kedua setelah instrumentasi sudah dijalankan dengan izin: satu request, HTTP 429 rate_limited, nol tool call, status unavailable. Tidak ada retry. Ini menjelaskan kegagalan percobaan kedua, bukan membuktikan penyebab percobaan pertama yang memiliki dua request dan satu tool call.

Untuk mengulang, perlu izin baru: model tetap liquid/lfm-2.5-2.6b:free jika masih tersedia gratis dengan tools pada preflight, pertanyaan/profil sintetis sama, maksimal tiga request, tanpa retry/fallback berbayar. Jangan mengganti model diam-diam. Hasil ulang harus dicatat terpisah sebagai percobaan baru, bukan menghapus bukti gagal lama.
