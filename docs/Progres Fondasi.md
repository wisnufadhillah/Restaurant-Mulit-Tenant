# Progres Fondasi

Dokumen tracking untuk review tim. Status target di bawah berdasarkan verifikasi terbaru; perubahan Linear menunggu konfirmasi payload. Tidak menyamakan simulasi dengan keberhasilan model live.

## Issue dan bukti terbaru

| Issue | PIC | Status yang diusulkan | Bukti dan batas |
| --- | --- | --- | --- |
| PRO-58 — Sepakati kontrak dan cara kerja | Wisnu | In Review | Layout/tooling disetujui pengguna; kontrak tenant/sesi/error/proposal tersedia. Kesepakatan kedua anggota belum diverifikasi; schema sesi/proposal operasional belum dibuat dan bukan syarat mengimplementasikan seluruh fitur saat kickoff. |
| PRO-59 — Siapkan API dan database lokal | Wisnu | Done | NestJS build dan HTTP health lulus; Docker healthy; Prisma autentikasi TCP serta query PostgreSQL nyata lulus. Credential lokal tidak dicetak atau dilacak Git. Readiness/domain auth bukan scope skeleton ini. |
| PRO-114 — Skema tenant/outlet dan seed | Wisnu | Done | Migrasi diterapkan pada DB kosong, dua tenant/outlet sintetis, seed ulang tetap dua, query tenant-scoped dan FK komposit dengan rollback probe lulus. Belum membuktikan seluruh isolasi API privat. |
| PRO-111 — Web dan service Agno tipis | Ridho / novan | Done | Build web/API, HTTP halaman placeholder, health API/Python dan import adapter lulus. Service AI tidak memiliki koneksi DB bisnis. UI chatbot/live inference belum termasuk skeleton. |
| PRO-110 — Model gratis dan tool | Ridho / novan | In Progress | Wrapper Python ke API/DB tersedia; schema ketat; factory/loader; loop Agno sintetis; budget/fallback dan timeout model/tool teruji. Smoke live sekali pada liquid/lfm-2.5-2.6b:free menghasilkan 2 request dan 1 tool call, tetapi status unavailable tanpa final answer valid. Belum lulus; metadata provider/akar kegagalan belum tersedia. |

Proyek Phase 1 diusulkan In Progress, bukan Completed. Issue tahap berikutnya tetap belum mulai sampai scope dipilih. Tidak menutup PRO-110 berdasarkan hasil MockTransport.

## Verifikasi terbaru

- Build web/API lulus.
- Tiga unit test API lulus, termasuk pemeriksaan kontrak OpenAPI dasar.
- Tiga integration test PostgreSQL/API lulus.
- Tiga puluh test assistant lulus; HTTP 429 sintetis dipaksa fallback walau framework menangkap error; timeout request model dan tool membatalkan coroutine kooperatif.
- HTTP web placeholder pada port sementara 3005 lulus; smoke health API/Python lulus, proses sementara dihentikan.
- Tidak melakukan evaluasi browser visual, provider live, deployment, commit atau reset DB.

## Yang dibaca tim

- Panduan setup lokal untuk database/key tanpa membocorkan nilai.
- Kontrak layanan untuk review boundary sesi/error/proposal.
- Dokumentasi API dalam folder api: panduan endpoint dan OpenAPI JSON, belum Swagger UI runtime.
- Runner Async untuk memahami perbedaan simulasi, error Agno yang ditangkap, deadline dan transport live.

## Lanjut setelah review

Selesaikan persetujuan kontrak tim dan pemilihan model gratis. Runtime live membutuhkan pembatasan logging sensitif, konfigurasi privat, gate inference dengan data sintetis, serta catatan request/provider. Jangan menambah kanal eksternal, multi-agent atau fitur write agent untuk melewati gate tersebut. Database lokal tetap target restaurant pada Docker multi-tenant port 55432; tidak ada izin reset berulang.
