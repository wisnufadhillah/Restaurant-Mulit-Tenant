# Alur Profil Restoran

Dashboard /dashboard?tab=profile menampilkan nama restoran, nama outlet, alamat dan kontak publik. Owner dapat mengubah; staff hanya membaca. Slug, tenant ID, role, timezone dan kebijakan reservasi tidak dapat diubah dari form ini.

Alur: form owner → PUT /staff/profile pada Next.js → validasi Origin/cookie → PUT /api/v1/staff/tenants/:slug/profile → verifikasi sesi/role → transaksi update tenant dan satu outlet aktif → respons sukses → muat ulang profil.

API GET pada route sama mengembalikan profil aman. Respons publik profil yang sudah tersedia membaca nilai DB terbaru. Tidak ada data privat customer, token atau hash password pada respons profil. Tenant ditetapkan dari sesi; field tambahan pada body ditolak. Nol/lebih dari satu outlet aktif menghasilkan 409; tidak memilih outlet default.

Nama restoran/outlet wajib 1–120 karakter, alamat 1–500 karakter, kontak opsional maksimal 40 karakter dengan digit, +, spasi, tanda kurung dan strip. Kontak hanya untuk nomor publik restoran, bukan kontak customer. Update nama dan outlet dalam satu transaksi; kegagalan tidak boleh meninggalkan update parsial.

```sh
rtk proxy node --test apps/api/test/profile.test.cjs apps/api/test/profile.integration.cjs
```

Tes mencakup field tenant injeksi, input invalid, owner berhasil, staff ditolak, Origin asing, sesi tenant lain, hasil profil publik terbaru, dan tenant pembanding tidak berubah. Tes browser/proxy profil belum dilakukan. Landing page membaca profil publik tanpa cache untuk nama pada navigasi/footer/profil dan alamat/kontak. Jika API gagal atau outlet aktif bukan tepat satu, tampilkan profil unavailable tanpa fallback alamat palsu. Sketsa peta statis dihapus agar perubahan alamat tidak meninggalkan peta yang salah. Metadata SEO, brand login/dashboard dan label dialog masih identitas desain statis; belum menjadi pengaturan brand dinamis seluruh aplikasi.
