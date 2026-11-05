# Perhitungan availability meja

`apps/api/src/restaurant/availability.ts` menyediakan perhitungan murni untuk satu snapshot outlet. API publik `GET /api/v1/public/tenants/:slug/availability` memakai modul ini melalui repository snapshot database dan service. Internal tools, form dan agent belum memakai availability. Tes fixture bukan bukti availability database live.

## Input dan batas

`reservationWindow` menerima tepat `date` (`YYYY-MM-DD`), `time` (`HH:MM`) dan `partySize` integer. Waktu lokal ditafsirkan sebagai Asia/Jakarta, bukan zona waktu mesin atau browser. Tanggal mustahil, field tambahan, angka berbentuk string dan input tidak lengkap ditolak.

Kebijakan yang saat ini didukung: durasi 90 menit, notice minimal 60 menit, advance maksimal 30 × 24 jam dari jam server, tamu 1–12 dan cutoff pembatalan 120 menit. Batas notice dan advance inklusif. Kebijakan lain ditolak, bukan diam-diam dihitung dengan asumsi berbeda. Jika konfigurasi outlet perlu diperluas, validasi dan pengujian harus diperbarui bersama.

`customerCancellationAllowed` memeriksa batas waktu pembatalan customer secara inklusif. Fungsi ini bukan otorisasi pembatalan; token/sesi, tenant, status reservasi, transaksi dan audit tetap harus diperiksa service bisnis.

## Snapshot dan pemilihan meja

`calculateAvailability` menerima jam server eksplisit serta snapshot yang wajib berisi:

- kebijakan outlet;
- jadwal mingguan;
- pengecualian tanggal khusus;
- konfigurasi meja;
- interval reservasi beserta statusnya.

Pemanggil terpercaya harus mengambil seluruh data untuk tenant dan outlet yang sama. Modul ini tidak meresolusikan slug, membaca database atau memverifikasi izin. Jangan meneruskan snapshot dari browser/model atau memakai daftar reservasi kosong sebagai pengganti pembacaan yang gagal. Snapshot harus mencakup semua reservasi confirmed yang berpotensi beririsan; data tidak lengkap tidak menghasilkan jawaban yang dapat dipercaya.

Pengecualian tanggal mengalahkan jadwal mingguan, termasuk penutupan khusus. Jadwal tidak tercatat menghasilkan `hours_unconfigured`; jadwal tercatat tutup menghasilkan `closed`. Seluruh kunjungan harus masuk satu interval operasional. Akhir kunjungan boleh tepat pukul 24:00, tetapi tidak melewatinya.

Meja aktif berkapasitas cukup dipilih dari kapasitas terkecil, lalu ID secara deterministik. Hanya status confirmed menghalangi alokasi. Irisan memakai interval setengah terbuka `[start,end)`: booking yang berakhir tepat saat kunjungan baru dimulai tidak bertabrakan.

Hasil memuat waktu UTC absolut, zona waktu dan `held=false`. Hasil positif memuat ID meja dan kapasitas; hasil negatif membedakan jadwal belum tercatat, tutup, di luar jam, dan tidak ada meja yang cocok.

## Integrasi database dan API

`AvailabilityRepository` meresolusikan tenant aktif dan tepat satu outlet aktif. Jadwal, meja aktif dan reservasi confirmed yang beririsan dibaca dengan scope tenant/outlet di dalam transaksi RepeatableRead, tanpa pemangkasan daftar kandidat atau interval. Query reservasi hanya memilih meja, interval dan status; kontak customer serta credential tidak dibaca. Kegagalan pembacaan tidak diganti snapshot kosong.

Endpoint menerima tepat `date`, `time`, `partySize` sekali masing-masing. Service memakai jam server, menolak field asing dan merender hasil publik tanpa ID meja atau kapasitas internal. Hasil memuat `source=restaurant_api`, `retrieved_at` dan `held=false`; header respons `Cache-Control: no-store`.

Schema penyimpanan reservasi dan constraint overlap tersedia terpisah. Endpoint ini tidak membuat booking, hold, konfirmasi, akses privat, maupun replay idempotency. Hasil positif bukan jaminan booking. Create nanti harus membaca ulang data dan memvalidasi dalam transaksi, dengan constraint database sebagai pertahanan terakhir terhadap request paralel.

## Pemeriksaan

Tes `apps/api/test/availability.test.cjs` menguji tanggal strict, tahun kabisat, konversi tengah malam WIB, notice/advance, kapasitas, hari khusus, akhir hari, cutoff, interval bersebelahan dan overlap. Tes HTTP menggunakan repository fixture untuk query invalid/berulang, output publik dan kegagalan dependency; tes repository memeriksa bentuk query melalui pengganti boundary database. Fixture tidak membuktikan isolasi PostgreSQL nyata dan tidak memanggil model AI.

```sh
rtk proxy node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json
rtk proxy node --test apps/api/test/availability.test.cjs apps/api/test/availability-http.test.cjs apps/api/test/availability-repository.test.cjs apps/api/test/hours.test.cjs apps/api/test/table.test.cjs
```

Pemeriksaan HTTP dengan PostgreSQL lokal yang sudah memiliki schema reservasi dan dua katalog seed tersedia tanpa menulis fixture:

```sh
rtk proxy node --test apps/api/test/availability-readonly.integration.cjs
```

Tes read-only memeriksa respons dua katalog yang ada, waktu absolut, bentuk output publik dan tenant tidak ditemukan. Ini belum membuktikan isolasi menggunakan booking/jadwal pembeda yang sengaja dibuat atau race dengan perubahan konfigurasi. Tes tersebut memerlukan fixture dan otorisasi penulisan tersendiri.

## Sources

- [MDN: Date.parse](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse) — format tanggal nonstandar dan normalisasi tanggal memerlukan validasi eksplisit; waktu tanpa offset dapat mengikuti zona waktu mesin.
