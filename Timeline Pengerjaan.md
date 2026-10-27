# Timeline Pengerjaan

## Tujuan dan cara memakai

Rincian ini membagi baseline delivery menjadi pekerjaan yang dapat dipantau dua pengembang. CSV `timeline.csv` berisi 47 baris: 44 tugas wajib, dua cadangan waktu, dan satu eksperimen opsional yang belum dijadwalkan. Ini dokumen perencanaan yang diminta pengguna; judul, kategori dan metadata penjadwalannya tidak disalin ke kode atau komentar implementasi.

Tidak ada issue yang dibuat di layanan eksternal. CSV adalah format spreadsheet umum, bukan klaim kompatibilitas impor langsung dengan Linear. PRD dan aturan pengerjaan proyek tidak diubah oleh pembuatan timeline ini.

## Asumsi kapasitas dan tanggal

- Baseline mulai 27 Oktober 2026, mengikuti rencana delivery yang sudah disepakati. Ini bukan bukti pekerjaan sudah dimulai. Jika mulai aktual lebih lambat, geser tanggal dan hitung ulang kapasitas sebelum menjanjikan deadline.
- Wisnu menangani backend/database/auth; Ridho menangani frontend dan chatbot/Agno.
- Asumsi sementara 20 jam fokus per orang per minggu; minggu pertama empat hari kerja sehingga kapasitas 16 jam per orang. Jam fokus tidak sama dengan seluruh jam hadir magang.
- Estimasi wajib total 269 person-hour: Wisnu 136 jam, Ridho 133 jam. Estimasi mencakup implementasi, tes terarah, dan perbaikan kecil dalam tugas; bukan jaminan kecepatan dua anggota yang belum dikalibrasi.
- Periode sampai 18 Desember memiliki asumsi kapasitas 156 jam per orang sebelum pengurangan libur/cuti. Sisa 20 jam Wisnu dan 23 jam Ridho dipakai review lintas jalur, integrasi, koordinasi dan ketidakpastian; bukan kapasitas fitur tambahan.
- Jika jam efektif hanya 15 jam per minggu, rencana ini melebihi kapasitas sebelum cadangan. Kurangi scope yang diizinkan atau ubah distribusi; jangan diam-diam menjadikan malam/akhir pekan wajib.
- Semua target tugas wajib berada pada Senin–Jumat. Tenggat 13 dan 20 Desember jatuh pada akhir pekan: pekerjaan dan review ditargetkan selesai Jumat 11 dan 18 Desember. Tidak menjadwalkan kerja akhir pekan.
- Libur nasional, cuti bersama, kegiatan kantor dan tanggal demo mentor belum diverifikasi. Masukkan ke kalender tim sebelum mengunci baseline. Terutama jangan menganggap seluruh 21–31 Desember tersedia.
- Kolom estimasi adalah effort orang yang ditugaskan, bukan lama kalender. Tugas 8 jam dapat tersebar beberapa hari. Waktu review anggota lain diambil dari sisa kapasitas minggu tersebut.
- Seluruh baris belum mulai atau ditunda; tidak ada progres fiktif. Buffer dan opsional bernilai nol hanya sebagai placeholder tidak terestimasi, bukan pekerjaan tanpa biaya.

## Kolom spreadsheet

| Kolom | Penggunaan |
| --- | --- |
| Judul | Nama tugas unik; dapat menjadi judul issue |
| Kelompok | Pengelompokan deliverable, bukan folder source |
| PIC | Satu penanggung jawab Wisnu atau Ridho |
| Mulai | Rencana paling awal memulai pekerjaan yang tidak terblokir |
| Target | Rencana selesai setelah kriteria penerimaan terpenuhi |
| Estimasi_jam | Effort baseline; bandingkan dengan aktual setelah tugas selesai |
| Dependensi | Judul tugas pendahulu, dipisahkan titik koma |
| Hasil_kerja | Keluaran yang harus dapat ditunjukkan |
| Kriteria_selesai | Bukti agar tugas boleh dinyatakan selesai |
| Status | Belum mulai, Berjalan, Terblokir, Review, Selesai, atau Ditunda |
| Jenis | Wajib, Buffer, atau Opsional |

Tambahkan kolom lokal `Aktual_jam`, `Mulai_aktual`, `Selesai_aktual`, `Blocker`, dan `Bukti` bila dibutuhkan. Isi bukti dengan hasil tes atau demo yang benar-benar tersedia, bukan sekadar persentase perkiraan. Jangan memasukkan secret/customer nyata ke spreadsheet atau issue.

Buka CSV sebagai UTF-8 dengan delimiter koma dan tanggal ISO `YYYY-MM-DD`. Dependensi di dalam satu sel memakai titik koma; jangan menggunakannya sebagai delimiter file. Sesuaikan locale spreadsheet jika tanggal tidak dikenali. Simpan baseline terpisah sebelum mengubah tanggal; jangan menghapus jejak keterlambatan dengan menimpa baseline tanpa catatan.

## Arti dependensi dan pekerjaan paralel

Dependensi berarti keluaran pendahulu harus tersedia sebelum integrasi atau penerimaan tugas berikutnya. Bukan semua pekerjaan harus menunggu pendahulu selesai: UI, stub, dan rancangan boleh dikerjakan paralel berdasarkan kontrak yang telah disepakati. Tidak boleh menandai integrasi selesai berdasarkan stub.

Beberapa tanggal sengaja bertumpang tindih:

| Pasangan pekerjaan | Aturan handoff |
| --- | --- |
| Kontrak → skeleton web | Kontrak minimum disepakati lebih dahulu pada hari kickoff; skeleton dimulai setelahnya |
| API lokal → smoke test model | Gunakan fixture endpoint setelah API hidup; jangan menunggu domain lengkap |
| Internal tools → integrasi situs/chat | Fixture lebih dulu; handoff endpoint pada 12 November sebelum penerimaan 13 November |
| Token/batal → UI kelola booking | UI mulai dengan kontrak; integrasi nyata setelah backend tersedia 24 November |
| Proposal atomic → konfirmasi UI | UI dapat disiapkan dahulu; tes final setelah handoff 26 November |
| Tes konkurensi → perjalanan lengkap | Jalankan suite independen lebih dulu pada 27 November; acceptance menunggu kedua hasil |
| Retrieval → jawaban bersumber | UI dan fixture disiapkan paralel; endpoint live paling lambat 3 Desember |
| Privacy/budget → evaluasi awal | Pemeriksaan API dan stub dapat berjalan paralel; evaluasi akhir menunggu gate 4 Desember |
| Migrasi/retensi → feature freeze | Review gabungan 11 Desember hanya setelah bukti kedua jalur tersedia |

Jika handoff terlambat, set status downstream Terblokir untuk bagian integrasi dan catat pekerjaan yang masih bisa berjalan. Jangan membuat dependency cycle. Relasi issue pada tool tracking hanya menunjukkan ketergantungan; catatan handoff menjelaskan bagian yang dapat dimulai lebih awal.

## Ringkasan mingguan

| Minggu kerja | Wisnu: jam wajib | Ridho: jam wajib | Hasil demo Jumat |
| --- | --- | --- | --- |
| 27–30 Okt | 14 | 14 | Komponen lokal hidup; satu tool info berhasil melalui model gratis; fallback diuji |
| 2–6 Nov | 18 | 17 | API data inti; website rumah makan dan widget dengan kontrak fixture |
| 9–13 Nov | 16 | 17 | Staff mengisi data; situs dan tool info/menu memakai API nyata; isolasi diuji |
| 16–20 Nov | 19 | 16 | Availability dan create atomic; idempotency; form serta draft chat siap integrasi |
| 23–27 Nov | 18 | 18 | Buat/lihat/batal lewat web dan chat; token privat; tes konkurensi nyata |
| 30 Nov–4 Des | 18 | 18 | FAQ published dengan sumber; retrieval tenant-scoped; evaluasi awal |
| 7–11 Des | 17 | 17 | Red teaming, privacy, UI accessibility dan regresi; feature freeze |
| 14–18 Des | 16 | 16 | Restore database, benchmark, evaluasi final, rehearsal dan keputusan siap demo |
| 21–31 Des | Tidak dikomitmenkan | Tidak dikomitmenkan | Perbaikan penghambat dan serah terima sesuai kapasitas setelah libur |

Angka di atas tidak termasuk seluruh waktu rapat/review; sisa kapasitas bukan tiket untuk menambah fitur. Setiap Jumat pilih paling banyak beberapa penghambat nyata untuk minggu berikutnya, bukan memulai banyak tugas sekaligus.

## Checkpoint penerimaan

| Tanggal target | Keputusan yang dibuat | Bukti minimum |
| --- | --- | --- |
| 30 Oktober | Integrasi Agno dan model gratis layak dilanjutkan | Satu tool benar, schema invalid ditolak, error/fallback jelas, tidak ada request berbayar |
| 13 November | Data restoran dan website dapat dipakai | CRUD data, halaman publik, tools info/menu nyata dan tes dua tenant |
| 27 November | Reservasi layak diintegrasikan sebagai layanan utama | Buat/lihat/batal, private access, proposal/nonce, idempotency, satu booking pada uji satu meja paralel |
| 4 Desember | Knowledge grounded dan aman di scope uji | Sumber tampil, unpublish berfungsi, tenant lain tidak masuk retrieval, tanpa bukti abstain |
| 11 Desember | Bekukan fitur | Tidak ada kegagalan safety terbuka; alur utama dan regresi punya bukti |
| 18 Desember | Siap demo stabil | Rehearsal, backup/restore, metrik aktual, fallback web, bahan serah terima |
| 31 Desember | Serah terima akhir | Bug penghambat terselesaikan atau dijelaskan, cara menjalankan teruji, keterbatasan terbuka |

Checkpoint gagal berarti keputusan eksplisit: perbaiki penghambat, potong scope yang boleh dipotong, atau revisi rencana. Jangan menandai sukses hanya agar sesuai tanggal.

## Jalur kritis dan prioritas saat terlambat

Jalur kritis produk: kontrak → database/tenant → data operasional/jadwal → availability → create atomic → idempotency → akses privat dan proposal → integrasi customer → tes keamanan/regresi → rehearsal.

Jalur AI juga harus dimulai awal: model gratis/tools → widget read-only → draft/konfirmasi → retrieval → evaluasi. Model, token akses atau tenant tidak boleh baru diuji pada minggu terakhir.

Jika terlambat:

- Jangan menjadwalkan eksperimen MCP. Baris opsional tidak mempunyai tanggal atau effort komitmen.
- Kurangi dekorasi, gambar menu dan kenyamanan dashboard noninti.
- Perkecil korpus FAQ, bukan filter tenant, aturan publish atau sumber jawaban.
- Jika model gratis tidak layak, laporkan dan minta keputusan pengurangan kemampuan AI sesuai batas produk; jangan mengganti ke model berbayar diam-diam.
- Jangan memotong anti double booking, konfirmasi, izin/privasi, idempotency, dan jalur web saat AI gagal.
- Pekerjaan tambahan sesudah freeze hanya bug, keamanan, reliabilitas, atau serah terima; fitur baru membutuhkan keputusan terpisah.

## Cara memindahkan ke Linear

Ini panduan organisasi tugas, bukan petunjuk importer/API yang telah diverifikasi. Periksa dokumentasi dan pemetaan field pada tool saat benar-benar melakukan impor. Jangan menganggap header CSV ini otomatis cocok dengan importer Linear.

Pemetaan manual yang aman:

- Satu proyek untuk MVP website restoran dan chatbot.
- Kelompok sebagai label atau pengelompokan deliverable: Fondasi, Data restoran, Reservasi, Knowledge, Kualitas, Demo.
- Satu baris tugas wajib menjadi satu issue, PIC diganti akun anggota yang benar.
- Gunakan judul sebagai issue title; hasil kerja dan kriteria selesai masuk description.
- Target menjadi due date bila field tersedia; rencana mulai dan jam dicantumkan pada description jika workspace tidak memiliki field yang sesuai.
- Estimasi jam bukan otomatis story point. Simpan jam sebagai baseline sendiri atau tentukan konversi tim secara eksplisit.
- Setelah issue dibuat, hubungkan dependencies berdasarkan judul. Jangan menjanjikan relasi otomatis terbentuk dari sel CSV.
- Letakkan buffer sebagai catatan kapasitas atau milestone, bukan issue effort nol yang ikut metrik throughput.
- MCP tetap di daftar ditunda, tidak masuk komitmen minggu berjalan.
- Jangan membuat tiket A2A/fine-tuning sebagai syarat penyelesaian MVP.

Template description yang dapat disalin:

```text
Tujuan:
PIC:
Rencana mulai:
Target selesai:
Estimasi fokus (jam):
Dependensi dan handoff:
Hasil kerja:
Kriteria selesai:
Bukti verifikasi:
Risiko atau blocker:
```

Tidak perlu memakai spreadsheet dan Linear sebagai dua sumber status terpisah. Pilih satu untuk progres aktual; lainnya sebagai ekspor/snapshot agar status tidak bertentangan.

## Ritme kerja dua orang

- Senin: pilih komitmen realistis sesuai blocker dan kapasitas; maksimal satu pekerjaan utama aktif per orang.
- Setiap hari kerja: update singkat selesai/berjalan/blocker; laporkan kontrak atau handoff yang berubah.
- Sebelum integrasi: reviewer anggota lain memeriksa batas tenant, schema dan data privat, bukan hanya tampilan.
- Jumat: demo nyata, catat jam aktual, jalankan tes terkait dan bandingkan baseline dengan hasil.
- Setelah dua minggu: kalibrasi estimasi berdasarkan data aktual; distribusi frontend/AI tidak harus selalu dipegang satu orang jika beban tidak seimbang.
- Saat mengubah rencana: tulis sebab, dampak tanggal dan scope yang dikurangi. Tidak mengganti deadline tanpa persetujuan tim/mentor.

## Keterbatasan rencana

Belum ada kode, velocity aktual, kalender cuti, target hosting final, serta model gratis teruji. Tugas berpotensi melebihi estimasi ketika harus belajar framework baru. Karena itu jadwal adalah baseline untuk dibahas, bukan janji delivery terukur dari implementasi yang sudah berjalan. Tidak ada pengerjaan aplikasi, perubahan konfigurasi provider, deployment atau issue Linear yang dijalankan saat menyusun file ini.
