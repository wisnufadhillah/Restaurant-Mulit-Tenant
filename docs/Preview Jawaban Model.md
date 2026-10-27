# Preview Jawaban Model

Script scripts/preview_model_live.py disiapkan untuk satu smoke Nemotron Lightning dengan maksimal dua request inference, tanpa retry atau model cadangan. Tool hanya mengembalikan nama restoran sintetis; output yang ditampilkan hanya jawaban akhir dan metadata aman, bukan reasoning/header/key.

## Percobaan aktual

Percobaan preview berhenti dengan exit code 1 dan pesan aman “Preview stopped; sensitive details suppressed”. Tidak ada laporan jawaban akhir dihasilkan. Karena handler saat ini tidak mencatat tahap kegagalan, jumlah request inference yang sempat diteruskan pada percobaan ini tidak dapat dipastikan dari output. Jangan menyatakan nol request atau menyatakan model menolak tanpa bukti.

Pemeriksaan lanjutan tanpa inference menunjukkan file konfigurasi privat ada dan valid. Pemeriksaan katalog publik juga menunjukkan kandidat masih ada, mendukung tools, dan tarif token nol. Hasil ini hanya kondisi ketika diperiksa; tidak menjelaskan kegagalan preview sebelumnya.

Tidak mengulang inference secara otomatis karena tidak dapat memastikan berapa request budget percobaan sebelumnya sudah terpakai. Smoke sukses dasar terdahulu tetap valid, tetapi teksnya memang tidak disimpan dan tidak dapat direkonstruksi. Jangan membuat teks jawaban ilustrasi seolah-olah hasil aktual.

## Langkah berikutnya

Script sudah diperbaiki untuk melaporkan tahap configuration/catalogue/inference/complete dan kategori error tetap tanpa pesan sensitif. Kegagalan sebelum inference mencatat nol request; exception setelah mulai inference mencatat null jika jumlah tidak dapat dipastikan, bukan nol palsu. Ringkasan aman dicetak sebelum penulisan file sehingga error penyimpanan tidak menyembunyikan jawaban. Output terminal memakai JSON ASCII agar karakter Unicode tidak menggagalkan print di console Windows. Penyebab preview lama belum dipastikan; ini memperbaiki observability, bukan klaim akar kegagalan lama.

Tiga tes baru menggunakan callback sintetis memeriksa preflight timeout, sukses dengan teks jawaban, dan exception setelah inference. Total 43 test assistant lulus. Tidak ada inference baru dalam perbaikan ini. Percobaan preview berikutnya memerlukan izin baru; bukti Bahasa Indonesia masih belum tersedia dan pekerjaan pembuktian model belum ditutup.

## Preview ulang yang berhasil

Dengan izin baru, preview ulang dijalankan 27 Oktober 2026 pukul 15:09:30 UTC memakai nvidia/nemotron-3.5-lightning:free. Hasil: stage complete, status ok, dua request HTTP 200, satu tool call. Jawaban akhir asli:

> Nama restoran ini adalah **Restoran Padang Demo**. (dikonfirmasi melalui tool `get_restaurant_info`).

Penilaian manual: Bahasa Indonesia jelas, nama sama dengan fixture, tidak menambah alamat/harga/jam atau klaim reservasi. Teks menyebut nama tool yang teknis; ini boleh untuk smoke pengembang, tetapi copy customer dapat diperhalus nanti. Hanya satu skenario, bukan evaluasi kualitas umum atau jaminan tanpa halusinasi. Provider NVIDIA dan biaya nol sudah terkonfirmasi dari screenshot smoke sukses sebelumnya; metadata provider tidak direkam ulang pada preview ini.

Bukti gabungan untuk penyelesaian pembuktian dasar: tool roundtrip live, nama dan bahasa diperiksa, model/request/tool tercatat, provider diketahui pada percobaan terdahulu, serta schema invalid/timeout/fallback diuji offline. Model cadangan belum diuji live dan tidak dianggap cadangan rilis terverifikasi. Kebijakan provider Training allowed membatasi demo ke data sintetis, bukan data customer nyata.

Website tetap placeholder; preview ini bukan tampilan widget chat. Konfigurasi key tidak diubah. Status Linear diperbarui terpisah setelah memeriksa acceptance.
