# Flow Chatbot Restaurant Assistant

Diagram ini menggambarkan alur MVP chatbot: chatbot membantu customer menemukan informasi restoran dan menyiapkan alur reservasi, sedangkan validasi bisnis dan transaksi tetap dilakukan oleh API bisnis.

## 1. Flow utama customer

```mermaid
flowchart TD
    A[Customer membuka website] --> B[ChatbotWidget]
    B --> C{Sudah ada sesi chat?}
    C -- Tidak --> D[POST /chat/session]
    C -- Ya --> E[Gunakan sesi aktif]
    D --> E
    E --> F[Customer mengirim pesan]
    F --> G[POST /chat/messages]
    G --> H[Redaksi data privat]
    H --> I[Assistant runtime / Agno agent]
    I --> J{Perlu informasi restoran?}
    J -- Ya --> K[Tool read-only]
    K --> L[API bisnis: katalog, menu, jam, availability, knowledge]
    L --> M[Validasi tenant dan hasil tool]
    M --> I
    J -- Tidak --> N{Informasi cukup dan aman?}
    N -- Tidak --> O[Jawab keterbatasan + arahkan ke halaman web]
    N -- Ya --> P[Susun jawaban atau draft reservasi]
    P --> Q{Customer mengonfirmasi
    melalui tindakan terstruktur?}
    Q -- Tidak --> R[Tampilkan ringkasan dan minta koreksi/konfirmasi]
    R --> F
    Q -- Ya --> S[Web/API memvalidasi ulang data reservasi]
    S --> T{Slot, jam, kapasitas,
    meja dan tenant valid?}
    T -- Tidak --> U[Tampilkan gagal + minta slot lain]
    T -- Ya --> V[Transaksi atomic + idempotency + constraint overlap]
    V --> W[Reservasi confirmed]
    W --> X[Tampilkan kartu konfirmasi dari backend]
    O --> Y[Selesai / lanjut melalui website]
    U --> Y
    X --> Y
```

## 2. Diagram cara kerja sistem

```mermaid
sequenceDiagram
    actor C as Customer
    participant W as Website / ChatbotWidget
    participant G as Next.js chat routes
    participant A as Assistant runtime
    participant B as Business API
    participant DB as PostgreSQL
    participant K as Published knowledge

    C->>W: Kirim pesan
    W->>G: POST /chat/messages
    G->>G: Ambil tenant dari server/session
    G->>G: Redaksi data privat sebelum inference
    G->>A: Pesan + konteks terbatas
    A->>A: Validasi turn, batas loop, timeout dan output

    alt Membutuhkan data restoran
        A->>B: Tool read-only dengan internal context
        B->>DB: Query ter-scope tenant/outlet
        B-->>A: Menu/jam/profile/availability
    else Membutuhkan FAQ atau kebijakan
        A->>B: Request knowledge
        B->>K: Published-only + active revision + tenant filter
        K-->>A: Dokumen relevan atau tidak ada sumber
    end

    A-->>G: Jawaban tervalidasi / draft terstruktur
    G-->>W: Respons aman untuk dirender
    W-->>C: Jawaban atau ringkasan reservasi

    opt Customer menekan konfirmasi reservasi
        C->>W: Aksi konfirmasi terstruktur
        W->>G: Request create reservation
        G->>B: Validasi ulang + idempotency key
        B->>DB: Transaksi dan exclusion constraint
        DB-->>B: Commit atau konflik
        B-->>G: Hasil reservasi
        G-->>W: Kartu privat dari backend
        W-->>C: Konfirmasi atau slot alternatif
    end
```

## 3. Batas tanggung jawab

| Komponen | Tanggung jawab |
| --- | --- |
| Website / `ChatbotWidget` | Input customer, render output aman, konfirmasi melalui aksi UI |
| Next.js chat routes | Session, tenant context, masking, response ke browser |
| Assistant runtime | Memahami pesan, memilih tool yang diizinkan, menyusun jawaban/draft |
| Business API | Sumber fakta, aturan reservasi, auth, tenant isolation dan validasi akhir |
| PostgreSQL | Konsistensi transaksi, relasi tenant/outlet dan pencegahan overlap |
| Knowledge retrieval | FAQ/kebijakan yang published dan revision aktif; bukan sumber harga/availability |

Catatan: slot yang terlihat tersedia belum berarti ditahan. Reservasi hanya sah setelah validasi ulang dan transaksi berhasil di API bisnis.
