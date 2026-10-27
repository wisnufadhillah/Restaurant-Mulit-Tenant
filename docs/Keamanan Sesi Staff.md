# Keamanan Sesi Staff

## Status implementasi

Modul `apps/api/src/auth/crypto.ts` menyediakan hash/verifikasi password dan pembuatan/hash token sesi. Belum ada akun, tabel staff/session, endpoint login/logout, cookie, RBAC, atau CSRF. Tidak ada credential nyata dibuat atau diubah. Ini fondasi kriptografi, bukan fitur login yang siap digunakan.

## Password

Menggunakan scrypt async bawaan Node.js dengan N=131072, r=8, p=1, salt acak 16 byte dan hasil 64 byte. Parameter dicatat dalam format hash internal agar verifikasi tidak menebak algoritma. Memilih primitive bawaan menghindari dependency native tambahan; parameter mengikuti baseline scrypt OWASP. Tidak menggunakan enkripsi reversible atau SHA-256 untuk password.

Input dibatasi 12–1024 byte UTF-8; tidak di-trim atau dipotong diam-diam. Ini batas helper awal, bukan keputusan final seluruh kebijakan password UI. Karakter Unicode dihitung byte, bukan jumlah karakter tampilan. Hash berbeda untuk password sama karena salt berbeda. Verifikasi memakai timingSafeEqual pada buffer sepanjang sama.

Parser menerima hanya format dan parameter yang didukung. Parameter cost dari hash tak tepercaya tidak dijalankan sehingga hash rusak tidak dapat meminta alokasi memori arbitrer. Belum ada migrasi versi hash atau rehash otomatis.

Scrypt membutuhkan sekitar 128 MiB per derivasi dengan batas alokasi 160 MiB. Sebelum endpoint login dibuat, wajib pasang rate limit dan batas konkurensi serta ukur kapasitas mesin. Hash yang tidak valid ditolak cepat; penanganan user tidak ditemukan harus memakai dummy derivation yang sesuai saat service login diimplementasikan agar timing tidak mudah mengungkap keberadaan akun. Jangan menganggap helper ini sudah mencegah user enumeration.

## Token sesi

Token berasal dari randomBytes 32 byte, di-encode base64url. Nilai mentah hanya untuk klien melalui mekanisme cookie aman yang belum dibuat. Hash SHA-256 dipakai untuk penyimpanan token acak berentropi tinggi, bukan password manusia. Jangan mencatat token, hash password atau password dalam log.

Saat schema sesi dibuat, token wajib diikat ke staff dan tenant, memiliki expiry/revocation, serta dicek pada setiap akses. Cookie membutuhkan HttpOnly, Secure pada HTTPS, SameSite, dan pemeriksaan Origin/CSRF untuk mutasi. Logout harus mencabut sesi, bukan hanya menghapus cookie browser. Implementasi itu belum tersedia.

## Verifikasi

```sh
rtk proxy npx --yes pnpm@12.15.0 --filter @restaurant/api build
rtk proxy npx --yes pnpm@12.15.0 --filter @restaurant/api test
```

Test pertama ditulis sebelum implementasi dan gagal karena modul belum ada; sesudah implementasi lulus. Total enam unit test API lulus, tiga di antaranya menguji helper auth: salt/verifikasi, hash malformed/batas input, serta token/digest. Test memakai random input sementara, tanpa akun/password hardcoded atau output credential.

## Lanjut

Review kebijakan password dan kapasitas derivasi, kemudian tambahkan schema staff/sesi tenant-scoped, service login/logout dan tes negatif. Pembuatan akun atau password operasional memerlukan persetujuan terpisah dan mekanisme input privat. Endpoint auth belum ada dalam OpenAPI karena belum diimplementasikan.

## Sources

- [Node.js: Crypto](https://nodejs.org/docs/latest-v22.x/api/crypto.html)
- [OWASP: Password storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
