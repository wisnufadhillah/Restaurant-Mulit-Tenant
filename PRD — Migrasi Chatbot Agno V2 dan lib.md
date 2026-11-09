# PRD — Migrasi Chatbot ke Agno V2

## Ringkasan

Memigrasikan runtime chatbot lama ke Agno V2 dengan tetap mempertahankan boundary keamanan dan kontrak HTTP chatbot yang sudah berjalan. Folder `lib` telah dihapus dari scope karena tidak dipakai oleh runtime NestJS maupun Agno.

Migrasi tidak mengubah website publik, form reservasi, dashboard, atau aturan bisnis reservasi.

## Tujuan

- Menggunakan Agno V2 sebagai runtime agent chatbot.
- Menjadikan NestJS satu-satunya pemilik tenant, session, retrieval, database, dan business rules.
- Mempertahankan endpoint dan perilaku UI chatbot selama migrasi.
- Menjamin chatbot production tetap read-only: profil restoran, menu, dan FAQ/policy.
- Menyediakan pilihan tindakan kontekstual yang aman dan terstruktur agar customer tidak harus mengetik semua instruksi.
- Menyediakan jalur rollback ke chatbot lama tanpa perubahan data bisnis.

## Kondisi awal

### Chatbot lama

Chatbot lama sudah memiliki gateway NestJS, cookie session, tenant binding, redaction input, rate limit, internal context bertanda tangan, knowledge retrieval, kartu sumber, fallback, dan pengujian HTTP.

### Agno V2

Agno V2 memiliki FastAPI, agent, OpenAI-compatible model adapter, playground, dan gateway `/turn`. Production tool akan memanggil internal API NestJS, bukan endpoint publik dan bukan database.

### Folder `lib`

Folder `lib` telah dihapus dan bukan dependency migrasi. Business logic tetap berada pada modul NestJS yang sudah menjadi sumber kebenaran.

## Keputusan arsitektur

```text
Next.js chatbot UI
        |
        v
NestJS chatbot gateway
  - session dan tenant binding
  - redaction dan rate limit
  - validasi request/response
  - internal tool endpoints
        |
        v
Agno V2
  - agent dan model adapter
  - tool calling read-only
  - bounded execution
        |
        v
NestJS application/domain layer
  - Prisma/PostgreSQL
```

Aturan ownership:

| Concern | Pemilik | Agno boleh melakukan apa? |
| --- | --- | --- |
| Tenant dan outlet | NestJS | Menerima konteks opaque dari gateway |
| Session chatbot | NestJS | Menggunakan session ID yang diberikan gateway |
| Menu, profil, jam buka | NestJS/domain | Membaca melalui tool internal |
| FAQ published dan revision aktif | NestJS/domain | Mencari melalui tool internal |
| Reservasi dan availability | NestJS/domain/form web | Tidak memiliki tool chatbot |
| Database dan Prisma | NestJS | Tidak boleh mengakses langsung |
| Model dan tool calling | Agno V2 | Memproses data tool sebagai data tak tepercaya |
| UI dan kartu jawaban | Next.js/NestJS contract | Tidak menerima raw HTML/model markup |

## Scope

### Termasuk

- Migrasi transport chatbot dari service Python lama ke Agno V2.
- Kompatibilitas gateway `/turn` dan endpoint `/chat/*` yang digunakan web.
- Tool Agno read-only untuk profil, menu, dan knowledge.
- Penyatuan kontrak tipe, validasi, error mapping, observability, dan action buttons.
- Shadow test, contract test, negative test, dan rollback configuration.

### Tidak termasuk

- Availability, hold, proposal, create/cancel/reschedule reservation melalui chat.
- Order makanan, payment, Midtrans, WhatsApp/Telegram, MCP, A2A, atau multi-agent.
- Perubahan schema bisnis yang tidak diperlukan.
- Penggantian UI, desain widget, form reservasi, atau dashboard.
- Mengaktifkan Gemini atau runtime AI kedua.
- Menghidupkan kembali `lib` atau membuat runtime TypeScript kedua.

## Kontrak chatbot production

NestJS tetap menerima request browser melalui endpoint yang sudah ada:

- `POST /api/v1/chat/session`
- `POST /api/v1/chat/messages`
- `GET /api/v1/chat/catalogue/:resource`

NestJS memanggil Agno V2 melalui loopback `POST /turn` dengan payload server-side:

```json
{
  "message": "Apa menu yang tersedia?",
  "tenantSlug": "demo-padang",
  "sessionId": "opaque-session-id",
  "context": "signed-short-lived-context"
}
```

Agno wajib mengembalikan bentuk bounded berikut:

```json
{
  "status": "ok",
  "message": "...",
  "cards": [],
  "attempted_requests": 1,
  "diagnostics": []
}
```

`tenantSlug`, `sessionId`, dan `context` tidak berasal langsung dari browser atau model. Endpoint internal NestJS memverifikasi service token, signature context, tenant, session, dan expiry pada setiap tool call.

## Keputusan folder `lib`

`lib` tidak dipakai dan tidak dipulihkan. NestJS memakai service, repository, dan domain rules pada `apps/api/src`. Agno tidak mengakses Prisma atau modul TypeScript secara langsung.

## Batas keamanan dan ketahanan

- Agno tidak memiliki credential database.
- Tool production hanya GET internal untuk profil, menu, dan knowledge.
- Dokumen FAQ diperlakukan sebagai data, bukan instruksi.
- Tidak ada fallback tenant default dari payload model.
- Model tidak dapat menentukan tenant, role, approval, atau status transaksi.
- Maksimum tiga inference/tool request per turn dan deadline 30 detik.
- Error provider, 429, timeout, dan invalid tool menghasilkan fallback jujur.
- Respons divalidasi sebelum dikirim ke UI.
- Action buttons dibentuk oleh aplikasi dari intent yang tervalidasi, bukan dipercaya dari output model.
- Target action dibatasi pada aksi UI lokal seperti membuka menu, membuka form reservasi, atau mengisi pertanyaan aman.
- Tidak ada token, kontak, cookie, atau data reservasi privat dalam prompt/transcript model.
- Gateway lama tetap tersedia sebagai rollback sampai seluruh acceptance test lulus.

## Rencana eksekusi

### Kontrak dan baseline

- Bekukan kontrak request/response NestJS–Agno.
- Tambahkan schema validation dan test payload invalid.
- Catat baseline test chatbot lama tanpa mengubah data atau secret.

### Runtime Agno

- Pindahkan bounded runner, model allowlist, timeout, retry, diagnostics, dan action builder ke Agno V2.
- Bungkus internal tools NestJS untuk profil, menu, dan knowledge.
- Tambahkan validasi kartu menu, profil, dan sumber knowledge.
- Pastikan playground tetap terisolasi dari production tools.

### Action buttons

- Tambahkan schema response `actions` pada gateway Agno dan NestJS.
- Buat action hanya dari konteks terverifikasi: kartu menu, pertanyaan reservasi, hasil FAQ, atau error/fallback.
- Render button dengan allowlist pada widget tanpa raw HTML atau URL dari model.
- Uji keyboard, mobile, duplicate click, dan action saat request sedang berjalan.

### Boundary dan contract test

- Pastikan Agno tidak mempunyai dependency langsung pada Prisma.
- Tambahkan contract test tenant isolation dan published-only knowledge.
- Tambahkan negative test untuk action type/target yang tidak dikenal.

### Cutover

- Jalankan shadow evaluation menggunakan input sintetis yang sama pada runtime lama dan Agno.
- Arahkan gateway ke Agno V2 melalui konfigurasi loopback.
- Jalankan browser chat, fallback, tenant isolation, dan negative tests.
- Simpan rollback ke origin chatbot lama sampai review selesai.

### Pembersihan

- Hapus endpoint compatibility lama yang tidak memiliki caller.
- Hapus referensi migrasi lama yang tidak memiliki caller.
- Perbarui dokumentasi berdasarkan implementasi aktual.
- Jangan menghapus data, migration, atau file untracked tanpa pemeriksaan dan persetujuan terpisah.

## Acceptance criteria

- UI chatbot yang ada dapat membuka session dan mengirim pesan tanpa perubahan UI.
- Pertanyaan profil, menu, harga, jam buka, dan FAQ menggunakan tool yang sesuai.
- Harga, jam, dan kebijakan hanya berasal dari API/database tenant yang benar.
- Tenant A tidak dapat membaca menu, profil, atau FAQ Tenant B.
- FAQ yang unpublished atau revision lama tidak muncul.
- Tool availability, reservation, order, payment, dan admin tidak tersedia di agent production.
- Model meminta tool invalid → tool tidak dieksekusi dan respons aman dikembalikan.
- Timeout/429/provider failure → fallback jujur dan form reservasi tetap dapat dipakai.
- Input email, nomor telepon, token, dan cookie tidak masuk ke payload model setelah masking.
- Kartu jawaban memenuhi schema dan tidak memuat raw HTML/script.
- Jawaban yang relevan menyediakan action button terstruktur dengan target yang di-allowlist.
- Action invalid dari model atau service tidak dirender dan tidak dieksekusi.
- Retry atau request paralel chatbot tidak membuat efek tulis apa pun.
- Rollback ke chatbot lama dapat dilakukan melalui konfigurasi tanpa migrasi data.

## Bukti verifikasi minimum

- Python syntax/import test untuk `agno-v2`.
- Unit test tool schema dan response validation.
- Contract test `/turn` untuk auth, payload invalid, timeout, 429, dan fallback.
- Integration test internal tools dengan dua tenant.
- Knowledge test published-only, revision switch, unpublish, dan no-source.
- Browser test widget keyboard/mobile dan alur fallback.
- `git diff --check`, status/diff review, serta pembacaan ulang file hasil migrasi.

## Risiko dan mitigasi

| Risiko | Mitigasi |
| --- | --- |
| Agno menerima tenant dari caller | Context ditandatangani NestJS dan diverifikasi ulang oleh internal endpoint |
| Model gratis berubah atau kuota habis | Allowlist, bounded retry, stub deterministik, dan fallback web |
| Perubahan runtime memutus UI | Pertahankan endpoint `/chat/*` dan response contract |
| Action button menjalankan target yang tidak aman | Action dibuat application-side dan target dibatasi allowlist |
| Tool lama aktif tanpa sengaja | Production registry hanya memuat tiga read-only tool |
| Rollback tidak jelas | Pertahankan old origin dan smoke test kedua runtime sampai cutover selesai |

## Definition of Done

Migrasi dinyatakan selesai jika Agno V2 menjadi runtime agent aktif melalui gateway NestJS, action buttons berjalan aman, chatbot lama dapat di-rollback, seluruh acceptance criteria lulus, dan tidak ada business logic reservasi yang dijalankan oleh model.



# Sedikit Tambahan
Chatbot jangan hanya memberikan jawaban berupa teks. Chatbot juga harus mampu memberikan pilihan tindakan yang relevan dengan konteks percakapan, sehingga customer tidak perlu terus-menerus mengetik instruksi secara manual.
