# Backend reservasi web

Modul reservasi terdaftar pada AppModule. Route di bawah tersedia melalui aplikasi API utama setelah build dan restart. Schema client dapat dihasilkan secara lokal tanpa menerapkan migrasi.

Kontrak controller:

- POST `/api/v1/public/tenants/:slug/reservations/session` menerima objek kosong, membuat cookie pembuat terikat tenant atau memakai sesi valid yang sudah ada. Cookie HttpOnly, SameSite=Strict, Secure pada production, berlaku 32 hari. Sesi invalid tidak diganti diam-diam.
- POST `/api/v1/public/tenants/:slug/reservations/confirmations` menerima `date`, `time`, `partySize`, `guestName`, `guestPhone`. Respons privat berisi ringkasan, nonce dan expiry maksimal lima menit. Konfirmasi baru membatalkan konfirmasi lama yang belum dikonsumsi pada sesi sama. Tidak menahan meja.
- POST `/api/v1/public/tenants/:slug/reservations` menerima objek `reservation` berisi detail tersebut dan `nonce`, serta header `Idempotency-Key` 16–128 karakter alfanumerik, underscore atau tanda minus. Retry memakai key dan payload sama untuk memulihkan receipt lewat sesi pemilik.

POST `/api/v1/public/tenants/:slug/reservations/recovery` menerima objek kosong, cookie pembuat valid dan header Idempotency-Key asli. Operasi memakai advisory lock tenant yang sama dengan create. Jika booking milik pembuat sudah tersimpan, respons `data.outcome` adalah `reservation_exists`; UI melanjutkan penerbitan sesi manajemen dan membaca receipt. Jika belum ada, seluruh konfirmasi yang belum dikonsumsi pada sesi pembuat diinvalidasi dalam transaksi sebelum respons `not_created`. Ini mencakup ringkasan pada tab lain, bukan membatalkan booking tersimpan. Create tertunda dengan nonce lama ditolak; customer harus memeriksa ringkasan baru sebelum mencoba lagi. Key tidak dipensiunkan permanen untuk konfirmasi baru. Retry recovery dapat menginvalidasi ringkasan baru pada sesi sama; UI harus menjelaskan dampak tersebut. Respons gagal, termasuk lookup management 404, bukan bukti aman untuk membuat booking baru. Nonce dan kontak tidak dipersist ke browser storage.

Verifikasi dengan boundary transaksi tiruan dan browser stub tetap dibedakan dari pembuktian urutan lock PostgreSQL nyata. Hasil pengujian database recovery lokal dijelaskan di bawah.

Seluruh request memerlukan application/json dan Origin frontend yang diizinkan. Kebijakan Origin memakai STAFF_ORIGIN yang sudah digunakan frontend; pada pengembangan lokal default http://127.0.0.1:3000 dengan alias localhost. Semua respons no-store. Jangan mencatat cookie, nonce, kontak atau header privat. Jangan memasukkan detail privat ke chatbot.

Repository menggunakan transaksi ReadCommitted dan advisory transaction lock tenant sebelum pembacaan bisnis. Pembuatan menyimpan reservasi confirmed, event customer dan konsumsi konfirmasi dalam satu transaksi. Replay memeriksa pemilik dan hash sebelum validasi ulang waktu; payload berbeda ditolak. Receipt hanya mengandung referenceCode, interval, timezone, partySize dan status. Tidak mengandung credential manajemen. Timezone yang didukung calculator hanya Asia/Jakarta.

Writer API meja/jadwal kini mengambil lock tenant yang sama. Penonaktifan meja dan pengurangan kapasitas ditolak bila merusak booking confirmed yang belum berakhir. Perubahan jam reguler menghormati override hari khusus; perubahan/penghapusan hari khusus ditolak bila jadwal efektif tidak lagi mencakup seluruh kunjungan. Seed operasional tetap harus dijalankan hanya saat tidak ada traffic reservasi, bukan sebagai writer runtime.

Akses manajemen menggunakan tabel sesi terpisah, hash token acak, dan FK tenant/reservasi. Tidak memerlukan master secret tambahan. POST `management-session` dengan objek kosong dan header Idempotency-Key memerlukan cookie pembuat; hasil memasang cookie manajemen untuk tepat satu booking, maksimal 30 menit dan tidak melewati expiry akses booking. Sesi valid untuk booking target dipakai ulang. Cookie lama/tidak cocok tidak menjadi bukti akses; setelah creator sah diverifikasi, sesi target baru dapat diterbitkan tanpa mencabut sesi lain. Maksimal delapan sesi aktif per booking membatasi penerbitan akibat respons hilang.

POST `receipt` menerima objek kosong. POST `cancel` mewajibkan referenceCode receipt yang sedang ditampilkan, serta cookie manajemen; server menolak ketidakcocokan agar pergantian cookie lintas tab tidak membatalkan booking lain. ReferenceCode bukan credential. Keduanya memakai pemeriksaan Origin dan no-store yang sama. UI menyimpan Idempotency-Key nonkontak dalam sessionStorage untuk memperbarui sesi manajemen melalui creator cookie; handle dihapus saat logout. Cancel langsung adalah aksi konfirmasi web terstruktur; UI harus meminta tindakan eksplisit customer. Cutoff 120 menit berlaku; retry status cancelled tidak membuat event tambahan. POST `management-session/logout` mencabut sesi dan membersihkan cookie. Tidak ada token di URL atau body respons.

Hash token pada kolom lama reservations tidak digunakan untuk autentikasi sesi baru. Route reservasi sudah didaftarkan pada aplikasi utama; frontend demo memakai proxy same-origin dengan allowlist aksi dan tenant tetap demo-padang. Migrasi lokal telah diterapkan; tes HTTP dengan PostgreSQL mencakup 50 create paralel, retry, pemisahan tenant, pembatalan dan logout. Tes resilience tambahan memverifikasi rollback PostgreSQL saat penulisan event sengaja gagal pada boundary DB, serta socket HTTP terputus setelah repository menyelesaikan commit dan retry mengembalikan booking sama. Server fault test memanggil repository langsung, bukan pipeline Nest penuh. Tes tambahan memakai barrier sesudah SQL advisory lock untuk booking melawan pengurangan kapasitas serta perubahan jam melawan booking. Proposal dan creator session yang telah kedaluwarsa ditolak tanpa tambahan booking. Expiry tepat di tengah transaksi serta seluruh kombinasi race belum diuji. UI form, ringkasan, retry dan receipt terhubung; verifikasi browser mobile/keyboard dan seluruh fault UI belum lengkap.

ReservationService membatasi 60 request per token sesi dan 2.000 request global dalam window 60 detik. Pembuatan sesi tanpa cookie dibatasi 20 request per socket peer per window; pemakaian ulang cookie memakai jalur verifikasi terpisah, maksimal 120 pemeriksaan per window per proses dan empat pemeriksaan bersamaan. Pemeriksaan berjalan melalui repository yang memvalidasi tenant, expiry dan revocation; format cookie saja tidak memberi akses dan sesi invalid tidak diganti. Request hanya dihitung sekali pada kuota global/token. Slot verifikasi dilepas saat sukses maupun gagal; pergantian window tidak menghapus pemeriksaan yang masih berjalan. Budget verifikasi tetap agregat: token acak dapat menghabiskan budget tersebut, tetapi tidak memicu pembacaan DB tanpa batas. Kuota pembuatan sesi baru tetap bersama di balik satu proxy; pemisahan per-pengunjung memerlukan trusted ingress, bukan mempercayai header browser. Identitas disimpan sebagai digest HMAC, maksimal 4.096 entri, dibersihkan saat window berganti. Kapasitas penuh ditolak, bukan menghapus kuota aktif. Penolakan menghasilkan 429 dengan Retry-After dan envelope error statis. Limiter hanya satu instance/proses, reset saat restart, tidak menggantikan proteksi reverse proxy atau batas terdistribusi. Header X-Forwarded-For tidak dipercaya. Validasi controller yang menolak sebelum service tidak dihitung oleh limiter.

Tes `reservation-http.test.cjs` menjalankan controller dan service melalui HTTP dengan repository tiruan, mencakup Origin, cookie, payload ekstra, akses receipt dan sanitasi error. Tes `reservation-http.integration.cjs` disiapkan khusus PostgreSQL lokal 127.0.0.1:55432/restaurant dan menolak berjalan tanpa ALLOW_LOCAL_RESERVATION_WRITES=1. Flag tersebut hanya pengaman teknis, bukan pengganti persetujuan operator. Tes integrasi membuat dua tenant sintetis unik dan 50 sesi pembuat melalui fixture DB terkontrol, bukan melalui endpoint session agar tidak melanggar kuota peer. Konfirmasi dan 50 create paralel untuk satu meja tetap melalui HTTP dan service asli tanpa bypass limiter. Cleanup hanya memakai ID tenant yang dibuat invocation tersebut, tanpa reset atau penghapusan berdasarkan prefix. Jangan menjalankannya sebelum migrasi dan penulisan fixture disetujui.

## Verifikasi browser, proxy dan database

Suite `apps/api/test/reservation-browser.integration.cjs` dijalankan ulang dengan Chromium, Next.js development server terpisah, aplikasi NestJS asli dan PostgreSQL lokal `127.0.0.1:55432/restaurant`. Eksekusi terakhir lulus satu skenario, nol gagal, sekitar 20,9 detik, termasuk shutdown proses tes. Ini durasi pengujian, bukan benchmark layanan.

Alur yang diperiksa: membuat sesi browser valid; memenuhi kuota pembuatan sesi baru hingga 429; memakai sesi valid untuk ringkasan dan create; meneruskan create melalui proxy sampai respons upstream 200 lalu sengaja membuang respons browser; retry percobaan sama menghasilkan tepat satu booking dan event confirmed; sesi manajemen dibuat kedaluwarsa pada fixture; reload memulihkan receipt; pembatalan menghasilkan satu event cancelled; logout membuat akses receipt ditolak 403. Fixture tenant unik dan data turunannya dibersihkan di akhir.

Fault injection memakai barrier penyelesaian handler route. Kemunculan tombol retry tidak dipakai sebagai bukti request selesai, karena UI menandai hasil belum pasti sejak create dimulai. Kegagalan awal pengujian disebabkan assertion berjalan sebelum handler injection selesai dan teardown menutup konteks request; bukan bukti transaksi reservasi gagal. Error route dibatasi ke status/kategori statis agar cookie dan payload tidak tercetak. Pada Windows, shutdown memakai taskkill terhadap PID CLI beserta process tree milik tes; exit CLI ditunggu sebelum snapshot konfigurasi dipulihkan. Tahap cleanup browser, server, konfigurasi, API, fixture dan disconnect dicoba secara independen dengan deadline 10 detik per tahap; kegagalan dilaporkan dengan kategori statis. Deadline membatasi penantian, bukan membatalkan operasi underlying; proses atau koneksi yang gagal berhenti masih memerlukan pemeriksaan manual. Kegagalan spawn ditangkap listener sejak proses dibuat; cleanup tanpa PID tidak menjalankan taskkill. Jika shutdown server tidak terkonfirmasi, konfigurasi tidak ditimpa. Snapshot konfigurasi TypeScript yang dapat ditulis ulang Next.js development server dipulihkan sesudah proses tes dihentikan; jangan mengedit file konfigurasi tersebut bersamaan dengan tes.

```sh
rtk proxy pnpm --filter @restaurant/api build
rtk proxy node -e "process.env.ALLOW_LOCAL_RESERVATION_WRITES='1'; require('./apps/api/test/reservation-browser.integration.cjs')"
```

Eksekusi memerlukan persetujuan fixture lokal, port 3100 dan 3101 kosong, Chromium tersedia, serta tidak ada penulis lain pada konfigurasi web. Tidak ada reset DB, migrasi, atau deployment. Pengujian ini memakai desktop Chromium dan development server; bukan pembuktian mobile nyata, TLS production, semua gangguan jaringan, atau multi-instance. Tes browser stub tetap diperlukan untuk variasi UI deterministik.

Fault injection cleanup tanpa database tersedia pada `apps/api/test/reservation-browser-cleanup.test.cjs`: empat tes lulus. Tes mengeksekusi blok cleanup integrasi aktual di sandbox VM dengan browser/proses/filesystem/database tiruan dan deadline dipercepat. Assertion mencakup browser close menggantung, failed spawn tanpa PID, shutdown tidak terkonfirmasi, serta fixture yang belum dibuat. Ini membuktikan alur kontrol cleanup, bukan perilaku taskkill OS atau pembatalan operasi underlying. Ekstraksi blok bergantung struktur source dan sengaja gagal jika struktur penutup berubah.

```sh
rtk proxy node --test apps/api/test/reservation-browser-cleanup.test.cjs
```

## Verifikasi recovery dengan PostgreSQL lokal

Suite `apps/api/test/reservation-recovery.integration.cjs` telah dijalankan pada PostgreSQL lokal `127.0.0.1:55432/restaurant`: satu skenario integrasi lulus, nol gagal, durasi skenario eksekusi terakhir sekitar 621 ms. API dibangun ulang sebelum eksekusi sehingga tes memuat output kompilasi terbaru. Angka ini durasi pengujian, bukan benchmark latensi layanan.

Bukti yang diperiksa melalui assertion:

| Skenario | Hasil aktual |
| --- | --- |
| Create mendapat advisory lock lebih dahulu | Create berhasil; recovery mengembalikan `reservation_exists`; tepat satu booking dan satu event |
| Recovery mendapat lock lebih dahulu | `not_created` dikembalikan sesudah invalidasi; create tertunda dan replay nonce lama ditolak 409; tidak ada booking untuk key tersebut |
| Konfirmasi baru setelah settlement | Create dengan nonce dan key baru berhasil |
| Socket putus setelah recovery commit | Client gagal menerima respons; dua retry recovery paralel tetap `not_created`; nonce lama tidak dapat membuat booking |
| Booking milik creator lain | Recovery ditolak 403 |
| Konteks creator digunakan pada tenant lain | Recovery ditolak 403 |
| Draft creator lain dan tenant lain | Tidak ikut diinvalidasi |
| Konfirmasi yang sudah dikonsumsi | Sesudah seluruh recovery dan retry, timestamp consumed dan relasi booking tetap sama; invalidatedAt tetap null |
| Cleanup | Dua tenant fixture unik beserta data turunannya dihapus; assertion memastikan ID tenant fixture tidak tersisa |

Urutan konkurensi dikendalikan barrier tepat setelah perolehan SQL advisory lock, bukan sleep atau perkiraan waktu. Operasi repository tetap memakai transaksi PostgreSQL nyata. Gangguan respons memakai server HTTP lokal yang memanggil repository langsung, bukan pipeline controller NestJS atau proxy Next.js lengkap.

Command yang dijalankan dari root workspace:

```sh
rtk proxy pnpm --filter @restaurant/api build
rtk proxy node -e "process.env.ALLOW_LOCAL_RESERVATION_WRITES='1'; require('./apps/api/test/reservation-recovery.integration.cjs')"
```

Flag hanya pengaman teknis. Setiap eksekusi memerlukan persetujuan penulisan dan cleanup fixture pada target tersebut. Suite memvalidasi host, port dan nama database sebelum membuat koneksi aplikasi; credential dibaca melalui konfigurasi privat, tidak dicetak. Cleanup memakai ID tenant yang dibuat invocation itu sendiri, tanpa reset database, migrasi, penghapusan berdasarkan prefix, atau perubahan data tenant lain. Suite sengaja tidak dimasukkan ke command tes default agar penulisan database tidak berjalan diam-diam.

Batas bukti: pengujian lokal ini tidak membuktikan seluruh kombinasi konkurensi, pipeline HTTP penuh, deployment multi-instance, atau kesiapan produksi. Efek lintas tab tetap berlaku: recovery yang diulang dapat menginvalidasi konfirmasi baru pada sesi pembuat sama. Booking tersimpan tidak dibatalkan. Bukti UI terpisah tersedia melalui suite browser dengan API stub.

Tes repository memakai boundary DB tiruan dengan commit/rollback terkontrol. Tes tersebut tidak membuktikan constraint PostgreSQL, isolasi dua tenant atau konkurensi nyata. Verifikasi database harus mencakup replay setelah respons hilang, payload mismatch, penolakan sesi lain, rollback event/consume, expiry selama transaksi, race konfigurasi dan 50 request untuk satu meja.
