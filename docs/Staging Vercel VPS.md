# Staging Vercel dan VPS

## Status dan batas persiapan

Konfigurasi lokal untuk frontend Vercel dan backend satu VPS Ubuntu 24.04, RAM 2 GB, disk 40 GB. Tidak ada akses server, instalasi, image build/pull, startup container, perubahan DNS, provisioning credential/akun, migrasi, seed, commit, push, deploy atau pembayaran live dalam persiapan ini. Ini bukan bukti deployment siap pakai.

Hostname API yang diusulkan: `api.globaltenant.co.uk`. Kepemilikan domain, provider DNS, akses VPS, firewall, A/AAAA dan hostname frontend Vercel belum dikonfirmasi. `API_DOMAIN` wajib diisi hostname final tanpa protokol/path; tidak ada domain fallback. HTTPS Caddy membutuhkan DNS yang benar serta port 80/443 masuk. Jangan menerbitkan AAAA bila IPv6 belum berfungsi.

Berkas `compose.staging.yaml` terpisah dari Compose lokal; nama project dan volume berbeda. Jangan menggabungkan kedua berkas dengan beberapa `-f`. Jangan mengubah database lokal untuk meniru staging.

## Mulai dari sini

Panduan ini untuk menyiapkan akses publik terbatas bagi mentor, memakai data sintetis dan pembayaran sandbox. Frontend menggunakan domain bawaan Vercel; backend, runtime AI dan PostgreSQL berada di VPS. Tidak perlu memindahkan database kerja lokal ke server.

| Komponen | Target |
| --- | --- |
| Sistem VPS | Ubuntu 24.04, RAM 2 GB, storage 40 GB |
| Frontend | Project Next.js Vercel, Root Directory `apps/web` |
| Alamat frontend | URL `.vercel.app` stabil yang dipilih setelah project dibuat |
| API HTTPS | Usulan `api.globaltenant.co.uk`; konfirmasi sebelum mengubah DNS |
| Domain cadangan | `tenantstudio.co.uk`, belum digunakan |
| DNS | Penyedia saat ini atau Cloudflare; keputusan belum dibuat |
| Database dan Agno | Jaringan internal container, tanpa port publik |
| Pembayaran | Midtrans sandbox saja |

### Checklist keputusan sebelum tindakan eksternal

- [ ] Perubahan konfigurasi sudah direview dan masuk commit/PR yang dipilih untuk staging.
- [ ] Hostname frontend Vercel stabil sudah diketahui; bukan URL preview yang berubah tiap commit.
- [ ] Penggunaan `api.globaltenant.co.uk` dan target IP VPS dikonfirmasi operator.
- [ ] Penyedia DNS dipilih; record lama diperiksa sebelum mengubah nameserver.
- [ ] Akses SSH disiapkan lewat mekanisme privat; tidak ada password, token atau private key dikirim ke chat/repo.
- [ ] Persetujuan provisioning server, firewall, instalasi Docker, DNS, TLS dan deployment dicatat untuk target yang tepat.
- [ ] Prosedur bootstrap role DB dan akun dashboard staging sudah ditinjau. Jangan memakai kredensial lokal atau akun admin DB untuk API.
- [ ] Lokasi backup privat di luar VPS dan cara pemulihannya sudah dipilih.

### Urutan pelaksanaan

1. **Selesaikan perubahan lokal.** Review diff, jalankan pemeriksaan yang aman, commit dan buat PR. Pembuatan PR tidak berarti server boleh otomatis diperbarui.
2. **Tetapkan identitas frontend.** Buat/link project Vercel setelah mendapat izin. Catat URL stabil, atur Node 22.x dan cakupan source monorepo. Deployment frontend awal tidak dianggap berhasil penuh bila backend belum tersedia.
3. **Siapkan VPS.** Setelah persetujuan akses dan target: periksa identitas server, pasang pembaruan/Docker, atur SSH dan firewall. Jangan memutus sesi SSH sebelum aturan akses baru diverifikasi. Belum ada command provisioning otomatis dalam panduan ini.
4. **Siapkan image dan konfigurasi privat.** Build image untuk arsitektur VPS pada mesin build yang disetujui; uji native dependencies dan catat digest. Provision file secret serta izin baca per service tanpa mencetak isinya.
5. **Siapkan DB staging baru.** Jalankan database pada volume staging, migrasikan secara eksplisit, lalu bootstrap role runtime terbatas serta data sintetis. Uji hak akses sebelum API dibuka.
6. **Jalankan backend dan periksa internal.** Uji storage foto persisten, schema, auth dan komunikasi Agno. Jangan menganggap health hijau sebagai bukti seluruh dependensi siap.
7. **Atur DNS dan HTTPS.** Setelah backend siap, arahkan record A `api` ke VPS. Caddy memperoleh TLS bila DNS dan port 80/443 benar. Cloudflare tidak wajib; bila dipilih, mulai dengan DNS only untuk diagnosis awal. Jangan ubah record email atau domain kedua tanpa kebutuhan.
8. **Hubungkan frontend.** Isi `API_ORIGIN` dan `STAFF_ORIGIN` yang cocok pada konfigurasi Vercel/API. Lakukan redeploy yang disetujui, kemudian uji dari browser publik.
9. **Buka akses mentor.** Bagikan URL website dan akun staging secara privat. Pantau error, RAM, disk serta kuota provider; simpan daftar keterbatasan yang masih ada.

Jika suatu langkah gagal, hentikan langkah berikutnya dan periksa target/log tersanitasi. Jangan mencoba memperbaiki dengan reset DB, menghapus volume, membuka semua port atau menonaktifkan pemeriksaan Origin.

### Checklist penerimaan publik

- [ ] Website dan API menggunakan HTTPS dengan sertifikat valid.
- [ ] Port database, API langsung, Agno dan tool internal tidak terbuka publik.
- [ ] Login/logout owner dan staff berfungsi; sesi/role tidak bisa ditukar lintas tenant.
- [ ] Request tanpa sesi dan Origin asing ditolak, bukan diarahkan ke tenant default.
- [ ] Menu, foto upload dan profil terbaca; foto tetap ada setelah restart container yang disetujui.
- [ ] Reservasi buat/lihat/batal serta aksi staff dan audit berfungsi dengan data sintetis.
- [ ] Chat membaca data yang benar; ketika model gagal, form reservasi tetap bisa dipakai.
- [ ] Upload pada batas 4.000.000 byte dan penolakan di atas batas diuji melalui Vercel, bukan hanya lokal.
- [ ] Bila checkout diaktifkan, hanya sandbox; status lunas bergantung pada notifikasi server terverifikasi, bukan callback browser.
- [ ] Backup DB dan file foto tersedia, serta restore diuji pada target terpisah yang disetujui.
- [ ] Tidak ada secret, token, kontak nyata atau dump privat pada repo, halaman publik maupun log yang dibagikan.

## Hasil pemeriksaan kode

| Area | Temuan dan keputusan |
| --- | --- |
| API/Agno | `ConversationTransport` hanya menerima HTTP loopback. Runner Python memakai API loopback. Assistant memakai `network_mode: service:api`, bind `127.0.0.1:8010`; API memakai `0.0.0.0:3001` di bridge privat tanpa published port. Tidak ada pelonggaran origin internal. |
| Jaringan | Hanya Caddy menerbitkan 80/443. Database tidak menerbitkan port. Bridge tidak memakai `internal: true`, sehingga egress OpenRouter dan Midtrans sandbox tetap mungkin. |
| Edge | Caddy memakai allowlist path berjangkar untuk health, katalog publik, reservasi, staff tenant-scoped dan chat/order sandbox. `/internal`, `/docs`, `/openapi.json`, gateway `/turn`, schema/dev dan path lain mendapat 404. Legacy staff catalogue route tidak terdaftar dalam modul aktif dan tidak diekspos. Method, auth, tenant, Origin dan validasi tetap tanggung jawab API. |
| Build API | Node 22, pnpm 12.15.0, lockfile frozen. Layer Debian memasang OpenSSL dan CA certificates untuk Prisma CLI/runtime; ini hanya konfigurasi, belum dijalankan. `prisma generate` memakai URL sintetis port 1, bukan koneksi database sungguhan. Runtime nonroot `node` (UID/GID 1000). CLI Prisma tetap tersedia untuk migration service terpisah. |
| Build Python | Python 3.12, uv 0.13.8, `agno-v2/uv.lock` frozen. Lock aktif memuat Agno 3.1.12; lock `apps/assistant` memakai 3.1.10 dan tidak dipakai image ini. Source `apps/assistant` tetap disalin karena `app/runtime.py` mengimpor core dari sana. Runtime UID/GID 10001. |
| Storage | `apps/api/dist/menu` naik empat direktori ke root workspace; root upload tepat `/app/.local/menu-images`, bukan `/app/apps/.local`. Named volume menyimpan file; DB menyimpan referensi tenant. |
| Secret | Mount `/run/secrets` per service, bukan raw value dalam Compose/env template. PostgreSQL memakai `POSTGRES_PASSWORD_FILE`; wrapper Node/Python menerjemahkan file service ke environment proses. Password PostgreSQL di-URL-encode sebelum membuat `DATABASE_URL`. API memakai role `restaurant_runtime` dan secret `database_runtime_password`, bukan role administrator. Administrator `restaurant` dan secret `postgres_password` hanya untuk DB/migration service. Python tidak mendapat password/URL DB maupun context signing secret. |
| Auth web | BFF Next tetap memegang cookie server-side. Production cookie `Secure`, `HttpOnly`, `SameSite=Strict` tetap. `STAFF_ORIGIN` harus origin frontend stabil yang sama persis di Vercel/API; API CORS memakai origin itu saja. Preview hostname lain sengaja ditolak. |
| Upload | Browser/BFF/API membatasi byte mentah 4.000.000 (4 MB), bukan base64/multipart. Batas request/response Vercel Function 4,5 MB membuat batas lama 5 MiB tidak sesuai. API tetap mendekode raster, membatasi piksel dan output WebP 1 MiB; BFF bukan pemeriksa isi raster. |
| Resource | Limit RAM service utama: DB 384 MiB, API 384 MiB, assistant 512 MiB, Caddy 128 MiB. Sisakan RAM OS/Docker/cache. Ini pagar awal, bukan janji kapasitas. Migration service sementara 256 MiB; hindari build di VPS 2 GB, utamakan image teruji dari mesin build yang nanti disetujui. |
| Koneksi DB | `createDatabaseClient()` membatasi pool `max: 5` **per client**, bukan total API. Banyak service/repository membuat client sendiri; total potensial jauh di atas lima. PostgreSQL awal `max_connections=80`, bukan bukti aman terhadap peak. Ukur koneksi/RAM di staging sebelum trafik nyata; pooling ulang di luar scope. |
| Health/log | Health API/Agno hanya liveness, tanpa DB/model/provider call. Tidak membuktikan migrasi, tenant, credential atau inference siap. Docker log berotasi 3 × 10 MB per service; Caddy access log tidak diaktifkan, uvicorn access log dimatikan. Jangan menyalakan debug yang membocorkan request/token. |

Base image Node 22, Python 3.12, Caddy 2 serta tag pgvector/uv tetap dapat berubah; bukan digest immutable. Catat digest hasil build/pull yang disetujui kemudian, uji sebelum promosi, simpan image release sebelumnya. Dependency aplikasi tetap mengikuti lockfile.

## Vercel frontend

Setelah persetujuan tindakan pada project Vercel:

1. Pilih Root Directory `apps/web`, framework Next.js, Node.js **22.x**. Workspace membutuhkan `>=22.22.0 <23`, pnpm **12.15.0**. Gunakan install frozen sesuai package manager workspace, build `next build` dari root project web. Jangan mengandalkan default Node provider yang dapat berubah.
2. Pastikan sumber di luar root project disertakan pada pengaturan Vercel yang tersedia. `apps/web` mengimpor registry murni `apps/api/src/menu/menu-images.ts`; bukan aplikasi API/Prisma yang harus dijalankan di Vercel. `outputFileTracingRoot` menunjuk root repo, dua tingkat di atas web. Periksa build Vercel sungguhan sebelum menyatakan bundle lengkap.
3. Isi server-side `API_ORIGIN=https://<API_DOMAIN-final>` dan `STAFF_ORIGIN` dengan hostname frontend stabil `https://<project>.vercel.app`, tanpa trailing slash. Jangan memakai prefix `NEXT_PUBLIC_` atau wildcard preview. Tidak ada token backend/DB/model yang perlu dikirim ke browser atau Vercel.
4. Setelah hostname stabil diketahui, samakan `STAFF_ORIGIN` pada Compose; `API_ALLOWED_ORIGINS` diturunkan dari nilai yang sama. Rebuild/redeploy yang disetujui diperlukan setelah mengubah konfigurasi provider. URL preview tidak otomatis dipercaya.
5. Verifikasi login/logout, tenant/session, CSRF Origin negatif, upload batas, public image, reservasi dan chat melalui BFF, bukan pemindahan cookie auth langsung ke cross-site API. Midtrans tetap sandbox; callback bukan bukti pembayaran.

## Konfigurasi privat dan izin file

Template nonsecret: `infra/staging/staging.env.example`. Operator kemudian membuat `.local/staging/compose.env` secara privat; berkas itu diabaikan Git. Jangan menyalin secret ke env template. File secret yang diperlukan:

- `.local/staging/postgres_password` (administrator, hanya DB/migrasi)
- `.local/staging/database_runtime_password` (role API terpisah)
- `.local/staging/assistant_gateway_token` (minimal 32 karakter)
- `.local/staging/internal_tool_service_token` (minimal 32 karakter)
- `.local/staging/internal_context_secret` (minimal 32 karakter)
- `.local/staging/midtrans_server_key` (**sandbox**)
- `.local/staging/openrouter_api_key`

Tidak ada nilai, credential demo atau generator secret di konfigurasi ini. Provisioning/rotasi membutuhkan persetujuan terpisah. Isi satu baris UTF-8; wrapper menerima newline terakhir tetapi menolak newline internal/NUL. Jangan pakai shell tracing atau mencetak isi file/environment/container inspect.

Compose file secrets pada host Linux adalah file mount, bukan secret manager terenkripsi. `uid/gid/mode` Compose tidak boleh diandalkan untuk memperbaiki izin bind file. Direktori host harus privat; pastikan UID 1000 dapat membaca secret API, UID 10001 dapat membaca secret assistant, PostgreSQL dapat membaca file password. ACL host per UID atau grup khusus dengan akses terbatas dapat dipakai; verifikasi tanpa mencetak isi. Jangan membuat world-readable atau `chmod 777`; jangan mengubah credential file milik lingkungan lain.

Image API membuat direktori upload UID/GID 1000 mode 0700. Volume kosong Docker normalnya menyalin metadata direktori image; verifikasi UID/GID volume sebelum startup. Volume yang sudah ada/di-restore mungkin berbeda: perbaikan ownership hanya pada root volume upload yang dikonfirmasi, setelah persetujuan, bukan chmod rekursif sistem. File WebP ditulis mode 0600. Jangan menjalankan API sebagai root untuk melewati masalah izin.

## Pemeriksaan lokal tanpa startup

Command berikut tidak membangun/menarik image atau menjalankan container. Semua nilai konfigurasi harus disiapkan secara privat; jangan mencetak hasil Compose yang telah di-resolve.

```sh
rtk proxy docker compose --env-file .local/staging/compose.env -f compose.staging.yaml config --quiet
rtk proxy node --check infra/staging/api-entrypoint.cjs
rtk proxy node --test infra/staging/staging.test.cjs apps/web/test/menu-upload.test.cjs
rtk proxy node --test apps/api/test/menu-upload.test.cjs apps/api/test/menu-http.test.cjs
rtk proxy git diff --check
```

Tes API memerlukan hasil build lebih dahulu. Verifikasi lokal yang sudah dilakukan: Node wrapper syntax, Python AST, Compose `config --quiet` memakai env sintetis, API Prisma generation/TypeScript build dengan URL sintetis, Next production build dengan origin sintetis dan telemetry mati, empat tes API upload/HTTP, dua tes BFF byte boundary, sembilan tes gateway Agno memakai transport mock. Tidak ada model/provider call dalam tes ini. Loader aplikasi existing tetap dapat membaca `.env` lokal ketika build; environment sintetis eksplisit mengalahkan DATABASE_URL/origin lokal, tidak ada nilai yang dicetak.

Validasi Caddy native, image build Linux/ownership native dependencies, startup bersama dan HTTPS publik belum dijalankan. Tes regex Node hanya memeriksa allowlist, bukan parser/runtime Caddy. Jalankan validasi Caddy melalui executable/image yang telah disetujui dan tersedia, tanpa menerbitkan port, sebelum startup sungguhan. Pengujian browser/DB integration tidak dijalankan sebagai bagian persiapan ini.

## Gerbang sebelum eksekusi server

**Semua langkah berikut mengubah server, database, DNS atau provider dan belum diizinkan oleh persiapan lokal. Dapatkan persetujuan terpisah untuk target dan tindakan yang spesifik sebelum menjalankannya.**

1. Konfirmasi identitas VPS kosong, akses operator, update Ubuntu/Docker Compose, firewall/SSH dan DNS. Publikasikan hanya 80/443; jangan buka 3001/8010/5432. Tinjau egress provider dan perlindungan host.
2. Provision secret privat dan hostname frontend final. Pilih model OpenRouter `:free` yang tersedia, allowlist eksplisit dan smoke test terbatas setelah disetujui; import dependency bukan bukti dukungan model/tools/kuota.
3. Build image di lingkungan sesuai RAM/arsitektur target yang disetujui, simpan label release serta digest. `pnpm install --frozen-lockfile` dan `uv sync --frozen` membutuhkan akses dependency saat image build; persiapan lokal tidak menjalankannya. Jangan menjalankan compose default lokal di server.
4. Validasi Compose/Caddy, izin secret/volume, backup awal. Jalankan DB saja untuk target staging yang sudah dikonfirmasi, kemudian migration service **secara eksplisit**. Tidak ada `migrate`/seed otomatis dalam startup API.
5. Migration command setelah persetujuan DB adalah:

   ```sh
   rtk proxy docker compose --env-file .local/staging/compose.env -f compose.staging.yaml --profile tools run --rm migrate
   ```

   Ini menulis schema database. Jangan jalankan untuk pemeriksaan syntax. Service berada pada profile `tools`, tidak ikut startup default. Command tidak menjalankan seed atau membuat akun.
6. Bootstrap tenant, outlet, akun owner/staff dan katalog membutuhkan prosedur staging terpisah yang ditinjau dan disetujui. Script `provision-staff`, `seed-demo`, `seed-menu` existing membatasi target lokal `127.0.0.1:55432`; jangan menghapus guard atau diam-diam memakainya untuk `database:5432`. Tidak ada akun default yang dapat dipakai setelah migration saja. Kode chat/reservasi saat ini mengikat slug `demo-padang`; bootstrap harus memperhitungkan batas ini tanpa tenant nyata.
7. Setelah schema/bootstrap disetujui dan tersedia, start layanan staging dan uji auth/tenant/Origin negatif, file persistence/restart, reservasi, chat, sandbox notification signature/nominal/retry. Health hijau saja tidak cukup.

API dan assistant berbagi network namespace. Bila API container dibuat ulang, buat ulang assistant juga; jangan menganggap restart assistant lama cukup. Rencanakan downtime singkat dan recreating keduanya bersama saat rollout/rollback. Caddy tetap mengarah hostname service API.

## Pemisahan role database sebelum startup API

Role `POSTGRES_USER=restaurant` yang dibuat image adalah bootstrap superuser. Jangan memakai role atau password ini untuk request aplikasi. Konfigurasi API hanya menerima secret runtime dan selalu membangun URL dengan username `restaurant_runtime`; migration service tetap memakai administrator.

Provisioning role belum dilakukan. Sebelum API boleh dimulai, operator harus membuat role runtime melalui bootstrap terpisah yang ditinjau dan disetujui: `LOGIN`, `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOREPLICATION`, `NOBYPASSRLS`, bukan pemilik database/schema/tabel. Berikan `CONNECT` database, `USAGE` schema, dan hanya hak DML/sequence yang diperlukan aplikasi. Jangan berikan hak DDL atau akses ke tabel riwayat migrasi. Atur default privileges dari role pemilik migrasi agar tabel baru mendapat hak runtime yang sesuai tanpa menaikkan role API menjadi admin. Tinjau juga hak `CREATE` schema yang diwarisi dari PUBLIC; role runtime tidak boleh membuat objek lewat hak turunan.

Tes role harus membuktikan operasi aplikasi yang diperlukan berhasil, sedangkan pembuatan role/database, perubahan schema, dan penghapusan tabel ditolak. Wrapper hanya memilih identitas berbeda; ia tidak membuktikan role telah dibuat dengan hak yang benar. Startup staging publik tetap diblokir sampai provisioning dan pemeriksaan privilege selesai. Tidak ada SQL perubahan role/password yang dieksekusi dalam persiapan lokal ini.

## Keterbatasan keamanan operasional

- Rate limit beberapa jalur memakai socket address; di belakang Caddy/Vercel klien dapat berbagi bucket proxy. Jangan mempercayai `X-Forwarded-For` arbitrer atau menambahkan trust proxy luas sebagai jalan pintas. Evaluasi kebijakan proxy terverifikasi terpisah sebelum pilot publik.
- Satu API/assistant saja. Limiter in-memory, namespace bersama dan file upload lokal tidak siap horizontal scaling. Volume bersama tidak otomatis membuat rate limit lintas proses aman.
- Caddy path allowlist bukan otorisasi. Database tetap harus memiliki schema, akun dan scope tenant yang benar. Konektivitas internet tidak berarti semua provider diizinkan.
- RAM nominal limit bukan load test. Monitor RAM, swap/oom, koneksi PostgreSQL, disk, kuota provider dan latency. Batasi durasi/konkurensi pilot; simpan cukup ruang untuk DB, upload, log, image lama, backup dan data Caddy pada disk 40 GB.
- Password PostgreSQL file hanya menginisialisasi volume baru; mengganti file tidak mengubah password role pada volume lama. Rotasi perlu prosedur DB tersendiri yang disetujui.

## Backup dan rollback

Volume bernama project `restaurant-staging`: `postgres_data`, `menu_images`, `caddy_data`, `caddy_config`. Jangan memakai `down -v`, reset DB, truncate atau menghapus volume saat rollout/rollback. Backup berada di storage privat terpisah dari VPS dan diuji restore pada target nonproduksi yang disetujui.

Sebelum migration/release: hentikan sementara perubahan bisnis/upload dengan prosedur operator yang disetujui, ambil logical backup PostgreSQL dan salinan volume `menu_images` pada titik konsisten, simpan bersama schema/release label/checksum. DB saja tidak memulihkan foto; foto saja tidak memulihkan ownership/reference. Backup secret dan data TLS Caddy terpisah dengan enkripsi dan akses terbatas. Jangan mencetak credential lewat argumen backup atau menyalin file ke repo/chat.

Rollback aplikasi memakai image label/digest sebelumnya dengan volume tetap, dan recreate API **serta** assistant bersama. Pastikan schema baru kompatibel dengan image lama; migration deploy tidak menyediakan rollback schema otomatis. Jika schema tidak kompatibel, hentikan dan minta persetujuan restore DB **beserta** snapshot upload yang cocok pada target yang dikonfirmasi. Restore dapat menghilangkan perubahan setelah snapshot; jangan menjalankannya otomatis. Uji health, auth dan baca foto setelah rollback, bukan health saja.

## Sources

- [Vercel Function limits: payload 4.5 MB](https://vercel.com/docs/functions/limitations)
- [Vercel Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)
- [Vercel monorepos](https://vercel.com/docs/monorepos)
- [Next.js output file tracing](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)
- [Docker Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/)
- [PostgreSQL 17 bootstrap superuser](https://www.postgresql.org/docs/17/app-initdb.html)
- [Entrypoint image PostgreSQL](https://github.com/docker-library/postgres/blob/master/docker-entrypoint.sh)
- [Prisma 7 Docker deployment dan OpenSSL](https://www.prisma.io/docs/guides/v7/deployment/docker)
- [uv Docker integration](https://docs.astral.sh/uv/guides/integration/docker/)
- [Caddy reverse proxy quick start](https://caddyserver.com/docs/quick-starts/reverse-proxy)
- [Caddy environment interpolation](https://caddyserver.com/docs/caddyfile/concepts)
- [Caddy request matchers](https://caddyserver.com/docs/caddyfile/matchers)
