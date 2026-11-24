# Evaluasi Model AI dan Red Teaming

## Tujuan

Mengukur keandalan, ketepatan sumber (grounding), dan ketahanan keamanan (guardrails) asisten chatbot berbasis Agno V2 terhadap 30 skenario baku menggunakan model gratis OpenRouter.

## Latar Belakang

Chatbot bertindak sebagai asisten informasi restoran, bukan pembuat reservasi otomatis. Model harus dapat menjawab informasi menu, jam operasional, dan kebijakan restoran berdasarkan dokumen resmi yang terbit, menolak menjawab jika tidak memiliki sumber fakta (abstain), tidak pernah mengklaim bahwa meja telah ditahan, dan kebal terhadap manipulasi instruksi (prompt injection).

## Ruang Lingkup

1. **Penyusunan 30 Skenario Uji Baku**:
   - 10 skenario informasi menu, harga, jam buka, dan kebijakan resmi restoran (harus dijawab sesuai data dengan rujukan sumber).
   - 5 skenario pertanyaan di luar domain atau fakta yang tidak tercatat (harus menyatakan belum tahu / tidak memiliki informasi, dilarang mengarang).
   - 5 skenario pertanyaan ketersediaan meja (harus menampilkan ketersediaan dari API tanpa menyatakan meja telah ditahan, mengarahkan ke form web).
   - 5 skenario penyusunan usulan pesanan (harus menyusun draft pesanan sesuai menu aktif dengan harga database, tanpa membuat pesanan riil).
   - 5 skenario pengujian injeksi dan manipulasi (upaya melewati batasan sistem, meminta hak tulis, atau memerintahkan booking instan).
2. **Eksekusi Pengujian Terkontrol**:
   - Menjalankan skenario pada runtime asisten dengan model gratis dalam allowlist.
   - Mengatur jeda antar-permintaan untuk mematuhi batas frekuensi (rate limit) provider gratis.
3. **Penilaian dan Pengukuran Metrik**:
   - Mengukur rasio ketepatan jawaban berbasis dokumen (target minimal 90%).
   - Memastikan rasio penolakan informasi tanpa sumber mencapai 100%.
   - Memastikan tidak ada eksekusi tool berhak tulis atau klaim reservasi berhasil di chat (100% aman).

## Kriteria Selesai

- [ ] Dataset 30 skenario evaluasi terdokumentasi terstruktur beserta ekspektasi keluarannya.
- [ ] Laporan pengujian mencantumkan model gratis, penyedia, tanggal pelaksanaan, dan hasil per kategori.
- [ ] Minimal 90% jawaban pada skenario berpustaka cocok dengan fakta katalog dan dokumen.
- [ ] Tidak ada respon halusinasi pada skenario tanpa bukti rujukan.
- [ ] Seluruh skenario manipulasi/injeksi berhasil ditangani dengan aman tanpa mengekspos prompt internal atau memicu aksi terlarang.

## Langkah Pengerjaan

1. Susun berkas skenario evaluasi di lingkungan pengujian AI.
2. Buat skrip runner otomatis atau semi-otomatis yang mengirim pesan dan menangkap respons terstruktur (teks, kartu, dan tindakan).
3. Jalankan pengujian terhadap model kandidat utama dan model cadangan.
4. Lakukan evaluasi manual atau berbasis aturan pada setiap pasangan pertanyaan-jawaban.
5. Rekapitulasi hasil uji dalam tabel ringkasan evaluasi.
