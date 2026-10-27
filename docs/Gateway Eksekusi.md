# Gateway Eksekusi

## Tujuan

`apps/assistant/execution_gateway.py` menyediakan boundary untuk runner async offline: validasi panjang pesan, budget percobaan request model, timeout kooperatif, serta respons fallback tetap. Belum ada endpoint HTTP chat atau koneksi runner ke Agno/OpenRouter. Fungsi sengaja bernama execute_offline agar tidak keliru dianggap jalur produksi.

## Alur

```text
Pesan → validasi → budget baru per giliran → runner stub async
                                         ↓
                       output valid / fallback deterministik
```

Runner mendapat teks yang sudah di-trim dan objek RequestBudget. Sebelum setiap percobaan inference runner harus memanggil consume. Limit default tiga; percobaan keempat melempar BudgetExceeded sebelum aksi stub berikutnya. Request gagal tetap dihitung. Tidak ada retry otomatis pada gateway.

Hasil ExecutionResult berisi status, message dan attempted_requests. Status: ok, invalid_input, invalid_output, budget_exhausted, timeout atau unavailable. Detail exception tidak dikembalikan. CancelledError dari pemanggil tetap diteruskan agar shutdown/cancel tidak dianggap jawaban normal.

## Batas yang dipaksa dan yang belum

- Input: string nonkosong maksimal 2000 karakter. Ini bukan redaksi PII atau detektor prompt injection.
- Output: string nonkosong maksimal 8000 karakter. Ini bukan pemeriksaan grounding atau sanitizer HTML; UI tetap wajib render aman.
- RequestBudget: 1–3 percobaan dengan counter per eksekusi. Counter berlaku jika runner tepercaya memanggil consume sebelum transport. Belum ada instrumentasi transport SDK/Agno, jadi belum merupakan hard cap provider live.
- Timeout: positif maksimal 30 detik memakai asyncio.timeout. Dapat membatalkan coroutine yang kooperatif. Tidak bisa mematikan blocking I/O/thread atau coroutine yang menelan cancellation. Tool sinkron urllib yang tersedia belum dipasang ke gateway ini.
- Error: fallback tetap mengarahkan ke halaman/form web, tanpa menyertakan detail koneksi, provider atau credential. Tidak ada penggantian ke model berbayar.

Jangan memasang factory agent langsung sebagai runner lalu mengklaim budget request dan hard deadline sudah terpenuhi. Adapter live harus menghitung setiap request pada transport dan memakai I/O async/cancellation yang benar, atau boundary proses terpisah bila dibutuhkan. Shutdown resource harus diuji bersama adapter tersebut.

## Cara membaca tes

`test_execution_gateway.py` memakai runner async sintetis, tanpa key, LLM atau database. Skenario: dua request sukses, percobaan keempat diblokir, timeout dengan cleanup, error tanpa bocor detail/retry, input invalid tanpa runner, output invalid, external cancellation, isolasi counter antar-giliran dan konfigurasi limit invalid.

```sh
rtk proxy uv run --project apps/assistant --locked python -m unittest discover -s apps/assistant -p "test_*.py"
```

Total suite assistant sekarang 20 test lulus. Angka itu mencakup schema/tool/factory sebelumnya dan sembilan tes gateway; bukan 20 evaluasi jawaban model.

## Hal yang harus selesai sebelum live

- Loader credential privat dengan path eksplisit dan validasi tanpa logging nilai.
- Adapter Agno yang budget-aware pada setiap request transport, termasuk retry dan final response.
- Deadline end-to-end yang diuji terhadap tool I/O nyata dan pembatalan client.
- Tes loop model stub yang benar-benar meminta tool dan menerima hasil; tes gateway sekarang hanya runner stub, bukan loop Agno.
- Binding sesi, rate limit, redaksi data sebelum inference, kontrol output serta batas error pada endpoint.
- Pemilihan model gratis berdasarkan katalog/kemampuan dan persetujuan panggilan live dengan data sintetis.

Belum ada perubahan status Linear atau panggilan OpenRouter pada penambahan gateway offline ini.

## Sources

- [Python: Task cancellation and timeouts](https://docs.python.org/3.12/library/asyncio-task.html)
