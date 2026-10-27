# Progres Fondasi

Dokumen tracking untuk review tim. Status di bawah berdasarkan verifikasi terbaru dan persetujuan pengguna untuk menyelesaikan issue fondasi. Tidak menyamakan simulasi dengan keberhasilan model live.

## Issue dan bukti terbaru

| Issue | PIC | Status Linear | Bukti dan batas |
| --- | --- | --- | --- |
| PRO-58 — Sepakati kontrak dan cara kerja | Wisnu | Done | Pengguna telah membaca/menyetujui kontrak dan memindahkan issue ke Done. Implementasi seluruh sesi/proposal tetap pekerjaan fitur berikutnya, bukan klaim fondasi ini. |
| PRO-59 — Siapkan API dan database lokal | Wisnu | Done | NestJS build dan HTTP health lulus; Docker healthy; Prisma autentikasi TCP serta query PostgreSQL nyata lulus. Credential lokal tidak dicetak atau dilacak Git. Readiness/domain auth bukan scope skeleton ini. |
| PRO-114 — Skema tenant/outlet dan seed | Wisnu | Done | Migrasi diterapkan pada DB kosong, dua tenant/outlet sintetis, seed ulang tetap dua, query tenant-scoped dan FK komposit dengan rollback probe lulus. Belum membuktikan seluruh isolasi API privat. |
| PRO-111 — Web dan service Agno tipis | Ridho / novan | Done | Build web/API, HTTP halaman placeholder, health API/Python dan import adapter lulus. Service AI tidak memiliki koneksi DB bisnis. UI chatbot/live inference belum termasuk skeleton. |
| PRO-110 — Model gratis dan tool | Ridho / novan | Done | Nemotron Lightning gratis menyelesaikan dua request HTTP 200 dan satu tool call; preview akhir Bahasa Indonesia diperiksa dan nama sesuai fixture. Provider NVIDIA/biaya nol terkonfirmasi pada screenshot sukses sebelumnya. Schema invalid/timeout/fallback teruji offline; kandidat cadangan belum lulus live. |

Semua lima issue Phase 1 memenuhi scope fondasi yang disetujui; proyek sudah ditandai Completed. Penutupan model didasarkan pada smoke live dan pemeriksaan jawaban, bukan MockTransport saja. Issue tahap berikutnya tetap belum mulai sampai scope dipilih.

## Verifikasi terbaru

- Build web/API lulus.
- Tiga unit test API lulus, termasuk pemeriksaan kontrak OpenAPI dasar.
- Tiga integration test PostgreSQL/API lulus.
- Verifikasi offline terakhir: 43 test assistant lulus; HTTP 429 sintetis dipaksa fallback walau framework menangkap error; timeout request model dan tool membatalkan coroutine kooperatif.
- HTTP web placeholder pada port sementara 3005 lulus; smoke health API/Python lulus, proses sementara dihentikan.
- Preview model live terakhir berhasil dengan dua request HTTP 200 dan satu tool; jawaban akhir Bahasa Indonesia telah diperiksa. Tidak melakukan evaluasi browser visual, deployment atau reset DB pada penutupan ini.

## Yang dibaca tim

- Panduan setup lokal untuk database/key tanpa membocorkan nilai.
- Kontrak layanan untuk review boundary sesi/error/proposal.
- Dokumentasi API dalam folder api: panduan endpoint dan OpenAPI JSON, belum Swagger UI runtime.
- Runner Async untuk memahami perbedaan simulasi, error Agno yang ditangkap, deadline dan transport live.

## Lanjut setelah review

Fondasi selesai; lanjut fitur berikutnya setelah scope dipilih. Nemotron Lightning menjadi kandidat utama yang lulus smoke dasar, bukan jaminan SLA atau seluruh kualitas model. Runtime customer tetap membutuhkan pembatasan logging sensitif, konfigurasi privat, gate inference dengan data sintetis, serta catatan request/provider. Jangan menambah kanal eksternal, multi-agent atau fitur write agent untuk melewati gate tersebut. Database lokal tetap target restaurant pada Docker multi-tenant port 55432; tidak ada izin reset berulang.
