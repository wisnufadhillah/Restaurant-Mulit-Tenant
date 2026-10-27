# Fallback Model Gratis

## Konsep

Satu agent dapat memakai model utama dan satu cadangan. Ini fallback model, bukan multi-agent. Kedua kandidat harus gratis, mendukung tools dan lulus evaluasi sebelum menjadi konfigurasi rilis. Daftar katalog saja belum membuktikan kualitas atau ketersediaan.

Modul model_failover.py menyediakan failover level aplikasi agar request dan deadline antar-model dapat dibatasi bersama. Tidak memakai array models OpenRouter sehingga pergantian terlihat pada counter aplikasi. Maksimal dua kandidat berbeda, default tiga request inference total dan deadline keseluruhan 30 detik. Total dapat dinaikkan eksplisit hingga empat hanya untuk skenario yang disetujui; tiap attempt tetap maksimal tiga. Request gagal tetap dihitung. Tidak retry model yang sama. Jika sisa request kurang dari dua, tidak mulai cadangan karena alur tool umumnya membutuhkan request awal dan final.

Fallback hanya untuk timeout atau unavailable dengan kategori upstream_error/transport_error/timeout. HTTP 429 dengan metadata scope upstream boleh memicu pergantian; HTTP 429 dengan scope platform atau belum diketahui tidak memicu pergantian: limit akun/global tidak boleh dianggap dapat diatasi dengan mengganti model. Authentication, credit/quota, validation dan error lain berhenti. Untuk mendukung provider-specific 429 nanti, identifikasi scope dengan metadata terpilih dan uji kebijakannya dahulu; jangan meneruskan pesan error mentah.

## Hasil uji

36 test assistant lulus, termasuk empat test failover: pergantian upstream failure dengan shared budget tiga request, penghentian pada rate limit/auth/credit/input error, penghentian ketika budget tidak cukup, dan penolakan kandidat berbayar. Test failover memakai callback sintetis, bukan provider nyata.

Smoke live tambahan disetujui pengguna dan dilakukan 27 Oktober 2026 pukul 14:38:58 UTC. Kandidat utama google/gemma-4-26b-a4b-it:free serta cadangan liquid/lfm-2.5-2.6b:free lolos preflight katalog gratis/tools. File .env pengguna tidak diubah; kandidat dibatasi eksplisit dalam script smoke.

Hasil utama: satu request, HTTP 429 rate_limited, nol tool call, unavailable, tidak lulus. Cadangan tidak dipanggil karena scope 429 belum diketahui. Ini membuktikan batas berhenti, bukan keberhasilan fallback live atau kualitas model cadangan. Tidak menyimpulkan akun habis kuota atau provider tertentu bermasalah. Tidak ada raw response/header/key disimpan; provider belum ditangkap.

Ringkasan aman tersimpan dalam file timestamp di .local yang diabaikan Git. Hasil percobaan lama tetap dipertahankan dalam dokumentasi smoke. Tidak ada perubahan Linear; issue pembuktian model tetap belum selesai. Belum beralih ke pengerjaan fitur berikutnya.

## Menjalankan tes offline

```sh
rtk proxy uv run --project apps/assistant --locked python -m unittest discover -s apps/assistant -p "test_*.py"
```

Script smoke_failover_live.py hanya untuk percobaan live dengan izin eksplisit; jangan menjalankan berulang otomatis atau menganggap persetujuan satu smoke berarti izin uji banyak model tanpa batas. Setelah rate limit, tunggu atau periksa kuota secara read-only dengan izin yang sesuai. Jangan membuat akun/key tambahan untuk melewati batas.

## Batas dan langkah berikutnya

Kandidat Liquid/Gemma belum lulus smoke jawaban akhir. Percobaan baru Nemotron Lightning berhasil pada smoke dasar dua request dan satu tool; rincian serta kekurangan provider/penilaian bahasa dicatat pada Smoke Model Berhasil.md. Laguna XS belum dicoba live. Konfigurasi release tidak boleh menganggapnya model teruji. Selanjutnya perlu membedakan rate limit platform dengan upstream, misalnya metadata kategori terpilih dan indikator kuota akun yang tidak sensitif. Verifikasi melalui mock sebelum akses akun read-only atau smoke berikutnya. Tidak menutup pekerjaan model berdasarkan tes sintetis.

## Sources

- [OpenRouter: Model fallbacks](https://openrouter.ai/docs/guides/routing/model-fallbacks)
- [OpenRouter: Limits](https://openrouter.ai/docs/api/reference/limits)
