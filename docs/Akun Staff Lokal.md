# Akun Staff Lokal

UI login tersedia di http://127.0.0.1:3000/login. Backend harus berjalan pada 127.0.0.1:3001; frontend pada 127.0.0.1:3000. Gunakan host yang sama, bukan mencampur localhost dan 127.0.0.1. STAFF_ORIGIN harus sama pada proses web dan API bila origin diubah. Tidak ada password bawaan atau registrasi publik. Empat akun demo sudah diprovision lokal: demo.owner dan demo.staff pada masing-masing tenant demo-padang dan demo-keluarga. Password acak berbeda per akun disimpan hanya pada .local/demo-staff.json yang diabaikan Git; buka melalui editor privat, jangan cetak ke terminal/chat atau masukkan ke screenshot. Database hanya menyimpan hash password.

## Seed demo terkontrol

Seed lokal `apps/api/src/database/seed-demo.ts` menyiapkan profil Dapur Sela dan tenant pembanding Dapur Rantau, alamat sintetis, satu outlet per tenant, serta owner/staff. Tidak ada nomor kontak nyata, data customer atau reservasi. File credential dibuat dengan mode 0600; pada Windows periksa izin filesystem lokal karena mode POSIX bukan jaminan ACL. Jangan menjalankan mesin demo pada akun OS bersama yang tidak tepercaya.

Seed menolak ketika file credential atau akun demo sudah ada; tidak reset password maupun menimpa akun. Jika transaksi gagal sesudah file privat dibuat, periksa DB sebelum tindakan pemulihan; jangan menghapus file atau mengulang tanpa pemeriksaan. Menu, meja dan jadwal belum mempunyai schema sehingga belum di-seed.

## Membuat akun tambahan

Provisioner hanya menerima DB restaurant pada 127.0.0.1:55432 dengan role restaurant. Tenant harus sudah aktif. Akun yang sudah ada tidak diubah; duplicate ditolak. Tentukan role owner atau staff secara eksplisit. Password minimal 12 dan maksimal 1024 byte UTF-8.

Kompilasi dari root:

```sh
rtk proxy node node_modules/typescript/bin/tsc --project apps/api/tsconfig.json
```

Pada terminal Git Bash, prompt privat berikut tidak memasukkan password ke command/history. Jangan mengganti prompt dengan password literal. Jangan menjalankan shell dengan xtrace/set -x.

```sh
rtk proxy bash -c 'read -r -p "Kode tenant: " STAFF_TENANT_SLUG; read -r -p "Username: " STAFF_USERNAME; read -r -p "Role (owner/staff): " STAFF_ROLE; read -r -s -p "Password privat: " STAFF_PASSWORD; printf "\n"; export STAFF_TENANT_SLUG STAFF_USERNAME STAFF_ROLE STAFF_PASSWORD; node apps/api/dist/auth/provision-staff.js; result=$?; unset STAFF_PASSWORD; exit "$result"'
```

Tenant seed lokal: demo-padang dan demo-keluarga. Brand Dapur Sela memakai slug demo-padang; tenant pembanding Dapur Rantau memakai slug demo-keluarga. Slug tetap stabil walaupun nama tampilan diperbarui. Jangan menganggap mengganti nama UI mengganti identitas tenant DB.

Provisioning tidak mencetak password/hash/token. Simpan password secara privat di password manager; bukan chat, screenshot atau source. Jalankan hanya pada DB lokal yang diizinkan. Tidak ada reset password otomatis.

## Pengujian

Tes HTTP end-to-end membutuhkan API dan FE dev aktif pada port tetap. Membuat akun sintetis sementara pada dua tenant seed, kemudian menghapus hanya akun/sesi milik tes:

```sh
rtk proxy node --test apps/api/test/staff-web.integration.cjs
```

Tes ini bukan browser automation: cookie dikirim oleh HTTP client tes. Keyboard, password manager, dan alur browser nyata tetap perlu diperiksa manual. Limiter masih in-memory per proses; banyak login cepat dapat menghasilkan 429. Jangan melemahkan limiter untuk mengatasi itu.

## Sources

- [Next.js Cookies](https://nextjs.org/docs/app/api-reference/functions/cookies)
- [Next.js Authentication](https://nextjs.org/docs/app/guides/authentication)
