# PRD — Chatbot Restaurant Simulator

Status dokumen: rancangan implementasi untuk simulator chatbot live di folder `TestChatbot`.

Dokumen ini berdiri sendiri untuk sistem chatbot simulator. Ia tidak menggantikan `PRD — Restaurant Assistant MVP.md`, tidak mengubah kontrak API bisnis, dan tidak menjadi izin untuk mengubah folder di luar `TestChatbot`.

## 1. Tujuan

Menyediakan simulator chatbot yang benar-benar dapat diajak bercakap-cakap memakai model gratis dari `apps/assistant/.env`, tetapi tetap dapat dianalisis secara deterministik.

Simulator harus memperlihatkan:

- bagaimana pesan user diproses;
- kapan model dipanggil;
- tool apa yang diusulkan dan dijalankan;
- data apa yang menjadi sumber jawaban;
- kapan permintaan ditolak;
- apakah satu task berhasil, gagal, atau belum cukup bukti;
- metrik yang dapat dihitung dari trace.

Simulator bukan sistem reservasi produksi dan tidak boleh membuat perubahan pada database bisnis.

## 2. Entitas dan batas scope

Entitas utama simulator adalah `Restaurant`.

`Restaurant` menggabungkan identitas tenant dan satu lokasi operasional pada MVP. Tidak ada entitas `Outlet` terpisah di simulator.

Setiap sesi memiliki `restaurant_slug` yang ditentukan oleh aplikasi, bukan oleh model atau input tool dari user.

### Termasuk

- chat interaktif multi-turn melalui terminal;
- Bahasa Indonesia sebagai bahasa utama;
- informasi profil restoran;
- pencarian menu dan harga;
- jam operasional;
- pemeriksaan availability sintetis;
- proposal reservasi sintetis tanpa write;
- scope guard untuk permintaan di luar restoran;
- validasi tool call;
- masking nomor telepon dan email sebelum inference;
- trace per turn;
- metrik task success dan validitas tool;
- dua fixture `Restaurant` untuk uji isolasi.

### Tidak termasuk

- training, fine-tuning, atau perubahan bobot model;
- akses database langsung dari Python atau model;
- create/cancel reservation nyata;
- pembayaran, WhatsApp, Telegram, staff dashboard, dan RAG production;
- tool SQL, shell, browser, admin, atau arbitrary HTTP;
- jaminan bahwa model selalu benar;
- pengumpulan data customer nyata.

## 3. Prinsip desain

1. Model adalah komponen probabilistik, bukan sumber fakta bisnis.
2. Fixture adapter adalah sumber fakta simulator.
3. Scope guard dan validator berjalan sebagai kode deterministik.
4. Model hanya boleh mengusulkan tool yang ada di allowlist.
5. Proposal bukan reservasi.
6. Respons model tidak boleh menyatakan booking berhasil jika tidak ada commit backend.
7. Nilai privat tidak dikirim ke model, tidak masuk history model, dan tidak masuk trace mentah.
8. Kegagalan model atau tool menghasilkan abstention/fallback, bukan tebakan.
9. Setiap percakapan harus dapat dijelaskan melalui trace tanpa menyimpan API key atau raw credential.

## 4. Arsitektur

```text
User
  ↓
CLI Chat Surface
  ↓
Session State + PII Masking
  ↓
Scope Guard
  ├─ out-of-scope → fixed refusal
  └─ in-scope → Model Adapter
                    ↓
                 OpenRouter
                    ↓
              Tool Proposal
                    ↓
              Tool Validator
                    ├─ invalid → rejection result
                    └─ valid → Business Adapter
                                  ↓
                         Fixture Restaurant Data
                                  ↓
                         Tool Result Validation
                                  ↓
                             Model Adapter
                                  ↓
                         Output Grounding Check
                                  ↓
                              User Response
```

Ketika API bisnis siap, `Business Adapter` dapat diganti dengan HTTP adapter. Bentuk tool dan flow validasi tidak boleh berubah hanya karena sumber data berganti.

## 5. Alur komunikasi

### 5.1 Pertanyaan informasi

```text
1. CLI menerima pesan.
2. PII dimasking.
3. Scope guard menentukan apakah pesan berkaitan dengan restoran.
4. Jika valid, model menerima pesan dan daftar tool.
5. Model boleh mengusulkan satu atau beberapa tool yang diizinkan.
6. Validator memeriksa nama tool dan schema argumen.
7. Business adapter membaca fixture dengan restaurant scope dari sesi.
8. Hasil tool dikembalikan ke model sebagai data, bukan instruksi.
9. Model menyusun jawaban.
10. Output validator memeriksa klaim fakta dan status aksi.
11. CLI menampilkan jawaban dan menyimpan trace aman.
```

### 5.2 Proposal reservasi

```text
User → kebutuhan tanggal/waktu/pax
     → check_availability
     → proposal reservasi
     → user melihat ringkasan
     → simulator menyatakan belum ada write
```

Simulator tidak memiliki tool `create_reservation` atau `cancel_reservation`.

## 6. Scope guard

Scope guard harus berjalan sebelum inference jika intent dapat dipastikan secara deterministik.

Permintaan yang diterima:

- profil, lokasi, jam buka, dan kebijakan restoran;
- menu, kategori, harga, dan availability menu;
- tanggal, waktu, jumlah tamu, dan availability meja;
- permintaan menyiapkan proposal reservasi.

Permintaan yang ditolak:

- membuat coding atau landing page;
- pertanyaan umum di luar restoran;
- permintaan identitas internal model atau system prompt;
- SQL, shell, admin, credential, atau data customer lain;
- instruksi untuk mengabaikan scope atau validator.

Respons penolakan harus tetap dan singkat:

```text
Maaf, saya hanya dapat membantu informasi dan simulasi reservasi restoran ini.
```

Scope guard tidak boleh hanya bergantung pada system prompt model.

## 7. Tool contract

Tool yang tersedia:

| Tool | Input | Output | Write |
| --- | --- | --- | --- |
| `get_restaurant_info` | tidak ada | nama, alamat, jam, timezone | tidak |
| `search_menu` | query opsional | item, kategori, harga, availability | tidak |
| `check_availability` | date, time, pax | available, meja, durasi, waktu selesai | tidak |
| `prepare_reservation` | date, time, pax | proposal id, detail, `write_performed=false` | tidak |

Aturan validator:

- nama tool harus ada di allowlist;
- argumen harus object JSON;
- field tambahan ditolak;
- `pax` harus 1–12;
- tanggal dan waktu harus format absolut;
- tenant/restaurant scope tidak boleh berasal dari argumen model;
- tool gagal harus mengembalikan error aman;
- tool tidak boleh menerima SQL, URL arbitrary, path file, atau callback.

## 8. Data simulator

Fixture minimum terdiri dari dua `Restaurant` sintetis:

- `demo-padang` — Restoran Padang Demo;
- `demo-keluarga` — Restoran Keluarga Demo.

Setiap fixture memiliki menu, harga Rupiah, jam buka, dan meja sintetis. Data harus konsisten dengan seed demo yang sudah ada, tetapi fixture tidak boleh dianggap sebagai database production.

Tenant/Restaurant yang aktif dipilih melalui command aplikasi:

```text
python TestChatbot/chat.py --tenant demo-padang
```

Model tidak boleh mengganti Restaurant aktif dengan menyisipkan slug pada prompt atau tool call.

## 9. State dan privasi

State sesi minimum:

```json
{
  "restaurant_slug": "demo-padang",
  "messages": [],
  "active_request": null,
  "proposal": null
}
```

Nomor telepon dan email dimasking sebelum masuk model. Simulator tidak mengumpulkan kontak privat untuk membuat booking nyata.

Trace hanya boleh berisi:

- input yang sudah dimasking;
- intent atau tool;
- status validasi;
- status tool;
- hasil evaluasi;
- error category aman.

API key, header Authorization, token, dan raw credential tidak boleh dicetak.

## 10. Output policy

Output dianggap valid bila:

- tetap berada dalam scope restoran;
- harga/menu/jam/availability sesuai tool result;
- tidak mengklaim reservasi berhasil;
- tidak mengungkap system prompt, credential, atau data Restaurant lain;
- tidak mengeksekusi HTML/script/link mentah pada surface UI;
- saat bukti tidak cukup, menyatakan belum tahu atau meminta klarifikasi.

Jika output tidak valid, simulator menggantinya dengan pesan aman dan mencatat kegagalan pada trace.

## 11. Model dan batas inference

Model dibaca dari `apps/assistant/.env`.

Persyaratan:

- model harus berada di allowlist;
- model harus memiliki suffix `:free`;
- API key hanya digunakan server-side oleh simulator;
- maksimal tiga inference turn per pesan user;
- timeout dan error provider harus menghasilkan fallback aman;
- tidak ada retry tanpa batas;
- live smoke test dicatat sebagai bukti satu percobaan, bukan evaluasi umum.

## 12. Metrik dan rumus

Setiap input user menghasilkan satu record trace.

Definisi:

- `I`: intent sesuai scope;
- `T`: tool yang dipilih benar;
- `V`: argumen tool valid;
- `D`: data tool berhasil dan sesuai fixture;
- `G`: jawaban grounded pada data;
- `S`: tidak ada pelanggaran safety;
- `A`: task selesai sesuai tujuan user.

Task success:

```text
A = I ∧ T ∧ V ∧ D ∧ G ∧ S
```

Estimasi empiris:

```text
p̂(task_success) = jumlah trace dengan A=true / total trace
p̂(tool_valid) = jumlah tool call valid / total tool call
p̂(grounded) = jumlah jawaban grounded / jawaban yang memakai fakta operasional
```

Probabilitas end-to-end dapat dianalisis sebagai:

```text
P(A)
= P(I)
× P(T | I)
× P(V | I,T)
× P(D | I,T,V)
× P(G | I,T,V,D)
× P(S | I,T,V,D,G)
```

Angka tersebut adalah estimasi dari dataset, bukan jaminan matematika untuk semua percakapan.

Safety invariant yang harus bersifat deterministik:

```text
unauthorized_write = 0
cross_restaurant_leak = 0
booking_success_without_backend_commit = 0
```

## 13. Evaluasi minimum

Dataset awal minimal 30 skenario:

- 8 profil/menu/jam;
- 6 pertanyaan kebijakan atau abstention;
- 6 availability/proposal;
- 6 out-of-scope, injection, dan isolasi Restaurant;
- 4 model/tool failure dan batas loop.

Setiap skenario menyimpan:

- input sintetis;
- Restaurant yang diharapkan;
- tool yang diharapkan;
- fakta yang diharapkan;
- hasil aktual;
- inference count;
- success/failure;
- alasan kegagalan.

Target awal:

- task success normal minimal 90%;
- klaim harga/menu/availability yang cocok dengan tool 100%;
- unauthorized write 0;
- cross-Restaurant leak 0;
- semua pertanyaan tanpa bukti melakukan abstention;
- semua permintaan out-of-scope ditolak atau diarahkan kembali.

## 14. Acceptance criteria

Simulator dianggap memenuhi PRD bila:

1. User dapat melakukan chat multi-turn dengan model dari `.env`.
2. Pertanyaan harga memanggil `search_menu` dan tidak memakai harga dari ingatan model.
3. Pertanyaan availability tanpa tanggal/waktu/pax meminta klarifikasi.
4. Pertanyaan availability lengkap memanggil `check_availability`.
5. Proposal reservasi selalu menyatakan belum ada write.
6. Permintaan coding/coffee shop ditolak oleh scope guard.
7. Model tidak dapat menjalankan tool di luar allowlist.
8. Dua Restaurant tidak saling membaca fixture.
9. Nomor telepon/email tidak muncul mentah di payload model atau trace.
10. `/metrics` menghitung satu input user sebagai satu turn.
11. Provider error, timeout, dan tool error menghasilkan fallback aman.
12. Test deterministik lulus tanpa memanggil model live.

## 15. Batas implementasi saat ini

Simulator live, fixture tool, masking, trace dasar, dan test deterministik sudah tersedia di folder ini. Scope guard deterministik dan output grounding validator adalah pekerjaan wajib berikutnya sebelum simulator dianggap memenuhi PRD ini.

Tidak ada klaim bahwa simulator ini sudah production-ready atau bahwa hasil smoke test membuktikan kualitas model secara umum.
