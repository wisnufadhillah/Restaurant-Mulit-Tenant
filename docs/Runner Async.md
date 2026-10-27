# Runner Async

## Implementasi yang tersedia

`async_runner.py` menyatukan gateway, budget transport, loop Agno, dan tool katalog async. Fungsi run_simulated hanya menerima HTTPX MockTransport untuk kedua layanan; tidak ada transport jaringan nyata dalam runner ini. Tujuannya menguji lifecycle lengkap sebelum menyediakan jalur live.

Alur: pesan → execute_offline → budget baru → HTTPX model terhitung → Agno arun → tool katalog async → schema respons → request final → output atau fallback. Client HTTPX dan client SDK ditutup pada finally/context manager, termasuk saat timeout.

## Kegagalan yang diuji

- Jalur sukses: dua request model sintetis, satu request tool, hasil tool masuk pesan model.
- Budget satu request: request kedua diblokir sebelum forwarding dan hasil dipaksa budget_exhausted/fallback.
- Tool API lambat: deadline gateway membatalkan handler async; cleanup berjalan dan hasil timeout.
- Tool API 503: sekalipun model mengirim final claim, flag tool_failed memaksa fallback, bukan jawaban sukses.

Agno dapat menangkap exception model/tool lalu menghasilkan output. Karena itu exception saja tidak cukup untuk safety: wrapper menyimpan flag budget_exhausted dan tool_failed lalu memeriksanya setelah arun. Tes awal menemukan false success pada budget dan perubahan ini menutupnya. Tes tambahan menemukan false success serupa saat model merespons HTTP 429. Transport kini menyimpan flag failed untuk HTTP error atau exception transport; runner memaksakan fallback setelah arun. Tes HTTP 429 dan pembatalan request model lambat lulus. Output grounding lain serta stream error tetap perlu diuji.

## Menjalankan tes

```sh
rtk proxy uv run --project apps/assistant --locked python -m unittest discover -s apps/assistant -p "test_*.py"
```

Suite assistant total 30 test lulus. Tes negatif sengaja memicu log ERROR/WARNING Agno dengan pesan sintetis aman; log itu bukan kegagalan suite bila rangkuman berakhir OK. Logging framework masih harus dibatasi/redaksi sebelum live karena debug_mode false tidak menghapus semua error log. Jangan menggunakan data atau key nyata pada tes ini.

## Batas

Belum ada endpoint chat, sesi privat, redaksi pesan, rate limit, transport live atau UI chatbot. Runner hanya simulasi; loader key pengguna tidak dijalankan. Async cancellation diuji pada transport mock kooperatif, bukan jaminan penghentian provider eksternal. Jangan mengganti MockTransport menjadi transport live tanpa gate biaya/privasi dan tes failure/cancellation yang relevan.

Schema profil tetap hanya data publik. Metadata slug diikat aplikasi dan tidak membuktikan izin internal; auth service/session tetap pekerjaan terpisah. Provider gratis aktual belum dipilih atau diuji.

Dokumentasi API yang sudah berjalan tersedia di folder `api`: panduan README dan kontrak OpenAPI JSON. Tidak ada Swagger UI runtime saat ini.
