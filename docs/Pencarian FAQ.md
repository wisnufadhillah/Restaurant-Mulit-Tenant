# Pencarian FAQ restoran

## Yang berubah

Backend memiliki modul pencarian lexical `apps/api/src/restaurant/knowledge-search.ts`. Modul ini memilih cuplikan FAQ dari kumpulan revision yang diberikan pemanggil. Lexical berarti mencocokkan kata, bukan meminta model menebak kebijakan dan bukan embedding.

Endpoint internal GET /api/v1/internal/tenants/:slug/knowledge?q= tersedia pada aplikasi API, memakai service auth, signed context dan sesi chat aktif. Repository membaca snapshot revision published aktif sebelum pencarian. Tool search_knowledge sudah dihubungkan ke runner Agno. Respons divalidasi sebagai maksimal tiga cuplikan bersumber; kartu sumber diteruskan melalui validator API lalu dirender sebagai teks React beserta judul/revision. Lima FAQ panduan penggunaan website telah dipublikasikan lokal untuk demo-padang. Kebijakan fasilitas restoran belum tersedia dan tidak boleh diasumsikan. Schema dan migrasi tambahan telah diterapkan pada PostgreSQL lokal. Fixture pengujian ditulis hanya dalam transaksi yang di-rollback; lima FAQ panduan website telah dipublikasikan lokal; tidak ada kebijakan fasilitas yang diasumsikan.

## Sebelum dan sesudah

| Area | Sebelum | Sesudah |
| --- | --- | --- |
| Pencarian FAQ | Belum ada modul retrieval khusus | Fungsi pencarian terpisah tersedia untuk pengujian dan integrasi berikutnya |
| Konteks restoran | Tools informasi/menu sudah terikat tenant | Kontrak retrieval juga mewajibkan tenant dari server |
| Sumber jawaban FAQ | Belum ada penyimpanan/endpoint knowledge | Lima panduan website published lokal; tes sintetis terpisah dari corpus tersebut |
| Reservasi dari chat | Tidak melakukan transaksi | Tetap terpisah melalui form web; tidak ditambah tool booking |

## Alur fungsi

```text
tenant tepercaya + pertanyaan + revision dokumen
  → batasi ukuran input
  → filter tenant
  → validasi identitas revision dan pointer aktif
  → pilih published pada revision aktif
  → normalisasi kata dan hitung kecocokan
  → urutkan deterministik
  → maksimal tiga cuplikan beserta judul dan revision
```

Dokumen memuat tenantId, documentId, revision, activeRevision, status, title, dan chunks. Cuplikan memuat position dan text. Hasil tidak membawa credential atau data reservasi. Identitas revision ganda, pointer aktif tidak konsisten dan chunk invalid pada corpus tenant sendiri menyebabkan kegagalan, bukan pemilihan sumber sembarang.

## Contoh sederhana

Pertanyaan “Boleh membawa kue ulang tahun?” dapat cocok dengan cuplikan yang mengandung kata “kue”, “ulang”, dan “tahun”. Contoh kebijakan dalam tes hanya sintetis, bukan pernyataan bahwa restoran sungguhan mengizinkan membawa kue.

Pertanyaan tanpa kecocokan menghasilkan daftar kosong. Lapisan jawaban berikutnya wajib menyatakan belum memiliki sumber, bukan mengarang kebijakan. Pertanyaan satu kata perlu kata itu cocok; pertanyaan lebih panjang memerlukan sedikitnya dua kata bermakna yang cocok. Ini baseline, bukan skor probabilitas kebenaran.

## Batas keamanan dan kualitas

- Tenant harus dipasok server setelah autentikasi/binding sesi; bukan argumen bebas model.
- Filter tenant dilakukan sebelum ranking. Published dan revision aktif wajib sesuai.
- Harga, jam operasional, availability menu/meja, dan status booking tetap dari API bisnis, bukan FAQ. Publikasi corpus harus menolak data customer/reservasi serta konten operasional yang mudah basi; fungsi lexical tidak dapat menjamin klasifikasi isi tersebut.
- Dokumen yang mengandung instruksi tetap data tak tepercaya. Retrieval tidak mengeksekusinya, tetapi perlindungan prompt injection pada integrasi model tetap wajib diuji.
- Tidak ada stemming, sinonim otomatis, embedding atau cache. Pertanyaan sinonim bisa tidak menemukan sumber; evaluasi diperlukan sebelum memperluas algoritme.
- Maksimal 1.000 revision per pemanggilan, 100 chunk per dokumen, 2.000 karakter per chunk, pertanyaan 500 karakter, dan tiga hasil.

## Batas endpoint internal

Setelah autentikasi service, signed context dan sesi chat aktif lolos, endpoint menerima tepat satu parameter q berisi 1–500 karakter. Query berulang, field tambahan, sesi tenant lain, expired context dan sesi dicabut ditolak sebelum repository dipanggil. Semua respons no-store.

Limiter per proses membatasi 20 request per sesi per menit, 200 request keseluruhan per menit dan empat pencarian berjalan. Penolakan mengembalikan 429 serta Retry-After; slot concurrency dilepas melalui finally termasuk saat repository gagal. Restart mereset kuota; ini bukan batas terdistribusi atau proteksi trafik sebelum autentikasi.

Repository membatasi snapshot 100 dokumen, 100 chunk per revision dan 200.000 karakter total. Satu baris tambahan digunakan untuk mendeteksi overflow, bukan memotong sumber diam-diam. Pointer/tenant/status tidak konsisten menyebabkan kegagalan layanan tanpa fallback. Respons JSON dibatasi 24.000 byte. Batas ini perlu dikalibrasi dengan FAQ yang disetujui; tidak mengukur relevansi global untuk corpus yang melebihi batas.

## Pemeriksaan lokal

```sh
rtk proxy node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json
rtk proxy node --test apps/api/test/knowledge-search.test.cjs
```

Tes memakai corpus sintetis: isolasi tenant, published-only, pergantian revision, unpublish, pertanyaan tanpa sumber, batas hasil, duplikasi revision dan konten instruksi. Kelulusan tes modul tidak membuktikan integrasi model, keamanan seluruh sistem, atau sumber FAQ restoran sudah tersedia.

## Kontrak sumber persisten yang diusulkan

Draft model Prisma KnowledgeDocument, KnowledgeDocumentRevision dan KnowledgeChunk serta SQL tambahan tersedia pada workspace. Prisma schema lolos validate; migrasi knowledge telah diterapkan dan pemeriksaan storage awal lulus pada PostgreSQL lokal. Lima panduan website dipublikasikan pada demo-padang; tenant lain tidak diberi sumber itu.

- **Dokumen**: identitas stabil, tenant pemilik, judul, status publikasi dan pointer revision aktif. Relasi dokumen bersifat tenant-level; tidak menambah kewajiban outlet pada FAQ brand.
- **Revision**: tenant, dokumen, nomor revision positif, isi immutable, bukti persetujuan isi dan waktu publikasi. Nomor revision unik dalam dokumen tenant tersebut. Persetujuan isi bukan otomatis publikasi.
- **Chunk**: tenant, dokumen, revision, posisi dan teks terbatas. FK komposit harus mencegah chunk menunjuk revision tenant lain; posisi unik dalam revision.
- **Snapshot retrieval**: repository memilih tenant tepercaya dan dokumen published, mengikuti pointer aktif, lalu memetakan ke KnowledgeRevision untuk fungsi lexical. Metadata aktif tidak diambil dari browser/model.

Revision draft belum boleh dipakai retrieval, meskipun isinya disetujui. Persetujuan isi harus tercatat terpisah dari otorisasi publikasi; perubahan isi membentuk revision baru dan tidak mewarisi persetujuan lama. Metadata pemberi persetujuan tetap internal, bukan bagian judul atau cuplikan customer.

Publikasi menyiapkan revision dan seluruh chunk, lalu memindahkan pointer aktif dalam satu transaksi. Revision lama tetap riwayat, bukan sumber jawaban aktif. Unpublish menghapus kelayakan retrieval tanpa menghapus riwayat. Jangan mencampur pointer baru dengan chunk lama. Tidak memakai cache pada baseline ini. Pointer null, revision hilang, atau relasi tenant tidak cocok menghasilkan tanpa sumber; jangan fallback ke draft atau revision lama. Seluruh join wajib menyertakan tenant dan identitas dokumen/revision yang sama.

Endpoint internal berikutnya harus mengikuti autentikasi service, signed context dan validasi sesi chat aktif yang sudah digunakan tools informasi/menu. Payload model cukup pertanyaan; tenant, izin dan publication state tidak dapat dipilih model. Respons maksimal tiga cuplikan dengan judul, documentId dan revision; tanpa hasil harus dinyatakan tidak memiliki sumber. Tidak ada tool SQL, publish, admin atau transaksi booking untuk model.

Uji penyimpanan yang diperlukan setelah mendapat izin DB: FK lintas tenant ditolak, publish gagal tidak meninggalkan pointer parsial, pergantian revision konsisten, unpublish langsung hilang, sesi tenant lain ditolak, dan pertanyaan tanpa sumber tidak menghasilkan kebijakan rekaan.

## Batas draft database

SQL menambahkan tiga tabel, FK komposit tenant/dokumen/revision, batas ukuran, metadata persetujuan berpasangan dan satu published revision per dokumen. Pointer revision aktif memakai FK tertunda sampai akhir transaksi agar pergantian pointer dapat dilakukan atomic. Tidak mengubah tabel reservasi atau model Tenant → Outlet.

Draft SQL kini menambahkan trigger immutable untuk title/hash/approval dan chunk revision yang sudah disetujui, serta constraint trigger tertunda untuk kecocokan pointer aktif dengan revision published/approved. Kasus immutable title/chunk dan pointer published telah diuji PostgreSQL; ini belum membuktikan seluruh variasi konkurensi. knowledge-publication.ts menghitung hash isi dari judul dan urutan chunk; approval harus cocok dengan hash aktual. KnowledgePublicationRepository mengunci dokumen lalu mengganti status dan pointer dalam satu transaksi, tetapi belum didaftarkan ke aplikasi atau endpoint. Caller kelak wajib memeriksa otorisasi tenant dan publikasi; repository bukan bukti izin. Pembacaan tetap memfilter published dan pointer aktif tanpa fallback. Metadata approvalReference hanya catatan internal yang tidak boleh berisi credential atau diteruskan sebagai cuplikan.

Trigger immutable juga menolak penghapusan revision approved/chunk terkait. Karena itu tes database pertama harus memakai transaksi yang di-rollback atau database uji terisolasi; jangan menjanjikan cleanup delete biasa pada revision approved. Reset/penghapusan/rollback schema tidak diotorisasi melalui persiapan ini. Fixture tes di-rollback; schema tidak di-rollback dan data lama tidak dihapus. Migrasi berikutnya tetap memerlukan persetujuan target serta tindakan.

## Hasil tinjauan statis publikasi

Validasi hash aktual dilakukan helper TypeScript sebelum publikasi; CHECK SQL hanya memeriksa format dan kecocokan content_hash/approved_hash. Ini bukan bukti persetujuan pemilik atau proteksi terhadap administrator/direct SQL writer. Jalur persetujuan terotorisasi, pembatasan hak akun aplikasi, serta pengujian perubahan chunk bersamaan dengan approval masih harus ditutup sebelum aktivasi publikasi.

Row trigger tidak melindungi TRUNCATE atau administrator yang dapat menonaktifkan trigger. Akun runtime tidak boleh diberi hak TRUNCATE, kepemilikan schema atau perubahan trigger. Hak aktual belum diperiksa. Tes PostgreSQL kelak harus memaksa constraint tertunda dievaluasi, menguji pointer salah/draft/lintas tenant, approval tidak lengkap, immutable content, serta publish/unpublish konkuren. Prisma validate dan unit test bukan bukti SQL trigger sudah benar.

## Tes endpoint PostgreSQL read-only

`apps/api/test/knowledge-readonly.integration.cjs` menjalankan aplikasi API utama dan repository nyata pada PostgreSQL lokal, tanpa fixture atau publikasi. Test membandingkan snapshot dokumen dan pointer sebelum/sesudah, sehingga tetap berlaku setelah publikasi. Sumber yang dikembalikan harus cocok dengan tenant dan revision aktif; signed context tenant lain dan sesi dicabut ditolak. Tidak menghapus/unpublish corpus untuk memenuhi syarat tes.

Tes limiter juga memeriksa pergantian window ketika empat operasi masih aktif: reset kuota tidak melepas slot pekerjaan yang belum selesai. Batas global diuji memakai identitas berbeda. Seluruh batas masih per instance/proses.

## Tes penyimpanan yang disiapkan

`apps/api/test/knowledge-storage.integration.cjs` disiapkan untuk PostgreSQL lokal 127.0.0.1:55432/restaurant dan memerlukan ALLOW_LOCAL_KNOWLEDGE_WRITES=1. Flag hanya pengaman teknis, bukan persetujuan operator. Tes awal sudah dijalankan dan lulus setelah migrasi lokal; kedua tenant fixture tidak tersisa dan jumlah dokumen knowledge tetap nol.

Seluruh fixture dua tenant dan perubahan publikasi berada dalam satu transaksi yang sengaja di-rollback. SAVEPOINT mengisolasi pemeriksaan negatif; constraint tertunda dipaksa dievaluasi agar state salah tidak lolos hanya karena belum commit. Cakupan awal: FK tenant, approval tidak lengkap, pointer menuju draft, isi approved immutable, publish/unpublish konsisten dan rollback fixture. Ini belum membuktikan konkurensi lintas koneksi atau hak minimum akun runtime.

## Pemeriksaan struktur database

Metadata PostgreSQL lokal dicocokkan kembali dengan model Prisma dan diagram domain. Penyimpanan knowledge terdiri dari knowledge_documents, knowledge_document_revisions dan knowledge_chunks; title/status/hash/approval ada pada revision, bukan tabel dokumen. Sesi pembuat, konfirmasi dan sesi manajemen reservasi merupakan tabel terpisah. Tidak ditemukan tabel persisten chat_message/tool_run dalam struktur yang diperiksa; sesi chat berjalan sebagai state aplikasi. Pemeriksaan ini hanya membaca metadata schema, bukan isi customer, dan tidak mengubah DB.

## Jawaban percakapan berbasis sumber

Jawaban utama kini disusun model melalui Agno, bukan diganti template “buka kartu sumber”. Pertanyaan FAQ yang dikenali mengambil cuplikan terlebih dahulu; jika ada sumber, cuplikan JSON diteruskan sebagai data tak tepercaya untuk diparafrase. Tools menu/profil tetap dapat dipanggil untuk bagian operasional pada pertanyaan campuran. Jika tidak ada sumber FAQ dan tidak ada bagian operasional, aplikasi abstain tanpa inference.

Jawaban model yang memakai sumber tervalidasi ditampilkan sebagai teks biasa. Pemeriksaan tambahan membatasi panjang, klaim sukses transaksi/credential, harga Rupiah yang tidak ada pada sumber, dan beberapa klaim kebijakan tanpa bukti. Pemeriksaan ini heuristik, bukan pembuktian entailment: salah parafrasa, negasi dan klaim di luar daftar tetap memerlukan evaluasi. Prompt tidak menggantikan auth tenant, allowlist tool read-only, atau budget inference.

Jawaban utama langsung menjelaskan kebutuhan customer. Menu, profil dan sumber FAQ ditampilkan terbuka di bawahnya tanpa klik expand. Template yang hanya menyuruh membuka sumber ditolak; jawaban yang tampak terpotong tanpa penutup kalimat memakai fallback data yang sudah tervalidasi. Pemeriksaan penutup kalimat bukan deteksi truncation provider yang sempurna. Permintaan booking dengan tanggal/waktu diarahkan ke form tanpa klaim slot tersedia. Uji transport sintetis mencakup jawaban natural dari FAQ, pertanyaan campuran harga dan parkir tanpa sumber, serta penolakan tambahan klaim halal/parkir/booking dari respons model. Full-chain browser kini memakai respons model sintetis satu request untuk FAQ bersumber; bukan provider live. Perilaku template deterministik tanpa inference yang dijelaskan pada riwayat di bawah adalah baseline sebelumnya, bukan mode jawaban terkini.

## Integrasi agent dan UI yang tersedia

Runner Python memiliki tool search_knowledge(query), dengan tenant dan header internal dari konteks aplikasi, bukan argumen model. Query dibatasi 500 karakter, envelope dan identitas cuplikan divalidasi, lalu maksimal tiga kartu sumber dapat diteruskan. Cuplikan diperlakukan sebagai data tak tepercaya; tool tidak memberi izin SQL, publish, admin, atau transaksi reservasi.

Pertanyaan dengan sinyal kebijakan eksplisit seperti FAQ, kebijakan, parkir, kue, halal, alergen atau fasilitas dirutekan deterministik ke pencarian memakai pertanyaan asli, sebelum inference. Hasil kosong menjadi pesan belum memiliki sumber; hasil valid menjadi arahan tetap untuk membaca kartu sumber, bukan sintesis kebijakan model. Teks cuplikan pada jalur ini tidak dimasukkan ke inference. Jika model pada jalur umum meminta search_knowledge, prose akhirnya juga diganti arahan sumber tetap. Keluaran model umum tanpa kartu dari pembacaan tool tervalidasi kini ditolak menjadi abstention; sapaan dan redirect deterministik tetap berjalan. Adanya kartu menu/profil tidak dijadikan izin menampilkan prose model: keluaran akhir jalur tersebut kini berupa arahan tetap untuk membaca kartu sumber. Ini menutup klaim kebijakan tambahan dari prose model, dengan tradeoff jawaban kurang luwes dan rekomendasi berbentuk kartu, bukan narasi bebas.

Deteksi kata bukan klasifikasi intent universal. Parafrasa yang belum tercakup bisa tetap masuk jalur model umum; ini batas grounding yang masih perlu evaluasi. Pertanyaan campuran yang terdeteksi FAQ mengutamakan jalur sumber, sehingga bagian menu/jam bisa belum dijawab pada giliran yang sama. Jangan mengklaim seluruh pertanyaan kebijakan sudah terjamin grounded. Tes injection sintetis membuktikan jalur deterministik tidak memanggil model atau tool tambahan, bukan bahwa semua serangan terhadap model umum kebal.

UI menampilkan judul, teks dan revision, tanpa raw HTML atau tautan rekaan. Tes browser memakai respons sintetis dan memeriksa script tetap teks. Tes conversation memakai transport model/API tiruan, bukan inference live atau bukti end-to-end corpus published.

## Harness pipeline dengan corpus sintetis

`knowledge-pipeline.integration.cjs` telah dijalankan pada PostgreSQL lokal dan lulus. Target tetap PostgreSQL lokal yang disetujui; semua fixture dua tenant, dua dokumen, dua revision dan dua chunk berada pada satu transaksi rollback. Maksimal delapan baris baru, diikuti update approval/published/pointer dan unpublish; tidak ada perubahan data lama atau migrasi. Identitas fixture unik dan setelah sentinel rollback jumlah tenant fixture diperiksa nol.

Harness memakai repository dan query ORM nyata melalui transaksi luar yang sama, HTTP Nest lokal, subprocess Python yang menjalankan policy gate tanpa provider, serta validator kartu API. Transport Python hanya mengarahkan URL loopback test. UI browser diuji terpisah dengan respons sintetis; harness ini bukan full-chain browser/BFF/gateway E2E. Pengujian dijalankan setelah izin penulisan fixture pipeline; kedua sumber tenant menghasilkan identitas dokumen masing-masing, unpublish menghasilkan abstention, dan rollback menyisakan nol tenant pipeline serta nol dokumen knowledge.

## Evaluasi setelah publikasi

Tes read-only PostgreSQL kini membandingkan snapshot dokumen sebelum/sesudah, bukan mewajibkan corpus kosong. Sumber yang dikembalikan harus cocok dengan tenant serta revision aktif, tanpa mengubah corpus published.

Set routing Bahasa Indonesia memuat 17 pertanyaan FAQ/panduan/fasilitas dengan transport kosong; semuanya menghasilkan abstention tanpa inference. Ini menguji routing dan perilaku tanpa sumber, bukan akurasi jawaban kebijakan atau kualitas provider live. Tes conversation mencakup keluaran model tanpa tool, hasil FAQ positif sintetis, injection inert dan kegagalan dependency. Smoke test live terbatas telah dilakukan pada 7 November 2026 melalui OpenRouter, model nvidia/nemotron-3.5-lightning:free yang diverifikasi pada katalog gratis dan mendukung tools. Terpakai lima request dari batas sepuluh: dua skenario menu masing-masing dua inference menghasilkan kartu menu; skenario permintaan SQL satu inference tidak menghasilkan kartu/aksi tulis. Tidak ada error upstream. Katalog restoran memakai transport sintetis, bukan API bisnis live; ini bukan skor akurasi umum, uji latensi p95, atau sertifikasi injection.

Regresi setelah integrasi: 73 tes Python dan 16 tes browser desktop/emulasi mobile lulus. Tes browser skenario regresi memakai backend tiruan; full-chain FAQ published diuji terpisah tanpa provider.

## Full-chain browser tanpa inference provider

`knowledge-browser.integration.cjs` menjalankan Chromium, proxy Next.js, aplikasi API utama, HTTP ConversationHandler Python, runner dan PostgreSQL nyata. Corpus yang dibaca adalah lima FAQ published lokal yang sudah disetujui, tanpa fixture DB atau write. Pengujian memverifikasi sumber akun yang tepat, judul/revision pada kartu UI, abstention parkir tanpa sumber dan snapshot dokumen tetap sama.

Private model settings diganti nilai sintetis dan model transport mengembalikan respons sintetis, bukan provider nyata. Jalur FAQ bersumber memakai satu request transport sintetis untuk sintesis natural; pertanyaan tanpa sumber tetap nol inference. Seluruh jalur HTTP/retrieval lain nyata. Ini bukti full-chain dengan model tiruan, bukan kelulusan inferensi Agno/OpenRouter live. Server tes memakai port 3110/3111/8111, menolak port yang sudah terpakai, dan hanya menutup child yang dimulainya. Konfigurasi server-only ASSISTANT_ORIGIN dan RESTAURANT_API_ORIGIN membatasi loopback HTTP; default layanan lama tetap berlaku.

Pengujian pertama gagal karena selector judul juga cocok dengan pesan customer; selector diperketat ke judul kartu sumber, kemudian tes lulus. Tidak ada isi FAQ atau schema berubah.

## Verifikasi akhir dan handoff lokal

Setelah jawaban natural dan kartu terbuka diterapkan, regresi ulang lulus: 72 tes API, 77 tes Python, 16 tes browser desktop/emulasi mobile, serta dua tes integrasi read-only (full-chain FAQ published dan endpoint PostgreSQL). Full-chain menggunakan respons model sintetis, tidak memanggil provider nyata atau mengubah corpus. Compile API lulus; build Next terbaru sebelumnya juga lulus setelah perubahan UI.

Haru/Rin melalui connector meninjau checklist dan menyiapkan handoff berdasarkan bukti yang diberikan. Worker tidak mengakses repo atau menjalankan tes tersebut; ini bukan audit independen seluruh source. Perubahan kode tetap lokal pada branch feat/restaurant-faq-knowledge, tanpa commit/push.

Partner perlu mempertahankan default service, memuat konfigurasi private secara aman, dan menerapkan migrasi yang ditinjau pada DB miliknya bila belum tersedia. Data lima FAQ yang dipublikasikan lokal tidak ikut Git; jangan menjalankan ulang publikasi pada DB yang sudah berisi corpus. Revision yang diubah memerlukan persetujuan baru, bukan edit konten approved. Grounding heuristik, provider aktual, variasi pertanyaan yang lebih luas, hak minimum DB, limiter terdistribusi dan perangkat fisik tetap batas verifikasi.

## Integrasi yang masih diperlukan

Penyimpanan, endpoint terikat sesi, tool search_knowledge dan kartu sumber sudah tersedia serta diuji dalam batas yang dijelaskan. Persetujuan dan publikasi lima panduan website serta full-chain browser FAQ telah dilakukan lokal. Penambahan kebijakan restoran lain tetap menunggu fakta dan persetujuan baru. Evaluasi akurasi/relevansi lebih luas, hak minimum akun DB, konkurensi publikasi lintas koneksi dan pengujian perangkat fisik belum selesai. Lima FAQ panduan penggunaan website tersedia pada demo-padang, revision 1. Pencarian akun/referensi telah diverifikasi melalui repository nyata; tenant demo-keluarga tidak memperoleh sumber tersebut. Kebijakan fasilitas belum dipublikasikan. Migrasi tambahan atau publikasi isi memerlukan persetujuan sesuai tindakannya. Tidak ada editor FAQ dashboard atau runtime chatbot kedua.
