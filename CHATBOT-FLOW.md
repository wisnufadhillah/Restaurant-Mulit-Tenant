# Flow Chatbot Restaurant Assistant

Alur berikut memisahkan chatbot informasi dari reservasi web. Diagram menjelaskan batas integrasi yang dituju, bukan bukti seluruh komponen retrieval atau evaluasi sudah selesai diimplementasikan.

## Chatbot website

Chatbot membantu informasi restoran, pencarian menu, serta FAQ/kebijakan bersumber. Tidak mengecek meja, menyusun proposal booking, atau menjalankan transaksi reservasi dalam cakupan website ini.

```mermaid
flowchart TD
    A[Customer membuka website] --> B[ChatbotWidget opsional]
    B --> C[Sesi chat dan konteks tenant dari server]
    C --> D[Customer mengirim pesan]
    D --> E[Redaksi data privat]
    E --> F[Satu agent Agno dengan batas loop dan deadline]
    F --> G{Butuh sumber informasi?}
    G -- Profil atau menu --> H[Tool read-only ke API bisnis]
    G -- FAQ atau kebijakan --> I[Retrieval published dan revision aktif]
    H --> J[Validasi tenant dan hasil]
    I --> J
    J --> F
    G -- Sumber cukup --> K[Jawaban aman dengan sumber yang relevan]
    G -- Di luar scope atau gagal --> L[Nyatakan keterbatasan dan arahkan ke halaman web]
    K --> M[Render tanpa raw HTML]
    L --> M
```

Fakta operasional berasal dari API. FAQ hanya menggunakan dokumen yang boleh dipublikasikan untuk tenant tersebut; kontak customer dan data booking bukan corpus knowledge. Dokumen dan hasil tool diperlakukan sebagai data, bukan instruksi system.

## Reservasi web terpisah

Customer dapat memakai form tanpa membuka chat. Runtime AI tidak terlibat dalam penyimpanan, konfirmasi, akses privat, atau pembatalan.

```mermaid
sequenceDiagram
    actor C as Customer
    participant W as Form dan receipt privat
    participant P as Next.js reservation routes
    participant B as Business API
    participant DB as PostgreSQL

    C->>W: Isi waktu, jumlah tamu dan kontak privat
    W->>P: Minta ringkasan konfirmasi
    P->>B: Cookie pembuat dan detail tervalidasi
    B->>DB: Baca konfigurasi dan availability tenant/outlet
    B-->>W: Ringkasan, nonce dan expiry melalui proxy
    Note over C,DB: Ringkasan bukan booking dan tidak menahan meja
    C->>W: Konfirmasi eksplisit
    W->>P: Detail sama, nonce dan Idempotency-Key
    P->>B: Request create dengan sesi pembuat
    B->>DB: Validasi ulang dan transaksi atomic
    DB-->>B: Commit atau konflik
    B-->>W: Receipt atau kegagalan melalui proxy
    C->>W: Lihat status atau konfirmasi batal
    W->>P: Sesi manajemen satu reservasi
    P->>B: Validasi akses, referensi tampilan dan cutoff
    B->>DB: Baca status atau transaksi batal dan audit
    B-->>W: Hasil privat melalui proxy
```

Retry dengan key dan payload sama hanya memulihkan hasil untuk pihak berhak. Kode referensi saja tidak memberi akses. Token tidak dikirim ke URL, prompt, atau transcript chat.

## Eksperimen CLI

`TestChatbot/chat.py` adalah simulator terpisah untuk eksperimen percakapan. Panggilan model dapat live, tetapi adapter tools membaca fixture lokal, bukan database bisnis.

```text
Terminal → validasi scope dan masking → model
                                      ↕
                              validator tool → fixture sintetis
```

Tools eksperimen meliputi `get_restaurant_info`, `search_menu`, `check_availability`, dan `prepare_reservation`. Availability dan proposal di sini hanya simulasi; tidak terhubung ke ringkasan konfirmasi backend dan tidak membuat booking. Keberadaan tools eksperimen tidak memperluas scope chatbot website atau menambahkan runtime kedua ke aplikasi.

## Batas tanggung jawab

| Komponen | Tanggung jawab |
| --- | --- |
| ChatbotWidget dan chat routes | Sesi chat, konteks tenant, masking dan render jawaban informasi |
| Agent Agno | Memilih tool read-only yang diizinkan dan menyusun jawaban bersumber |
| Form reservasi dan reservation routes | Input privat, ringkasan, konfirmasi eksplisit dan receipt |
| Business API | Fakta operasional, aturan bisnis, auth, isolasi tenant/outlet, transaksi dan audit |
| PostgreSQL | Foreign key komposit, konsistensi dan pencegahan overlap |
| Knowledge retrieval | FAQ/kebijakan published dengan revision aktif dan tenant filter |
| Simulator CLI | Eksperimen fixture; bukan sumber fakta live atau jalur transaksi website |

Model internal tetap Tenant → Outlet. Istilah produk Restoran tidak menghapus isolasi tenant atau relasi lokasi yang sudah ada; migrasi model data memerlukan arahan terpisah.
