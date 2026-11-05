# TestChatbot

Simulator chatbot live untuk menguji alur percakapan dengan data sintetis. Simulator ini membaca model dan API key dari `apps/assistant/.env`, tetapi tidak menulis ke database bisnis dan tidak membuat reservasi nyata.

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

`prepare_reservation` hanya membuat proposal. Tidak ada tool write, database credential, atau booking nyata. Fixture mengikuti seed sintetis API saat ini sehingga adapter dapat diganti dengan HTTP client ketika endpoint bisnis sudah siap.
