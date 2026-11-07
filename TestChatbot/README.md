# TestChatbot

Eksperimen chatbot CLI: panggilan model dapat berjalan live, tetapi fakta restoran, menu, dan meja berasal dari fixture sintetis. Ini bukan runtime chatbot website atau integrasi reservasi nyata. Simulator membaca konfigurasi model server-side; jangan menampilkan atau membagikan nilai credential. Simulator tidak menulis ke database bisnis dan tidak membuat reservasi nyata.

## Hubungan dengan website

- Chatbot website tetap memakai runtime Agno yang sudah ada, dengan cakupan informasi restoran, menu, serta FAQ/kebijakan bersumber.
- `check_availability` dan `prepare_reservation` hanya kemampuan eksperimen CLI. Keduanya bukan fitur chatbot website yang diaktifkan melalui simulator ini.
- Availability fixture bukan jaminan meja tersedia. Proposal simulator bukan proposal konfirmasi backend, tidak menahan meja, dan tidak dapat dipakai untuk membuat booking nyata.
- Reservasi customer tetap melalui form web dan API bisnis, dengan konfirmasi serta akses privat terpisah dari model.

## Batas eksperimen dan pemeriksaan

Fixture dua restoran dipilih aplikasi melalui argumen CLI; model tidak memilih tenant lewat tool. Tools eksperimen yang diizinkan: get_restaurant_info, search_menu, check_availability dan prepare_reservation. Tidak ada SQL, shell, admin, akses DB bisnis, atau create/cancel booking. Bentuk objek Restaurant di fixture tidak mengubah model Tenant → Outlet aplikasi.

Scope guard, validasi argumen dan pemeriksaan keluaran dijalankan sebagai kode. Masking telepon/email bukan jaminan semua data privat tersaring; pakai identitas sintetis. Maksimal tiga putaran model per pesan, model harus di-allowlist dan varian gratis; kegagalan provider tidak diatasi retry tanpa batas. Tidak ada training/fine-tuning.

Tes deterministik tanpa model live:

```sh
rtk proxy python -m unittest discover -s TestChatbot -p "test_*.py"
```

Periksa profil/menu/jam, availability/proposal sintetis, parameter invalid, penolakan scope, injection, isolasi dua fixture dan kegagalan model. Target evaluasi eksperimen adalah jawaban sesuai fixture, nol write bisnis, nol klaim booking berhasil dan penolakan ketika bukti tidak cukup. Trace dan metrik bersifat observasi set uji, bukan sertifikasi keamanan atau jaminan model.

`/metrics` menampilkan trace tersamarkan dan rasio yang dihitung implementasi. Bandingkan hasil aktual dengan tool/fakta yang diharapkan; jangan menyamakan tool-argument validity dengan keberhasilan task atau menganggap live smoke test membuktikan seluruh skenario. Jangan membagikan raw credential, header auth, kontak nyata atau history sensitif.

## Menjalankan

Dari root repository:

```sh
rtk proxy python TestChatbot/chat.py --tenant demo-padang
```

Jika terminal sedang berada di folder `TestChatbot`:

```sh
rtk proxy python chat.py --tenant demo-padang
```

Perintah saat chat:

- `/metrics` menampilkan trace dan rasio keberhasilan turn.
- `/reset` menghapus konteks percakapan.
- `/quit` keluar.

Tenant kedua tersedia melalui `--tenant demo-keluarga` untuk memeriksa isolasi fixture.

## Arsitektur simulasi

```text
user → orchestrator → OpenRouter
                  ↘ tool validator → fixture adapter
                    tool result → OpenRouter → jawaban
```

`prepare_reservation` hanya menghasilkan objek proposal simulasi. Tidak ada tool write, database credential bisnis, atau booking nyata. Fixture didefinisikan lokal pada simulator dan dapat berbeda dari data seed maupun keadaan API saat ini; jangan menganggapnya tersinkronisasi. Penggantian adapter dengan HTTP client atau integrasi ke website memerlukan scope, validasi tenant, dan pengujian tersendiri.
