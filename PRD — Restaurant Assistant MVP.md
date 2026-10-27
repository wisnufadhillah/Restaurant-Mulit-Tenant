# PRD — Restaurant Assistant MVP

> Desain usulan untuk pengembangan baru, bukan dokumentasi implementasi yang sudah berjalan. Fokus: produk MVP untuk dua pengembang, selesai sebelum akhir magang Desember 2026. Dokumen ini menggabungkan kebutuhan produk, batas sistem, diagram, dan penjelasan konsep AI agar keputusan implementasi tidak terpisah dari kebutuhan pengguna.

## Ringkasan keputusan

| Aspek | Keputusan |
| --- | --- |
| Produk | Website rumah makan dengan beranda, profil, menu, lokasi, jam buka, reservasi, dan widget chatbot sebagai fokus fitur AI |
| Target demo | Satu tenant/brand dengan satu outlet; isolasi dibuktikan menggunakan dua tenant pada database pengujian |
| Bentuk SaaS | Shared database, shared schema; belum menjual langganan, belum onboarding mandiri |
| Tim dan tenggat | Dua pengembang; target fitur inti 13 Desember, demo stabil 20 Desember 2026, buffer sampai 31 Desember |
| Model | OpenRouter, hanya model gratis yang lulus uji tool calling; tidak ada fallback berbayar |
| AI | Satu agent Agno; tanpa Hermes atau orchestrator tambahan |
| Pengetahuan | RAG kecil dari dokumen kebijakan yang diterbitkan owner; fakta operasional lewat API |
| Reservasi | Satu meja per reservasi; langsung confirmed setelah persetujuan customer dan validasi server |
| Aksi AI | AI menyusun usulan, bukan memberi izin; tombol konfirmasi di web memicu eksekusi backend |
| Ekstensi | MCP read-only setelah inti stabil; A2A dan fine-tuning bukan syarat MVP |

Keputusan teknis dan batas produk di atas merupakan baseline usulan. Uji awal harus membuktikan kelayakan model gratis dan kapasitas tim sebelum fitur diperluas. Biaya inferensi nol bukan jaminan hosting, database terkelola, domain, atau komputasi juga nol; demo lokal diperbolehkan.

## Masalah, pengguna, dan hasil yang dicari

### Masalah

Customer sulit menemukan informasi restoran dan memastikan meja tersedia tanpa bertanya manual. Staff menjawab pertanyaan berulang dan berisiko mencatat reservasi yang saling bertabrakan. Chatbot tanpa tools berpotensi mengarang harga, kebijakan, atau status booking.

### Nilai produk

Customer mengunjungi website rumah makan seperti biasa: melihat identitas restoran, profil, menu, lokasi, jam buka, dan akses reservasi. Chatbot tersedia sebagai widget bantuan percakapan yang mudah ditemukan, bukan pengganti halaman website. Fokus pengembangan AI tetap pada chatbot: mencari menu, menjawab kebijakan, mengecek meja, serta memandu buat/lihat/batal reservasi. Kartu, pilihan waktu, form kontak privat, dan tombol konfirmasi dapat tampil dalam panel chat. Customer bebas memilih halaman/form biasa atau chatbot; staff mengelola sumber data melalui dashboard. Kedua jalur memakai API bisnis yang sama dan layanan web tetap bekerja saat model gagal.

### Pengguna dan haknya

| Pengguna | Aktivitas | Batas |
| --- | --- | --- |
| Customer tanpa akun | Lihat menu, cek meja, buat reservasi, lihat/batalkan reservasinya | Tidak dapat membaca data customer lain |
| Owner | Kelola profil, outlet, jam buka, menu, meja, dokumen, dan reservasi | Hanya tenant miliknya |
| Staff | Kelola ketersediaan menu dan operasional reservasi | Tidak mengubah akun/konfigurasi owner atau menerbitkan dokumen |
| Assistant | Menjawab, memakai tools read-only, menyusun usulan reservasi | Tidak punya hak admin atau koneksi database bisnis |

Provisioning tenant, outlet, owner, dan staff dilakukan melalui seed terkontrol untuk demo. Tidak ada UI super-admin, pendaftaran staff mandiri, atau aturan “tidak punya baris izin berarti boleh mengakses semua”.

### Ukuran keberhasilan

- Customer menyelesaikan buat, lihat, dan batal reservasi dari chatbot website melalui komponen terstruktur, tanpa berpindah ke halaman reservasi mandiri pada kondisi normal.
- Chatbot mencapai minimal 90% keberhasilan skenario normal pencarian menu, FAQ, cek meja, dan alur reservasi dalam set evaluasi tetap; keberhasilan berarti tugas selesai, bukan sekadar respons terkirim.
- Halaman dan form biasa menyelesaikan buat/lihat/batal tanpa membuka chatbot, termasuk saat model tidak tersedia; keberhasilannya dilaporkan terpisah dari keberhasilan chatbot.
- Tidak ada booking bertabrakan pada pengujian konkurensi untuk satu meja dan rentang waktu yang sama.
- Tidak ada aksi tulis tanpa konfirmasi server-side, termasuk saat model meminta tool yang tidak diizinkan.
- Tidak ada kebocoran lintas tenant pada set pengujian isolasi API, sesi, retrieval, dan tool.
- Kuota/model mati tidak menghalangi reservasi web; UI menjelaskan kondisi tanpa mengaku booking berhasil.

Angka tersebut adalah target pengujian, bukan klaim bahwa seluruh kemungkinan serangan atau jawaban model sudah aman.

## Batas MVP

### Wajib tersedia

- Halaman publik tenant: profil, outlet, jam buka, menu aktif dan harga.
- Cek ketersediaan meja menurut waktu dan jumlah tamu.
- Buat reservasi, lihat status, batalkan memakai bukti akses privat.
- Dashboard owner/staff untuk menu, meja, jam operasional, dan reservasi.
- Website publik dengan navigasi beranda, tentang restoran, menu, lokasi/jam buka, serta reservasi; dapat berupa halaman terpisah atau section beranda sesuai kebutuhan konten.
- Widget chatbot sebagai fokus fitur AI: satu assistant Agno, tools read-only, kartu menu, pilihan waktu, form privat, kartu status, dan tombol konfirmasi. Tidak memaksa customer membuka chat untuk memakai website.
- Lihat/batal booking dapat dimulai dari chat; UI memverifikasi akses dan mengeksekusi tindakan melalui backend tanpa memberi model akses data privat.
- RAG untuk FAQ/kebijakan dengan sumber yang terlihat.
- Isolasi tenant, validasi backend, anti double booking, idempotency, audit, pembatasan penggunaan.
- Pengujian fungsional, evaluasi AI, red teaming pada lingkungan milik sendiri.

### Ditunda

- Billing SaaS, paket, custom domain, onboarding mandiri, tema per tenant.
- Banyak outlet dalam UI, stok dan harga berbeda per outlet.
- Ubah jadwal booking, gabung meja, waitlist, pembayaran/deposit.
- Chatbot WhatsApp/Telegram atau kanal eksternal lain, email/SMS OTP, notifikasi produksi, pemesanan makanan, kasir.
- Analitik lanjutan, personalisasi, long-term memory customer.
- Multi-agent, protokol A2A, fine-tuning, autonomous actions.
- Kubernetes, message broker, microservices bisnis terpisah.

### Ekstensi terbatas

MCP read-only boleh ditambahkan setelah semua alur inti dan pengujian keamanan lulus. Tidak boleh menunda demo untuk memasukkannya. Jika mentor mensyaratkan implementasi setiap konsep, buat keputusan scope terpisah; jangan mengubah eksperimen belajar menjadi ketergantungan layanan customer.

## Bahasa domain dan batas data

| Istilah | Makna di produk ini | Jangan disamakan dengan |
| --- | --- | --- |
| Tenant | Brand/pemilik data yang terisolasi dari brand lain | Outlet atau customer |
| Outlet | Lokasi restoran fisik milik tenant | Tenant baru |
| Table | Meja fisik dengan kapasitas dan status aktif | Slot waktu |
| Availability | Hasil perhitungan meja yang bisa dipesan untuk interval tertentu | Jaminan atau penahanan meja |
| Reservation | Komitmen meja untuk interval tertentu, tersimpan lewat transaksi | Draft percakapan |
| Proposal | Ringkasan booking yang belum dieksekusi dan menunggu persetujuan | Reservasi aktif |
| Management token | Bukti akses privat untuk satu reservasi | Kode referensi yang boleh ditampilkan |
| Knowledge document | Dokumen FAQ/kebijakan yang disetujui owner | Harga, stok, atau status booking real-time |
| Tool | Fungsi terkontrol yang bisa diminta agent | Izin melewati aturan backend |

Satu tenant dapat memiliki banyak outlet pada model data, tetapi aplikasi MVP hanya mengoperasikan satu outlet per tenant. Customer guest tidak memiliki identitas global antar-brand. Nama dan nomor telepon disimpan pada reservasi; CRM dan tabel customer tersendiri belum diperlukan.

## Perjalanan pengguna dan penerimaan fitur

| Kemampuan | Perilaku yang diharapkan | Bukti penerimaan |
| --- | --- | --- |
| Lihat menu | Hanya menu aktif tenant yang dipilih, harga Rupiah, label tersedia/habis | Data tenant lain dan menu nonaktif tidak muncul |
| Cek meja | Input tanggal, waktu, jumlah tamu; hasil valid menurut jam dan kapasitas | Jam tutup, tanggal lampau, jumlah invalid ditolak |
| Buat booking web | Ringkasan terlihat, customer menyetujui, backend memeriksa ulang | Kode, waktu, meja, dan status hanya tampil sukses setelah commit |
| Buat booking dibantu AI | Chat mengumpulkan kebutuhan dan menampilkan kartu konfirmasi; form meminta kontak | Tanpa klik konfirmasi tidak ada reservasi; detail berubah harus dikonfirmasi ulang |
| Lihat booking dari chat | Komponen privat memverifikasi token dan menampilkan kartu dari backend, tidak melalui LLM | Kode referensi atau ID chat saja tidak cukup; detail privat tidak masuk transcript |
| Batal booking dari chat | Customer memilih batal pada kartu privat dan menyetujui; backend memeriksa izin/cutoff | Status berubah sekali; retry tidak membuat efek tambahan; model tidak mengeksekusi batal |
| Dashboard | Owner/staff login; daftar dan perubahan dibatasi tenant | Request tanpa peran atau lintas tenant ditolak |
| Jawab kebijakan | Retrieval mengambil dokumen published yang relevan | Jawaban menyertakan judul/sumber; tanpa bukti assistant menyatakan belum tahu |
| Gangguan AI | Ada pesan gangguan dan tautan/form untuk melanjutkan | Layanan web tetap dapat memesan tanpa model |

### Pengalaman chatbot website

Website mempertahankan pola rumah makan pada umumnya: navigasi, hero dengan identitas dan foto restoran, ringkasan profil, menu unggulan, lokasi/jam buka, kontak, serta CTA reservasi. Gunakan konten faktual; jangan membuat testimoni, sertifikasi, atau klaim fasilitas yang belum tersedia. Profil, lokasi, dan menu dapat dilihat tanpa chatbot; pemesanan makanan, pembayaran, dan integrasi peta berbayar tidak termasuk MVP.

Chat dibuka melalui tombol widget berlabel **Tanya restoran** yang konsisten di halaman publik. Panel tidak terbuka paksa, tidak menutup navigasi/CTA, dan dapat ditutup tanpa kehilangan konteks sesi yang masih berlaku. Pada mobile, panel boleh menjadi tampilan layar penuh setelah dibuka customer. Sediakan pemicu awal **Lihat menu**, **Cari meja**, **Kebijakan restoran**, dan **Kelola reservasi**. Customer boleh mengetik bebas atau memilih aksi; hasil tools dirender sebagai kartu yang nilainya berasal dari backend. Fokus AI pada chatbot tidak berarti seluruh tampilan website harus berbentuk chat.

- Percakapan mempertahankan konteks kebutuhan aktif seperti tanggal, jumlah tamu dan pilihan waktu selama sesi berlaku. Koreksi customer memperbarui draft dan membatalkan proposal lama yang tidak sesuai.
- Tanggal/jam ambigu diklarifikasi. Ringkasan memakai tanggal absolut dan zona waktu outlet sebelum persetujuan.
- Nama/telepon dan token akses diisi dalam form privat di dalam permukaan chat; nilainya tidak disalin menjadi pesan, konteks model, atau history percakapan.
- Untuk **Kelola reservasi**, intent dari chat atau tombol membuka komponen verifikasi. Backend menukar bukti akses menjadi management session; detail reservasi dirender langsung sebagai kartu privat, tidak diteruskan ke LLM atau disimpan di transcript.
- Untuk pembatalan, customer memilih tindakan pada kartu privat, memeriksa detail dan cutoff, lalu menekan konfirmasi. Backend memverifikasi izin dan status kembali. Model tidak memiliki tool baca reservasi privat atau tool batal.
- Saat mengetik pertanyaan status/batal setelah verifikasi, gateway mengarahkan ke komponen privat; tidak menyuntikkan detail customer ke prompt. Pengetahuan akses privat tidak otomatis melekat pada sesi model.
- Loading, gagal, retry, kedaluwarsa sesi dan fallback terlihat jelas. Refresh mempertahankan hanya state yang masih diotorisasi; perangkat lain tidak mewarisi akses hanya dari ID chat.

### Alur pengalaman customer

```mermaid
flowchart TD
    Start[Website rumah makan - beranda dan navigasi] --> Pages[Profil - menu - lokasi - jam buka]
    Start --> Direct[Reservasi lewat form biasa]
    Start --> Widget[Customer membuka widget Tanya restoran]
    Widget --> Intent{Kebutuhan customer}
    Intent --> Menu[Menu atau informasi operasional via tools]
    Intent --> FAQ[FAQ melalui RAG dengan sumber]
    Intent --> Book[Cek meja dan siapkan proposal]
    Book --> Form[Form kontak privat dalam chat]
    Form --> Confirm[Customer konfirmasi ringkasan]
    Confirm --> API[Backend validasi dan transaksi]
    API --> Receipt[Kartu hasil resmi dalam chat]
    Intent --> Manage[Kelola reservasi - verifikasi privat]
    Manage --> Card[Kartu status dari backend tanpa melalui model]
    Card --> Cancel[Konfirmasi batal jika memenuhi aturan]
    Cancel --> API
    Widget --> Failure[Model gagal atau kuota habis]
    Failure --> Fallback[Form web mandiri - aturan backend sama]
    Direct --> API
```

### Contoh percakapan

> Customer: Mau meja empat orang besok jam tujuh malam.
>
> Assistant: Untuk besok, 28 Oktober 2026, pukul 19.00 WIB, empat orang. Saya cek ketersediaannya.
>
> Tool: Meja untuk empat orang tersedia, durasi 90 menit.
>
> Assistant: Ada meja pukul 19.00–20.30 WIB. Periksa kartu reservasi, isi kontak, lalu tekan **Konfirmasi reservasi**.
>
> Customer mengisi nama/telepon dalam form privat dan menekan tombol.
>
> Backend: Commit berhasil.
>
> UI: Reservasi dikonfirmasi. Tampilkan kode referensi, detail, dan cara menyimpan akses privat.

Tanggal contoh hanya ilustrasi. Di runtime, server menentukan tanggal absolut dari jam saat itu dan zona waktu outlet. Jika frasa “Jumat ini” ambigu, tanyakan tanggal; jangan menerka.

## Aturan reservasi

- Semua waktu disimpan sebagai `timestamptz`; jam lokal outlet memakai `Asia/Jakarta` untuk demo.
- Durasi tetap 90 menit; interval `[start_at, end_at)` sehingga booking berikutnya boleh dimulai tepat saat sebelumnya selesai.
- Minimal pesan 60 menit sebelum mulai, maksimal 30 hari ke depan, jumlah tamu 1–12 dan tidak melebihi kapasitas meja.
- Satu reservasi menggunakan satu meja aktif; pilih kapasitas terkecil yang mencukupi. Gabungan meja ditunda.
- Seluruh interval harus berada dalam jam buka. MVP hanya mendukung satu interval buka per hari, tidak melewati tengah malam.
- Pengecualian tanggal libur/jam khusus mengalahkan jadwal mingguan. Hari tutup tidak menerima booking.
- Cek availability tidak memblokir slot. Draft/proposal juga tidak memblokir slot.
- Saat customer menyetujui, backend memvalidasi ulang aturan dan menulis secara atomic. Jika meja diambil pihak lain, tampilkan konflik dan minta pilihan baru.
- Booking langsung berstatus `confirmed`; tidak ada `pending`, approval staff, atau expiry hold pada MVP.
- Customer boleh membatalkan paling lambat dua jam sebelum waktu mulai. Pemesanan yang dibuat kurang dari dua jam sebelum mulai harus memperingatkan bahwa pembatalan mandiri sudah ditutup.
- Staff boleh membatalkan dengan alasan; seluruh perubahan status diaudit. Staff tidak boleh membuat double booking atau menautkan data lintas tenant.
- Status `completed` dan `no_show` hanya setelah waktu selesai; no-show juga memerlukan pemeriksaan staff. Semua status akhir immutable.
- Perubahan jam/meja yang memengaruhi booking confirmed tidak boleh diam-diam membatalkan booking; tampilkan konflik dan minta penyelesaian staff. Menonaktifkan meja memblokir booking baru, bukan menghapus riwayat.

### State machine

```mermaid
stateDiagram-v2
    [*] --> confirmed: persetujuan customer + transaksi berhasil
    confirmed --> cancelled: customer sebelum cutoff / staff dengan alasan
    confirmed --> completed: staff setelah end_at
    confirmed --> no_show: staff setelah end_at dan pemeriksaan
    cancelled --> [*]
    completed --> [*]
    no_show --> [*]
```

Hanya `confirmed` memblokir interval. Transisi akhir tidak bisa dibalik. Penyimpanan status, hasil idempotency, dan audit harus konsisten dalam transaksi yang sama untuk perubahan reservasi.

## Arsitektur dan tanggung jawab

### Stack usulan

| Komponen | Pilihan | Alasan dan batas |
| --- | --- | --- |
| Web | Next.js + TypeScript | Halaman customer, dashboard, chat dan form konfirmasi |
| API bisnis | NestJS + PostgreSQL | Seluruh aturan reservasi, auth, tenant, dokumen dan audit |
| Akses DB bisnis | Prisma dengan migrasi SQL untuk constraint khusus | Satu pemilik migrasi; jangan membuat skema bisnis dari Python |
| Runtime AI | Python + Agno, HTTP service privat | Satu agent, model client, tool wrappers, penyusunan respons |
| Model | OpenRouter model gratis terpilih | Model diganti lewat konfigurasi setelah evaluasi; bukan nama model permanen |
| Retrieval | Pencarian lexical/keyword atas chunks di PostgreSQL | Cukup untuk FAQ kecil; tidak membutuhkan embedding berbayar |
| Deployment demo | Lokal atau satu host yang mampu menjalankan komponen | Database satu; tidak perlu platform agent berbayar |

Backend bisnis tetap modular monolith. Runtime Python adalah batas integrasi Agno, bukan alasan memecah seluruh bisnis menjadi microservices. Konsekuensinya ada dua bahasa dan satu service tambahan; uji koneksi sejak awal. Jika biaya koordinasi ini tidak muat, keputusan menghapus Agno perlu persetujuan sebelum implementasi—jangan diam-diam menambah orchestrator lain.

### Diagram komponen

```mermaid
flowchart TB
    Customer[Customer] --> Web[Next.js - website rumah makan dan widget chat]
    Staff[Owner / staff] --> Web
    Web --> API[NestJS API bisnis dan chat gateway]
    API --> DB[(PostgreSQL)]
    API --> AI[Python Agno - satu agent]
    AI --> Router[OpenRouter - allowlist model gratis]
    Router --> LLM[Provider model]
    AI --> Tools[Read-only tool wrappers]
    Tools --> API
    API --> Retrieval[Retrieval chunks - tenant scoped]
    Retrieval --> DB
    API --> Audit[Audit dan telemetry tersamarkan]
    Web --> Confirm[Komponen privat dalam chat - kontak dan konfirmasi]
    Confirm --> API
```

Koneksi balik tools menuju API bukan loop tanpa batas: `/chat` meneruskan inferensi ke runtime AI, sedangkan tools memanggil endpoint internal read-only khusus. Endpoint tool tidak memanggil `/chat`. Tulis reservasi hanya melalui endpoint konfirmasi customer atau endpoint staff yang diotorisasi.

### Batas kepercayaan dan tenant

- Path publik seperti `/t/rumah-padang` memilih katalog tenant. Slug bukan rahasia dan bukan bukti hak akses.
- API meresolusikan slug menjadi tenant aktif dan mengikatnya ke sesi. Semua akses privat tetap membutuhkan sesi staff atau management token yang cocok tenant dan reservasinya.
- Browser tidak boleh memilih `tenant_id` arbitrer dalam payload aksi privat; LLM tidak boleh menentukan tenant, role, atau izin.
- API memberikan runtime AI konteks sesi opaque berumur pendek. API memeriksa kredensial service sekaligus binding tenant/sesi saat tool dipanggil; service token saja bukan izin global membaca seluruh tenant.
- Python tidak memegang credential database bisnis dan tidak mempunyai tool SQL, shell, browser bebas, atau admin.
- Retrieval, cache jika kelak ada, history chat, proposal, dan hasil tool selalu dibatasi tenant serta sesi yang berhak.
- Kegagalan auth/context harus menolak request, bukan memakai tenant default.

## Model data

Konvensi: UUID untuk ID; waktu `timestamptz`; harga integer Rupiah. Tabel milik tenant memiliki `tenant_id NOT NULL`. Kolom timestamp umum tidak diulang seluruhnya pada diagram. `TENANT` adalah akar sehingga tidak memiliki `tenant_id` sendiri.

### ERD operasional

```mermaid
erDiagram
    TENANT ||--o{ OUTLET : owns
    TENANT ||--o{ STAFF_USER : employs
    TENANT ||--o{ MENU_ITEM : offers
    OUTLET ||--o{ OPENING_HOUR : schedules
    OUTLET ||--o{ SPECIAL_DAY : overrides
    OUTLET ||--o{ DINING_TABLE : contains
    OUTLET ||--o{ RESERVATION : receives
    DINING_TABLE ||--o{ RESERVATION : allocated_to
    RESERVATION ||--o{ RESERVATION_EVENT : records

    TENANT {
        uuid id PK
        string slug UK
        string name
        string status
    }
    OUTLET {
        uuid id PK
        uuid tenant_id FK
        string name
        string address
        string contact_phone
        string timezone
        int duration_minutes
        int min_notice_minutes
        int max_advance_days
        int cancel_cutoff_minutes
        int max_party_size
        boolean is_active
    }
    STAFF_USER {
        uuid id PK
        uuid tenant_id FK
        string email
        string password_hash
        string role
        boolean is_active
    }
    MENU_ITEM {
        uuid id PK
        uuid tenant_id FK
        string name
        string category
        string description
        int price_idr
        boolean is_available
        boolean is_active
    }
    OPENING_HOUR {
        uuid id PK
        uuid tenant_id FK
        uuid outlet_id FK
        int weekday
        time open_time
        time close_time
        boolean is_closed
    }
    SPECIAL_DAY {
        uuid id PK
        uuid tenant_id FK
        uuid outlet_id FK
        date local_date
        time open_time
        time close_time
        boolean is_closed
    }
    DINING_TABLE {
        uuid id PK
        uuid tenant_id FK
        uuid outlet_id FK
        string table_number
        int capacity
        boolean is_active
    }
    RESERVATION {
        uuid id PK
        uuid tenant_id FK
        uuid outlet_id FK
        uuid table_id FK
        string reference_code
        string management_token_hash
        timestamptz management_expires_at
        string guest_name
        string guest_phone
        timestamptz start_at
        timestamptz end_at
        int party_size
        string status
        string source
        string idempotency_key
        string request_hash
    }
    RESERVATION_EVENT {
        uuid id PK
        uuid tenant_id FK
        uuid reservation_id FK
        string from_status
        string to_status
        string actor_type
        uuid actor_id
        string reason
        timestamptz created_at
    }
```

`MENU_ITEM` milik brand karena MVP hanya mengoperasikan satu outlet. `is_available` berarti bisa ditawarkan, bukan jumlah persediaan inventori. Sebelum banyak outlet diaktifkan, tambahkan assignment menu, harga, dan availability per outlet; jangan mengklaim model sekarang sudah menyelesaikan stok multi-outlet.

Email staff unik dalam tenant, bukan global. `actor_id` pada event boleh null untuk customer/system; identitas aktor dipasok backend, bukan model.

### ERD assistant dan pengetahuan

```mermaid
erDiagram
    TENANT ||--o{ CHAT_SESSION : isolates
    OUTLET ||--o{ CHAT_SESSION : scopes
    CHAT_SESSION ||--o{ CHAT_MESSAGE : contains
    CHAT_SESSION ||--o{ TOOL_RUN : traces
    CHAT_SESSION ||--o{ BOOKING_PROPOSAL : prepares
    RESERVATION o|--o| BOOKING_PROPOSAL : results_from
    TENANT ||--o{ KNOWLEDGE_DOCUMENT : owns
    KNOWLEDGE_DOCUMENT ||--o{ KNOWLEDGE_CHUNK : splits_into

    CHAT_SESSION {
        uuid id PK
        uuid tenant_id FK
        uuid outlet_id FK
        string access_token_hash
        timestamptz expires_at
    }
    CHAT_MESSAGE {
        uuid id PK
        uuid tenant_id FK
        uuid session_id FK
        string role
        string redacted_content
        timestamptz created_at
    }
    TOOL_RUN {
        uuid id PK
        uuid tenant_id FK
        uuid session_id FK
        string tool_name
        string status
        json redacted_metadata
        string model_id
        int latency_ms
        int input_tokens
        int output_tokens
        timestamptz created_at
    }
    BOOKING_PROPOSAL {
        uuid id PK
        uuid tenant_id FK
        uuid session_id FK
        uuid outlet_id FK
        uuid reservation_id FK
        timestamptz start_at
        timestamptz end_at
        int party_size
        string payload_hash
        string state
        timestamptz expires_at
    }
    KNOWLEDGE_DOCUMENT {
        uuid id PK
        uuid tenant_id FK
        string title
        string body
        int revision
        string status
        uuid published_by FK
        timestamptz published_at
    }
    KNOWLEDGE_CHUNK {
        uuid id PK
        uuid tenant_id FK
        uuid document_id FK
        int document_revision
        int position
        string content
    }
```

Diagram assistant memakai `TENANT`, `OUTLET`, dan `RESERVATION` yang sama dengan diagram operasional. Satu proposal bisa menghasilkan paling banyak satu reservasi; reservasi web biasa tidak harus memiliki proposal. `reservation_id` nullable dan unik pada proposal. FK `published_by` mengarah ke staff tenant yang sama. Sesi chat tidak otomatis membuktikan kepemilikan reservasi.

`TOOL_RUN` bukan metering lengkap: token berasal dari respons provider jika tersedia, dicatat sekali per inference request untuk mencegah penghitungan ganda ketika satu request meminta banyak tools; metadata menyimpan request/run ID. Jika field tidak tersedia, gunakan null, bukan nol palsu. Detail implementasi dapat memisahkan telemetry inferensi dari tool saat diperlukan.

### Constraint dan invariant wajib

- Foreign key komposit memastikan pasangan tenant dan resource benar: `(tenant_id, outlet_id)`, `(tenant_id, session_id)`, `(tenant_id, document_id)` dan seterusnya harus merujuk unique key yang cocok.
- Reservasi merujuk meja lewat `(tenant_id, outlet_id, table_id)` agar meja tidak berasal dari outlet lain. Parent menyediakan unique key untuk kombinasi tersebut.
- Unique untuk `(tenant_id, reference_code)`, `(tenant_id, idempotency_key)`, `(tenant_id, email)` pada staff, dan `(tenant_id, outlet_id, table_number)` pada meja.
- Jadwal mingguan unik per outlet/hari; pengecualian unik per outlet/tanggal. Pada hari buka, `close_time > open_time`; hari tutup boleh tanpa interval.
- `end_at > start_at`, `party_size > 0`, `capacity > 0`, `price_idr >= 0`; kolom wajib juga `NOT NULL`, bukan CHECK saja.
- Exclusion constraint PostgreSQL pada tenant, meja, dan interval waktu untuk baris `status = confirmed` menjadi pertahanan terakhir anti tabrakan. Aktifkan dukungan operator yang diperlukan lewat migrasi terkontrol.
- Kapasitas, jam buka, cutoff dan izin divalidasi service, bukan CHECK yang membaca tabel lain.
- Availability dan create menggunakan aturan waktu yang sama. Transaksi create memvalidasi ulang dan memetakan konflik constraint menjadi respons konflik, bukan error internal.
- Idempotency scope mencakup tenant, operasi, dan kunci. Key sama + payload sama mengembalikan hasil lama; payload berbeda ditolak. Retry harus diperiksa sebelum alokasi slot baru.
- Hasil retry memulihkan receipt/reservasi tanpa membocorkan management token kepada sesi yang tidak berhak. Browser pembuat terikat sesi; pemulihan token harus memakai bukti sesi dan rotasi, bukan menyimpan token mentah dalam log/kolom idempotency.
- Staff dan API memakai query tenant-scoped. RLS dapat ditambahkan kemudian; ketiadaannya tidak membebaskan kewajiban tes isolasi dan FK komposit.

## Alur reservasi AI dan konfirmasi

### Tool yang tersedia untuk agent

| Tool | Fungsi | Menulis bisnis? |
| --- | --- | --- |
| `get_restaurant_info` | Profil, outlet, jam dan aturan operasional | Tidak |
| `search_menu` | Nama, kategori, harga, availability menu | Tidak |
| `check_availability` | Interval dan kapasitas yang tersedia | Tidak |
| `search_knowledge` | Cuplikan FAQ/kebijakan approved beserta sumber | Tidak |

Keluaran agent dapat berisi data usulan booking berskema. Chat gateway memvalidasi data itu, kemudian membuat proposal terikat sesi. Agent tidak memiliki `create_reservation`, `cancel_reservation`, atau tool admin pada MVP. Ini tetap assistant berguna: mencari fakta, mengumpulkan kebutuhan, dan menyiapkan aksi, sementara pengguna menyetujui secara eksplisit.

### Sequence diagram

```mermaid
sequenceDiagram
    actor C as Customer
    participant W as Chatbot website dan komponen privat
    participant B as NestJS API
    participant A as Agno agent
    participant L as OpenRouter
    participant D as PostgreSQL
    C->>W: Minta meja untuk waktu dan jumlah tamu
    W->>B: Pesan dengan sesi chat
    B->>A: Pesan tersamarkan + konteks sesi terikat tenant
    A->>L: Inference dengan schema tools
    L-->>A: Permintaan check_availability
    A->>B: Tool read-only + konteks sesi
    B->>D: Cari meja valid dalam tenant dan outlet
    D-->>B: Opsi tersedia
    B-->>A: Hasil faktual
    A->>L: Hasil tool untuk menyusun respons
    L-->>A: Respons + usulan berskema
    A-->>B: Usulan belum dieksekusi
    B->>D: Simpan proposal valid, expiry dan hash
    B-->>W: Kartu dengan detail absolut dan proposal ID
    C->>W: Isi kontak privat + klik konfirmasi
    W->>B: Konfirmasi proposal + idempotency key
    B->>D: Transaksi: cek sesi, expiry, payload, aturan dan slot; insert + event
    alt Commit berhasil
        D-->>B: Reservasi confirmed
        B-->>W: Receipt + akses privat sekali melalui jalur aman
        W-->>C: Kode, status dan detail terkonfirmasi
    else Slot konflik atau proposal invalid
        D-->>B: Tolak tanpa reservasi baru
        B-->>W: Konflik / perlu konfirmasi ulang
        W-->>C: Pilih slot lain / perbarui detail
    end
```

### Aturan proposal

- Masa berlaku usulan 10 menit sebagai baseline konfigurasi. Tidak ada hold meja selama periode ini.
- Konfirmasi diikat pada sesi, tenant, outlet, payload terkanonisasi dan hash, serta nonce sekali pakai. Detail berubah → proposal baru.
- Konsumsi proposal, pembuatan reservasi, serta pencatatan hasil idempotency harus atomic. Klik ganda atau request paralel tidak boleh membuat dua reservasi.
- Model tidak boleh mengirim `confirmed=true` sebagai bukti persetujuan. Chat “ya” saja tidak mengeksekusi tulis; UI mengarahkan ke tombol konfirmasi.
- Jika model salah menyalin harga/status, tampilkan nilai operasional dalam kartu UI yang diisi backend. Respons natural language tetap dievaluasi; kartu bukan alasan membiarkan model mengarang.
- Jika commit berhasil tetapi respons terputus, browser melakukan retry dengan kunci sama atau mengambil receipt melalui sesi pembuat. Jangan menginstruksikan membuat booking baru.

### Akses privat reservasi

Kode referensi bukan credential. Backend menghasilkan management token acak kriptografis minimal 128 bit, menyimpan hash dan expiry, serta menukarnya menjadi sesi akses terbatas. Token tidak masuk prompt, query string, telemetry, atau transcript chat. Jika akses perlu dipindahkan perangkat, customer menyalin token melalui UI privat dan memasukkannya pada form; request membawa token lewat body HTTPS, bukan URL.

Sesi browser memakai cookie HttpOnly/Secure/SameSite yang sesuai, pemeriksaan Origin/CSRF untuk mutasi, dan akses hanya pada reservasi terkait. Masa berlaku pengelolaan maksimal sampai 24 jam setelah `end_at`; pencabutan/rotasi tersedia pada backend. Token hilang → kontak staff; belum ada pemulihan otomatis berbasis empat digit telepon. Token adalah bearer secret: siapa yang memilikinya dapat mengakses reservasi selama berlaku.

Nama dan telepon dikumpulkan dalam form terstruktur, tidak perlu dikirim ke model. Jika customer mengetiknya di chat, gateway menyamarkan data sebelum inference dan persistence. Masking otomatis tidak sempurna: gunakan data sintetis untuk demo dan jangan mengaktifkan customer nyata sebelum privacy flow ditinjau.

## RAG: dokumen untuk jawaban, bukan database transaksi

### Sumber kebenaran

| Pertanyaan | Sumber yang digunakan |
| --- | --- |
| Berapa harga rendang? | `search_menu` / API menu |
| Masih ada meja pukul 19.00? | `check_availability` / service reservasi |
| Apakah booking saya sudah confirmed? | Halaman privat dengan management session, bukan RAG |
| Di mana alamat dan jam buka hari ini? | API profil/jadwal dengan pengecualian tanggal |
| Bagaimana aturan membawa kue atau fasilitas keluarga? | Dokumen published melalui RAG |
| Sampai kapan boleh batal? | Konfigurasi cutoff API; dokumen hanya penjelasan yang konsisten |

### Pipeline retrieval

```mermaid
flowchart LR
    O[Owner menulis FAQ Markdown / teks] --> V[Validasi dan review isi]
    V --> P[Publish revision dokumen]
    P --> C[Chunk deterministik + metadata tenant]
    C --> K[(Chunks PostgreSQL)]
    Q[Pertanyaan customer] --> S[Search endpoint dengan konteks tenant dari sesi]
    K --> S
    S --> F[Filter published dan revision aktif sebelum ranking]
    F --> R[Ambil cuplikan relevan + judul sumber]
    R --> A[Agno memasukkan cuplikan sebagai data tak tepercaya]
    A --> J[Jawaban dengan sumber atau belum tahu]
```

### Retrieval minimum yang realistis

- Mulai dengan 10–20 FAQ pendek per tenant. Owner menerbitkan teks yang sudah diperiksa, bukan crawler web bebas.
- Chunk berdasarkan judul/paragraf, simpan judul, revision, posisi dan tenant. Search lexical/keyword deterministik cukup sebagai baseline RAG: retrieve konteks lalu generate jawaban tidak mewajibkan vector database.
- Ambil maksimal tiga cuplikan relevan; kalibrasi ranking dan kecocokan dengan pertanyaan Indonesia pada set uji. Tidak ada hasil memadai → abstain dan tampilkan kontak staff.
- Unpublish dokumen langsung menghilangkannya dari retrieval. Publish revision baru dan pergantian chunks harus atomic atau memakai pointer revision aktif agar isi lama/baru tidak tercampur.
- Tidak memakai cache lintas tenant. Jika cache ditambahkan, key dan invalidasinya wajib memasukkan tenant, revision, dan konteks izin.
- Jawaban menyertakan judul sumber dan tautan ke halaman publik dokumen yang memang boleh dibaca. Jangan mengarang URL atau menunjuk dokumen internal.
- Embedding lokal + vector search hanya ditambahkan jika hasil lexical terbukti tidak cukup. Pilih model multilingual, cek lisensi, RAM, ukuran unduhan, dan evaluasi sebelum menetapkan stack. Belum ada embedding provider yang diwajibkan.
- Jangan memasukkan data customer atau reservasi ke korpus. Agent tidak boleh menulis pengetahuan berdasarkan chat customer secara otomatis.

Dokumen yang memuat instruksi “abaikan aturan” tetap data tak tepercaya, bukan instruksi system. RAG meningkatkan grounding, tetapi tidak menjamin kebenaran atau menghilangkan prompt injection.

## OpenRouter gratis: batas operasional

### Kebijakan model

- Pilih model yang benar-benar mempunyai varian `:free` pada katalog dan mendukung parameter tools yang dibutuhkan. Menambahkan suffix pada sembarang ID tidak membuat model gratis.
- Tetapkan satu model utama dan paling banyak satu cadangan gratis yang telah lulus evaluasi yang sama. Hindari routing acak untuk jalur booking karena kualitas dan dukungan fitur dapat berubah antar-model/provider.
- Pilihan final ditentukan lewat smoke test Bahasa Indonesia, schema tools, argumen invalid, tool timeout, dan keluaran proposal. Tidak mengunci nama model yang mungkin hilang dari katalog.
- Allowlist dan validasi konfigurasi saat startup; jangan memasukkan model berbayar, paid plugins, atau fallback berbayar tanpa keputusan biaya baru.
- Kunci OpenRouter hanya pada server melalui environment/secret store; tidak dikirim ke browser dan tidak dicetak.

### Kapasitas, retry, dan demo

Varian gratis memiliki batas request dan ketersediaan berbeda. Kuota bukan SLA. Batas aktual akun diperiksa lewat dashboard atau endpoint key resmi sebelum pengujian dan demo; angka spesifik tidak dijadikan janji produk karena kebijakan dapat berubah.

- Satu giliran dengan tool dapat membutuhkan dua atau lebih inference request. Anggaran harian dihitung dari request model, bukan sekadar jumlah pesan customer.
- Baseline: maksimal tiga tool call dan tiga inference request per giliran, maksimum output ditetapkan, deadline giliran 30 detik. Hentikan loop ketika batas tercapai.
- Retry maksimal satu kali untuk kegagalan sementara dengan backoff dan `Retry-After` jika masih muat deadline. Kuota harian habis → tidak retry berulang.
- Model error, 429, timeout, respons invalid, dan stream terputus menghasilkan pesan gangguan dan tombol lanjut form; tidak mengaku aksi telah berhasil.
- Target usability internal chat: respons selesai p95 maksimal 30 detik pada smoke test ketika provider tersedia. Laporkan availability dan rate-limit terpisah; jangan menghapus sampel gagal agar angka tampak bagus.
- Tes otomatis memakai stub model dan respons tool deterministik. Live evaluation dibagi beberapa hari sesuai kuota, dengan model/provider/tanggal dan request yang terpakai dicatat.
- Demo harus mempunyai jalur web yang dapat ditunjukkan saat provider sedang down; rekaman demo hanya cadangan yang diberi label, bukan bukti live berhasil.

### Privasi provider

Data melewati OpenRouter dan upstream provider. Pengaturan logging/retensi OpenRouter tidak otomatis berarti provider lain memiliki kebijakan sama. Periksa data policy dan routing provider terpilih sebelum pilot nyata. Jangan melonggarkan syarat privasi semata-mata supaya model gratis tersedia. Untuk MVP magang gunakan identitas sintetis dan form kontak yang tidak masuk model.

## Guardrails dan red teaming

### Lapisan pertahanan

| Lapisan | Kontrol wajib |
| --- | --- |
| Browser | Form berlabel, ringkasan detail absolut, konfirmasi eksplisit, rendering teks/Markdown aman, tanpa raw HTML |
| Gateway | Binding tenant/sesi, redaksi PII, panjang pesan, batas request, deadline, pembatasan riwayat |
| Agent | Instruksi domain restoran, schema tools, daftar tools read-only, tidak ada SQL/shell/admin |
| Tool/API | Auth service + konteks sesi, validasi argumen, pembatasan tenant, respons error tanpa informasi privat |
| Konfirmasi | Proposal belum kedaluwarsa, payload identik, nonce, CSRF, idempotency |
| Database | FK komposit, unique key, transaksi, exclusion constraint |
| Retrieval | Hanya dokumen approved, filter tenant sebelum ranking, revision aktif, sitasi dan abstention |
| Operasional | Audit tersamarkan, retention, evaluasi regresi, fallback web |

Prompt adalah satu lapisan, bukan boundary keamanan. Guardrail framework atau model detektor tidak menggantikan izin dan transaksi backend.

### Matriks pengujian adversarial

| Skenario uji pada staging sendiri | Hasil yang diwajibkan | Bukti |
| --- | --- | --- |
| Customer meminta mengabaikan aturan dan menampilkan seluruh booking | Tidak ada data privat atau tool admin | Respons dan trace endpoint |
| Dokumen FAQ berisi instruksi meminta data tenant lain | Retrieval tetap tenant-scoped; instruksi tidak menjadi izin | Cuplikan, tool trace, dan pemeriksaan respons |
| Payload tool menyisipkan tenant/outlet milik brand lain | Ditolak atau field tak diizinkan tidak diterima | API test dan DB assertion |
| ID sesi chat tenant lain ditebak/disalin | Tidak ada history, proposal, atau metadata tenant lain | Session access test |
| Model meminta create/cancel atau SQL arbitrary | Tool tidak tersedia, tidak dieksekusi | Trace dan jumlah write nol |
| Proposal diubah setelah ditampilkan | Konfirmasi ditolak; perlu persetujuan baru | Hash dan response assertion |
| Klik ganda atau replay konfirmasi | Maksimal satu reservasi, hasil konsisten | Tes idempotency dan row count |
| Dua customer mengambil meja sama bersamaan | Tepat satu berhasil untuk satu meja fixed | Tes PostgreSQL nyata |
| Tool menu timeout tetapi customer meminta harga | Tidak mengarang harga; tampilkan fallback | Evaluasi respons dan kartu UI |
| Pertanyaan tanpa dukungan dokumen | Menyatakan belum tahu, bukan membuat kebijakan | Dataset jawaban tanpa sumber |
| Nomor telepon atau management token masuk chat | Tidak diteruskan mentah ke model/log; input privat dialihkan ke form | Pemeriksaan payload/log sintetis |
| Output berisi HTML/script atau tautan palsu | Tidak menjalankan script; tautan dibatasi/ditampilkan aman | Tes rendering browser |
| Permintaan berulang menghabiskan kuota | Rate limit dan loop budget bekerja | Counter inference dan error terkontrol |

Red teaming dilakukan hanya pada sistem dan data sintetis milik tim. Jangan mencoba menyerang restoran, provider, akun, atau tenant pihak lain. Temuan menjadi regression test setelah perbaikan. Lulus set uji terbatas bukan sertifikat bahwa sistem kebal serangan.

## Posisi Agno, MCP, A2A, RAG, dan fine-tuning

| Konsep | Penjelasan sederhana | Posisi dalam produk |
| --- | --- | --- |
| Agno | Kerangka kerja untuk menjalankan agent, model dan tools | Dipakai untuk satu assistant; bukan model dan bukan database |
| Tool calling | Model meminta fungsi, aplikasi memvalidasi dan mengeksekusi | Dipakai untuk data operasional read-only |
| RAG | Cari cuplikan dokumen, masukkan ke konteks model, jawab berdasarkan cuplikan | Dipakai untuk FAQ/kebijakan kecil |
| MCP | Protokol client-server untuk tools, resources dan konteks | Opsional sebagai adapter tools; API HTTP biasa cukup untuk inti |
| Multi-agent | Beberapa agent berbagi atau membagi pekerjaan | Tidak perlu untuk satu layanan reservasi |
| A2A | Protokol interoperabilitas antar-agent independen, bukan sekadar dua fungsi saling memanggil | Ditunda sampai ada kebutuhan delegasi lintas sistem |
| Fine-tuning | Melatih lanjutan bobot model untuk pola tugas tertentu | Ditunda; tidak ada kebutuhan/dataset teruji atau anggaran training |
| Guardrails | Kontrol untuk membatasi input, output, akses dan tindakan | Wajib sejak fitur pertama |
| Red teaming | Pengujian adversarial untuk mencari cara kontrol gagal | Wajib dengan skenario terukur, bukan sekadar bertanya chatbot pertanyaan aneh |

### Mengapa tidak semua wajib dibangun?

Contoh “harga rendang berapa?” hanya perlu agent + tool menu. Menambah agent lain, protokol A2A, dan training tidak memperbaiki sumber harga. Pertanyaan “boleh membawa kue?” mendapat manfaat dari retrieval dokumen. Memaksa RAG untuk availability justru berisiko memakai informasi basi.

Fine-tuning baru masuk akal bila evaluasi menunjukkan masalah pola respons/klasifikasi yang konsisten, prompt dan retrieval sudah dibenahi, dataset berizin tersedia, dan peningkatan pada held-out test mengalahkan biaya training serta pemeliharaan. Bukan untuk menghafal booking, harga, atau mencegah semua injection.

### Diagram ekstensi MCP opsional

```mermaid
flowchart LR
    A[Agno assistant / MCP host] --> C[MCP client]
    C --> S[Restaurant MCP server - read-only]
    S --> B[NestJS business API]
    B --> D[(PostgreSQL)]
```

Adapter MCP membungkus `get_restaurant_info`, `search_menu`, dan `check_availability`; tidak menyalin aturan bisnis. Identitas service dan konteks tenant/sesi tetap diverifikasi API. Penemuan tool bukan pemberian hak akses. MCP remote tidak dibuka publik tanpa desain autentikasi dan otorisasi yang diverifikasi terhadap versi spesifikasi yang dipilih.

### Diagram A2A konseptual, bukan target implementasi

```mermaid
flowchart LR
    C[Customer] --> R[Restaurant service agent]
    R -. Delegasi A2A dengan izin dan scope .-> E[Agent katering independen]
    E -. Hasil tugas .-> R
```

Kebutuhan ini belum ada dalam MVP. Jika kelak dipakai, masing-masing agent tetap memiliki izin terbatas; A2A tidak membawa hak lintas tenant secara otomatis. Komunikasi NestJS ke service Agno pada arsitektur inti adalah integrasi service HTTP, bukan bukti implementasi A2A.

## Kontrak antarmuka minimum

Nama route di bawah merupakan rancangan, bukan kontrak kode yang sudah tersedia. Pilih versi final saat implementasi, gunakan error seragam dengan kode semantik dan pesan aman.

| Area | Operasi | Otorisasi dan perilaku |
| --- | --- | --- |
| Publik tenant | Profil, menu, availability | Tenant aktif dari slug; tidak ada PII |
| Chat | Buat sesi, kirim pesan, baca history sesi sendiri | Cookie/session secret; scope tenant dan outlet |
| Proposal | Buat dari usulan tervalidasi, tampilkan, konfirmasi | Sesi pemilik, expiry, payload, nonce, idempotency |
| Reservasi | Buat langsung via form | Rate limit, validasi, konfirmasi dan idempotency |
| Pengelolaan reservasi | Tukar token, lihat detail, batal | Token privat → management session dengan scope satu reservasi |
| Staff | Login/logout, CRUD data, daftar dan transisi reservasi | Session staff, role, tenant dan audit |
| Knowledge | Owner membuat draft/publish/unpublish; publik membaca versi published | Publish hanya owner; tenant-scoped |
| Internal tools | Info/menu/availability/retrieval | Service auth dan konteks sesi terverifikasi, tidak dapat dieksekusi dari browser |

Status error membedakan input invalid, autentikasi/izin gagal, konflik slot/idempotency, cutoff, rate limit, dan ketergantungan AI unavailable. Respons privat tidak mengungkap apakah ID milik tenant lain ada. Cookie/credential tidak dicetak ke log.

## Kualitas, data, dan observabilitas

- API availability: target p95 di bawah satu detik pada fixture 20 meja dan 1.000 reservasi per tenant di mesin demo; laporkan spesifikasi mesin dan hasil aktual.
- Semua mutasi divalidasi server-side. Login staff memakai password hash yang sesuai dan sesi cookie aman; logout mencabut sesi.
- Rate limit login, token exchange, booking, dan chat; tidak mengandalkan IP saja. Parameter awal dikalibrasi agar dua pengembang masih bisa menguji tanpa membuka abuse.
- Log hanya request ID, tenant ID yang aman, tipe operasi, error code, durasi, model ID, token usage jika ada. Tidak menyimpan raw prompt/token/telepon di telemetry.
- Chat tersamarkan dan trace tool dihapus setelah 30 hari; sesi chat kedaluwarsa setelah 24 jam; proposal invalid setelah 10 menit. Audit operasional demo disimpan maksimal 90 hari. Tidak ada data pribadi nyata dalam seed.
- Data reservasi sintetis dipertahankan sampai evaluasi akhir. Kebijakan retensi data customer nyata, persetujuan pemrosesan, penghapusan, dan akses staff harus disetujui sebelum pilot nyata.
- Backup/restore database diuji minimal sekali sebelum demo. Hosting gratis yang sleep tidak dijadikan jaminan availability produksi.
- Form dan chat dapat digunakan keyboard, label input jelas, status/error terbaca, loading tidak mengunci jalur web, responsif mobile.

## Strategi verifikasi

### Pengujian deterministik

- Unit: normalisasi waktu, cutoff, kapasitas, jadwal mingguan dan hari khusus, status terminal.
- Integration dengan PostgreSQL nyata: constraint overlap, FK lintas tenant/outlet, transaksi gagal tanpa write parsial, idempotency dan nonce.
- Konkurensi: 50 request berbeda untuk satu meja fixed dan interval sama → tepat satu reservasi confirmed; retry key sama → satu hasil, bukan reservasi baru.
- Auth: tenant lain, sesi lain, token salah/kedaluwarsa, role staff versus owner, CSRF, logout/revocation.
- RAG: filter tenant sebelum ranking, hanya published/current revision, unpublish/reindex dan abstention.
- E2E utama: mulai dari chat untuk menu/FAQ/cek meja serta buat/lihat/batal reservasi, konfirmasi melalui komponen privat, koreksi detail dan tanggal ambigu, refresh halaman, akses sesi kedaluwarsa, respons commit hilang.
- E2E fallback: model/kuota mati → form mandiri tetap bekerja; nilai kontak, token, dan kartu reservasi privat tidak masuk payload model atau transcript.

### Evaluasi AI terbatas kuota

Mulai dengan 30 skenario tetap: delapan menu/profil, enam dokumen FAQ, enam alur reservasi dari chat (buat/lihat/batal, koreksi detail, tanggal ambigu dan konfirmasi), enam adversarial/isolasi, empat gangguan/abstention. Sebagian adversarial API diuji tanpa memanggil model. Tambahkan variasi setelah kegagalan ditemukan, bukan mengejar jumlah semata.

Catat input sintetis, fakta yang diharapkan, tool yang dipanggil, sumber retrieval, respons aktual, jumlah inference request, model/provider, latensi, dan hasil penilaian. Gunakan pemeriksaan programatis untuk nilai/menu/tenant dan review manusia untuk kualitas jawaban; jangan bergantung pada LLM judge berbayar.

- Harga/status/ketersediaan: seluruh klaim yang diuji cocok dengan hasil tool; target 100% dalam set evaluasi.
- Jawaban FAQ: minimal 90% sesuai sumber pada skenario yang memiliki jawaban; seluruh skenario tanpa bukti harus abstain.
- Normal task success: minimal 90% pada skenario normal; kegagalan provider dilaporkan terpisah dan tetap dihitung pada laporan end-to-end.
- Safety: nol unauthorized write dan nol kebocoran lintas tenant pada set uji. Satu kegagalan → perbaiki sebelum rilis.
- Ganti model, prompt, schema tools atau strategi retrieval → jalankan regression suite yang relevan sebelum demo.

## Rencana delivery sampai Desember 2026

Baseline jadwal mulai 27 Oktober 2026. Dua pengembang, waktu efektif magang belum diasumsikan penuh setiap hari. Tinjau kemajuan mingguan; tanggal adalah target internal, bukan janji kapasitas provider gratis.

| Periode | Pengembang backend | Pengembang frontend dan AI | Bukti keluaran |
| --- | --- | --- | --- |
| 27 Okt–1 Nov | Model tenant/outlet, migrasi awal, rancangan kontrak tools dan sesi | Skeleton web, service Agno, smoke test model gratis dan fallback | Satu tool membaca API; schema/proposal dan biaya nol terbukti pada smoke test |
| 2–15 Nov | Auth staff, menu, meja, jam dan hari khusus, constraint tenant | Beranda/profil/menu/lokasi, dashboard, widget chat read-only dan renderer aman | Website bisa dijelajahi tanpa chat; tenant berbeda tidak saling melihat data; menu/jadwal dapat diisi |
| 16–29 Nov | Availability, create/cancel, token akses privat, idempotency dan audit | Alur chatbot buat/lihat/batal dengan komponen privat, kartu proposal, konfirmasi dan form fallback | Reservasi dari chat lengkap, data privat tidak masuk model, tes konkurensi lulus |
| 30 Nov–6 Des | Endpoint retrieval, publish/revision dokumen, pemeriksaan sesi internal | RAG kecil, sumber jawaban, evaluasi respons dan failure UI | FAQ punya sumber; dokumen tenant lain tidak masuk konteks |
| 7–13 Des | Auth negatif, replay, pengujian transaksi dan log | E2E chat/web, evaluasi AI, aksesibilitas; MCP hanya jika inti sudah lulus | Fitur inti dibekukan; tidak ada kegagalan safety terbuka |
| 14–20 Des | Backup/restore, deploy lokal/staging, perbaikan bug | Demo lengkap, evaluasi live sesuai kuota, panduan penggunaan | Demo stabil dengan jalur AI dan fallback web |
| 21–31 Des | Buffer, perbaikan penghambat dan serah terima | Buffer, rekaman cadangan berlabel dan penjelasan teknis | Tidak menambah fitur besar menjelang akhir magang |

Kedua pengembang mereview batas auth, skema tool, dan konfirmasi bersama; integrasi berjalan sejak minggu pertama. Jangan menunggu seluruh backend selesai untuk mencoba model dan tools.

Jika terlambat: hapus MCP, gambar menu/dekorasi UI, dan fitur dashboard noninti lebih dulu. Kurangi korpus FAQ, bukan filter tenant atau sumber jawaban. Jangan memotong anti double booking, kontrol akses, konfirmasi, idempotency, dan fallback web. Jika model gratis tidak mampu tool calling secara memadai, bekukan AI pada read-only yang lulus uji dan arahkan booking ke form dengan batas kemampuan yang dijelaskan jujur.

## Urutan belajar yang langsung mendukung produk

| Urutan | Pelajaran | Latihan kecil | Tanda sudah memahami |
| --- | --- | --- | --- |
| Fondasi domain | Tenant berbeda dari outlet; interval meja dan status | Gambarkan dua brand dengan masing-masing satu outlet | Bisa menjelaskan mengapa menambahkan tenant_id saja belum cukup |
| Backend dan tools | API deterministik sebagai sumber fakta | Panggil search_menu tanpa LLM, lalu melalui satu agent | Output sama dan tenant terikat server |
| Agno/OpenRouter | Agent bukan model; tool request bukan eksekusi otomatis | Model meminta tool invalid dan simulasi timeout | Aplikasi menolak aman, tidak menjalankan fungsi sembarang |
| Konfirmasi | Proposal bukan booking | Klik ganda, ganti detail, putuskan respons sesudah commit | Satu booking dan tidak ada aksi diam-diam |
| RAG | Retrieval berbeda dari training | Jawab FAQ dengan sumber; unpublish dokumen | Jawaban lama tidak muncul dan tanpa sumber berani belum tahu |
| Guardrails/red teaming | Kontrol diuji, bukan dipercaya | Uji direct injection dan dokumen terkontaminasi pada staging | Bukti tidak ada data bocor atau aksi ilegal |
| MCP opsional | Protokol membungkus tools yang sama | Satu tool read-only lewat MCP dibanding HTTP wrapper | Aturan bisnis dan scope izin tetap sama |
| A2A/fine-tuning konseptual | Pilih solusi berdasarkan masalah | Jelaskan kasus yang benar-benar membutuhkan keduanya | Bisa menyebut alasan tidak memakainya dalam MVP |

Untuk laporan mentor: demonstrasikan satu alur nyata, tunjukkan sumber data, jelaskan trust boundary, lalu tunjukkan satu percobaan serangan yang ditolak dan satu kegagalan model yang fallback. Mengerti kapan tidak memakai teknologi merupakan bagian keputusan engineering.

## Risiko dan keputusan yang masih perlu diuji

| Risiko | Tindakan |
| --- | --- |
| Model gratis dihapus/kuota habis atau tools tidak andal | Smoke test awal, dua kandidat gratis teruji, stub pada CI, fallback web |
| Agno menambah bahasa/service untuk tim kecil | Service AI tipis, tidak memiliki DB bisnis, kontrak HTTP diuji sejak awal |
| Lexical retrieval gagal pada sinonim Indonesia | Evaluasi FAQ, perbaiki redaksi/kata kunci; embedding hanya jika manfaat terukur |
| Scope meluas menjadi SaaS lengkap | Demo satu outlet; multi-tenant dibuktikan tes, bukan billing dan onboarding |
| Token akses privat bocor | Hash at rest, tidak masuk model/URL/log, scope tunggal, expiry/revocation |
| Penyaringan PII melewatkan data di chat | Form terpisah, data sintetis, review payload; pilot nyata ditahan sampai privacy review |
| Infrastruktur gratis sleep atau tidak cukup RAM | Demo lokal dan rehearsal; jangan menjanjikan SLA produksi |
| Mentor ternyata mewajibkan implementasi semua konsep | Konfirmasi deliverable mentor; eksperimen terpisah butuh pemotongan fitur/waktu yang disepakati |

Masih perlu ditetapkan saat kickoff: jumlah jam kerja efektif, target host atau lokal, model gratis yang lulus uji, kebijakan provider yang diterima, dan cara pengelolaan sesi staff. Hal ini tidak menghalangi penulisan desain, tetapi menghalangi klaim bahwa deployment produksi sudah siap.

## Kriteria selesai

- Customer dapat mencari menu, bertanya FAQ, cek meja serta membuat, melihat, dan membatalkan booking dari chatbot website; kartu/form privat merupakan bagian pengalaman chat, bukan pengalihan wajib ke halaman lain.
- Beranda, profil, menu, lokasi/jam buka serta form reservasi dapat digunakan tanpa membuka chatbot. Form biasa mendukung buat/lihat/batal, termasuk saat model gagal; keberhasilannya tidak dihitung sebagai bukti keberhasilan alur chatbot.
- Chat membaca data operasional dari tools dan FAQ dari sumber published, menyiapkan proposal tanpa hak tulis.
- Konfirmasi customer menghasilkan tepat satu reservasi lewat aturan bisnis yang sama dengan web.
- Dua tenant dalam pengujian tidak saling mengakses data, termasuk sesi chat, dokumen dan proposal.
- Tes PostgreSQL nyata membuktikan tidak ada overlap untuk satu meja dan interval sama.
- Gangguan model/kuota tidak memblokir form reservasi dan tidak memalsukan status sukses.
- Evaluasi AI dan red-team suite dijalankan, hasil aktual serta keterbatasan dicatat.
- Tidak ada credential atau identitas nyata di seed, prompt evaluasi, log, dan bahan demo.
- Backup/restore serta demo ulang berhasil; batas fitur dapat dijelaskan tanpa mengklaim A2A/fine-tuning sudah dibangun.

## Sources

Referensi untuk konsep dan batas layanan; bukan bukti integrasi aplikasi telah berjalan. Dukungan adapter Agno, model, dan transport harus dicocokkan kembali dengan versi yang dipin saat implementasi. Kompatibilitas Agno–OpenRouter harus dibuktikan lewat smoke test, bukan diasumsikan dari kemiripan format API.

- [Agno: Agents](https://docs.agno.com/agents/overview) — agent, tools, teams dan workflow.
- [Agno: Knowledge](https://docs.agno.com/knowledge/overview) — ingestion, chunking dan retrieval.
- [Agno: Documentation index](https://docs.agno.com/llms.txt) — lokasi referensi model compatibility dan MCP yang berlaku.
- [OpenRouter: Free Variant](https://openrouter.ai/docs/guides/routing/model-variants/free) — varian gratis dan risiko fallback berbayar.
- [OpenRouter: Limits](https://openrouter.ai/docs/api/reference/limits) — batas akun, rate limit dan penanganan error.
- [OpenRouter: Tool Calling](https://openrouter.ai/docs/guides/features/tool-calling) — model mengusulkan tools; aplikasi mengeksekusi.
- [OpenRouter: Data Collection](https://openrouter.ai/docs/guides/privacy/data-collection) — logging dan metadata; kebijakan upstream perlu pemeriksaan tersendiri.
- [MCP: Architecture](https://modelcontextprotocol.io/docs/learn/architecture) — host, client, server dan konteks.
- [A2A: What is A2A?](https://a2a-protocol.org/latest/topics/what-is-a2a/) — interoperabilitas antar-agent independen.
- [Hugging Face: Fine-tuning](https://huggingface.co/docs/transformers/training) — pelatihan lanjutan model pretrained.
- [OWASP: Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) — direct/indirect injection dan mitigasi berlapis.
- [PostgreSQL: Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) — CHECK, unique, foreign key dan exclusion constraints.
