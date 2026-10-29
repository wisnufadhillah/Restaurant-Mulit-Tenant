# Rekonsiliasi Migrasi Lokal

## Kondisi yang didukung

Schema canonical memakai staff/username, staff_sessions.staff_id, menu_items tenant-scoped, dining_tables.name/is_active, dan weekly_hours. Jangan mencampur schema paralel staff_users/email, staff_user_id, table_number/status atau opening_hours.

Dua migration katalog/sesi tambahan sebelumnya mencoba membuat ulang tabel yang sudah dibuat migration sebelumnya. Pada DB lokal yang diperiksa, keduanya belum pernah dijalankan. SQL keduanya kini hanya memeriksa keberadaan schema canonical dan gagal jika bentuknya tidak sesuai. Enam migration awal tidak diubah; tidak memakai reset, resolve applied, atau menghapus baris data.

## Sebelum deploy pada mesin lain

Periksa riwayat migration dan schema terlebih dahulu. Jika salah satu dari dua migration tambahan pernah diterapkan menggunakan SQL versi lama, jangan gunakan riwayat yang telah diperbaiki ini tanpa review checksum dan rencana konversi DB tersebut. Keberhasilan pada satu DB lokal tidak membuktikan keamanan untuk semua instalasi.

## Command lokal

```sh
rtk proxy node apps/api/node_modules/prisma/build/index.js validate --config apps/api/prisma.config.ts
rtk proxy node apps/api/node_modules/prisma/build/index.js migrate status --config apps/api/prisma.config.ts
rtk proxy node apps/api/node_modules/prisma/build/index.js migrate deploy --config apps/api/prisma.config.ts
rtk proxy node apps/api/node_modules/prisma/build/index.js generate --config apps/api/prisma.config.ts
rtk proxy node node_modules/typescript/bin/tsc --project apps/api/tsconfig.json
```

Target yang telah diperiksa adalah restaurant pada 127.0.0.1:55432. Credential dibaca dari konfigurasi privat, tidak dari command literal. Dua migration pemeriksaan telah berhasil diterapkan pada DB lokal ini. Command deploy berikutnya harus melaporkan tidak ada migration pending.

## Batas aplikasi

Kontrak publik tetap memisahkan profil, menu, dan jadwal. Status meja aktif tidak menjamin slot reservasi tersedia. UI chat tidak boleh menampilkan verifikasi/booking/batal sukses dari state browser; jalur yang belum tersedia menampilkan keterbatasannya. Modul canonical tidak mendaftarkan controller login paralel, sehingga tidak ada dua handler untuk POST login.

Integrasi internal tools dan chat masih membutuhkan implementasi serta tes penerimaan terpisah. Perbaikan build/migration bukan bukti assistant terhubung ke inference live.
