# Keamanan Sesi Staff

## Implementasi dan batas

API menyediakan login, pembacaan sesi tenant-scoped, dan logout. Akun serta sesi disimpan di PostgreSQL; browser hanya menerima token acak melalui cookie. Migration akun/sesi telah diterapkan dan diuji pada database lokal loopback. Provisioning akun operasional belum dijalankan dan memerlukan mekanisme input privat. Tidak ada endpoint registrasi atau akun/password bawaan. UI /login terhubung melalui route server same-origin. Dashboard memeriksa sesi ke API saat render; belum ada CRUD data operasional.

## Password dan pembatasan login

Scrypt async bawaan Node.js memakai N=131072, r=8, p=1, salt acak 16 byte dan hasil 64 byte. Password dibatasi 12–1024 byte UTF-8 tanpa trim. Verifikasi menggunakan timingSafeEqual. Akun tidak ditemukan menjalankan dummy derivation; hash malformed juga menjalankan dummy derivation sebelum ditolak. Error autentikasi tidak mengungkap apakah akun/tenant tersedia.

Satu proses hanya menjalankan satu alur derivasi login sekaligus untuk membatasi memori. Maksimal lima upaya per kombinasi tenant/username dan 20 per alamat koneksi dalam 15 menit, termasuk login berhasil. Identitas limiter account memakai HMAC dengan key sementara proses, bukan username mentah. Map dibatasi 10.000 key; penuh ditolak, entry kedaluwarsa dibersihkan. Key limiter tidak dicatat. Header forwarded client tidak dipercaya.

Pembatasan masih in-memory per proses: restart menghapus counter; belum cocok untuk banyak instance. Sebelum deployment, sediakan limiter bersama dan konfigurasi reverse proxy yang ditinjau. Ini bukan jaminan tahan denial of service.

## Sesi dan tenant

Token randomBytes 32 byte/base64url hanya keluar melalui Set-Cookie, tidak melalui JSON. DB menyimpan hash SHA-256 token acak, expiry delapan jam, dan revocation. FK komposit tenant/staff mencegah sesi menunjuk staff tenant lain. Setiap pemeriksaan membaca ulang status akun, role dan tenant; role browser tidak dipercaya. Slug pada route harus cocok dengan tenant sesi. Tidak ada tenant default.

Cookie `restaurant_staff`: HttpOnly, SameSite=Strict, Path=/api/v1/staff, tanpa Domain, Max-Age delapan jam. Secure wajib saat NODE_ENV=production. HTTP lokal hanya untuk development loopback. Cookie duplicate atau malformed ditolak. Respons auth memakai Cache-Control: no-store. Logout mencabut sesi sebelum menghapus cookie; token lama ditolak.

## Origin dan integrasi browser

Tetapkan STAFF_ORIGIN ke origin web terpercaya, tanpa trailing slash/path. Development default http://127.0.0.1:3000; production wajib konfigurasi origin HTTPS. Origin kosong, null, salah, atau Sec-Fetch-Site cross-site ditolak pada login/logout. Login menerima application/json saja. Jangan membentuk allowlist dari Host atau header browser. Pemeriksaan exact Origin dan SameSite adalah proteksi mutasi saat ini; bukan izin bagi endpoint baru untuk melewati pemeriksaan serupa.

Route Next.js /staff/login dan /staff/logout memvalidasi exact Origin sebelum meneruskan request ke API loopback tetap, tanpa mempercayai header Host/forwarded atau target URL browser. Cookie web senja_staff dan senja_staff_tenant memakai HttpOnly/SameSite=Strict/Path=/, Secure pada production; token tidak masuk JSON/localStorage/URL. Tenant cookie tidak memberi izin: API mencocokkannya dengan tenant sesi DB. Logout gagal karena API unavailable tidak mengaku sukses. Respons sesi tidak di-cache. Limiter alamat API melihat koneksi proxy loopback sehingga kuota alamat dibagi klien web; belum cocok untuk deployment banyak pengguna.

## Endpoint

- POST /api/v1/staff/login: body tenantSlug, username, password; field tambahan ditolak; identitas aman pada JSON.
- GET /api/v1/staff/tenants/:slug/session: cookie valid dan tenant cocok; return id, tenantId, username, role.
- POST /api/v1/staff/tenants/:slug/logout: Origin dan sesi valid; 204 setelah revocation.

Endpoint operasional baru wajib memanggil pemeriksaan sesi dan role sebelum query/mutasi. Belum ada endpoint CRUD operasional yang dilindungi; helper role bukan bukti seluruh produk sudah memakai RBAC.

## Verifikasi

Tes HTTP memakai repository sintetis tanpa DB, cookie melalui HTTP loopback, password acak sementara dan tanpa output credential. Mencakup login valid/invalid, Origin salah/hilang, field role injeksi, tenant lain, sesi hilang/invalid/expired/revoked, akun/tenant nonaktif, role owner/staff, cookie flags, dan rate limit. Integration PostgreSQL lokal membuktikan persistence hash token, revocation dan penolakan FK lintas tenant dalam transaksi sintetis yang di-rollback. Tes HTTP memakai repository sintetis; Tes HTTP web hingga PostgreSQL nyata juga lulus untuk owner/staff dua tenant, login, dashboard redirect, manipulasi tenant cookie, Origin dan logout. Akun sintetis tes dihapus beserta sesi miliknya setelah tes; provisioning akun operasional tetap dijalankan pengguna secara privat.

## Sources

- [Node.js Crypto](https://nodejs.org/docs/latest-v22.x/api/crypto.html)
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [NestJS Controllers](https://docs.nestjs.com/controllers)
