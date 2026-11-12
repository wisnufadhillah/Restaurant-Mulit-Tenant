# Alur Pengelolaan Menu

## Gambaran

Menu merupakan data operasional API bisnis, bukan ingatan model atau fixture browser. PostgreSQL menyimpan nama, deskripsi, harga Rupiah integer, status aktif, ketersediaan dan referensi foto opsional `imageKey`. Website Dapur Sela memilih katalog publik demo-padang; dashboard mengambil tenant dari sesi yang diverifikasi backend.

```mermaid
sequenceDiagram
    actor Owner as Pemilik
    participant Web as Dashboard Next.js
    participant Proxy as Route server /staff/menu
    participant API as API NestJS
    participant DB as PostgreSQL
    Owner->>Web: Isi atau edit menu
    Web->>Proxy: POST/PATCH same-origin
    Proxy->>Proxy: Periksa Origin dan cookie
    Proxy->>API: Teruskan ke endpoint tetap loopback
    API->>DB: Verifikasi sesi, akun aktif, tenant dan role
    API->>API: Validasi payload tanpa field tambahan
    API->>DB: Tulis dengan scope tenant sesi
    DB-->>API: Hasil commit
    API-->>Web: Sukses atau error aman
    Web->>Proxy: Muat ulang menu
    Note over Web,DB: Halaman publik mengambil menu aktif dari API tanpa cache
```

## Izin

| Operasi | Pemilik | Staff | Publik |
| --- | --- | --- | --- |
| Lihat daftar internal termasuk nonaktif | Ya | Ya | Tidak |
| Tambah/edit nama, deskripsi, harga | Ya | Tidak | Tidak |
| Aktif/nonaktifkan menu | Ya | Tidak | Tidak |
| Pilih, ganti atau lepaskan foto | Ya | Tidak | Tidak |
| Tandai tersedia/habis | Ya | Ya | Tidak |
| Lihat menu aktif dan harga | Ya | Ya | Ya |

Nonaktif berbeda dari habis: nonaktif disembunyikan dari katalog publik; habis masih tampil dengan label Habis. Penonaktifan menggantikan penghapusan permanen pada alur ini. Data lama dipertahankan; tidak ada penghapusan berantai.

## Jalur permintaan

Base API: http://127.0.0.1:3001/api/v1

| Metode | Route | Perilaku |
| --- | --- | --- |
| GET | /public/tenants/:slug/menu | Menu aktif tenant aktif; kontrak tool tetap id, name, description, price, isAvailable |
| GET | /public/tenants/:slug/menu/catalogue | Katalog website dengan imageKey; tanpa data staff atau tenant ID |
| GET | /staff/tenants/:slug/menu | Daftar menu tenant sesi |
| POST | /staff/tenants/:slug/menu | Pemilik menambah menu |
| POST | /staff/tenants/:slug/menu/images | Pemilik mengunggah byte JPEG/PNG/WebP mentah, maksimal 5 MiB; bukan multipart/JSON |
| GET | /staff/tenants/:slug/menu/images/:key | Foto tenant sesi, termasuk menu tersembunyi |
| GET | /public/tenants/:slug/menu/images/:key | Foto tenant aktif yang masih dirujuk menu aktif |
| PATCH | /staff/tenants/:slug/menu/:id | Pemilik mengirim seluruh field menu |
| PATCH | /staff/tenants/:slug/menu/:id/availability | Pemilik/staff mengirim isAvailable saja |

Body tambah/edit: name, description, price, isActive, isAvailable, serta `imageKey` opsional. Nilai `imageKey` harus berupa nama aset statis yang diizinkan atau key unggahan milik tenant sesi. Backend memeriksa record kepemilikan; trigger database mencegah key unggahan lintas tenant. URL bebas dan path lain ditolak. Field tidak dikirim berarti foto lama dipertahankan, sedangkan `null` melepaskan foto. Nama 1–120 karakter, deskripsi maksimal 1000 karakter, harga integer 0–100.000.000 Rupiah, status boolean. Field tambahan seperti tenantId/role ditolak. Update menu tenant lain memberi 404 tanpa mengubah data. Slug tenant lain dengan sesi yang tidak cocok memberi 401. Origin mutasi harus cocok konfigurasi terpercaya.

Route browser /staff/menu hanya meneruskan endpoint menu ke API tetap. Cookie mentah tidak masuk JSON, localStorage atau log. Kontrol UI bukan batas izin: backend tetap menolak permintaan staff yang memodifikasi harga.

## Menjalankan dan mencoba

Jalankan BE dan FE seperti panduan lokal, lalu buka http://127.0.0.1:3000/login. Akun demo sudah tersedia; password dibaca privat dari file lokal, tidak disalin ke dokumentasi. Pada dashboard:

1. Owner melihat menu, form tambah dan tombol edit.
2. Isi nama, deskripsi, harga; pilih visibilitas dan ketersediaan. Unggah JPEG/PNG/WebP maksimal 5 MB dan periksa preview lokal, atau pilih aset statis/tanpa foto.
3. Tekan Simpan menu; sukses baru tampil setelah respons API.
4. Muat ulang beranda: menu aktif tampil dengan harga dari DB.
5. Staff hanya melihat aksi Tandai habis/Tandai tersedia, tanpa form harga.
6. Owner nonaktifkan menu; beranda tidak menampilkannya.

Seed menu memakai ID sintetis stabil untuk dua tenant. Retry tidak menimpa perubahan pemilik. Foto dibaca dari referensi `imageKey` pada menu, bukan dari nama hidangan. Mengganti nama tidak mengubah foto. Menu tanpa referensi valid memakai placeholder. Sembilan aset statis tetap didukung. Unggahan berjalan saat Simpan menu: sesi owner dan Origin diverifikasi sebelum pembacaan byte di BFF maupun API. Backend mendekode raster maksimal 16 juta piksel, menolak animasi/SVG, mengubah orientasi dan ukuran maksimal 1600×1600, lalu menyimpan WebP tanpa metadata maksimal 1 MiB dengan nama acak.

File disimpan di `.local/menu-images` pada workspace backend, bukan `public` atau source. Satu unggahan diproses sekaligus, maksimal 10 percobaan/menit/tenant/proses, 200 record/tenant, dan 1000 file global. Batas disk output sekitar 1 GiB. File yatim dari pembatalan/gagal simpan tetap memakan kuota; tidak ada cleanup destruktif otomatis. Operasional perlu backup file bersama DB dan prosedur rekonsiliasi manual. Deployment beberapa proses perlu storage bersama dan limiter terkoordinasi; konfigurasi ini untuk backend lokal satu proses. BFF membatasi body mentah 5 MiB tanpa base64 dan memverifikasi sesi sebelum parse. Pembacaan foto memeriksa tenant dan publikasi tiap permintaan, memakai `image/webp`, `nosniff`, `no-store`; nama file tidak pernah ditimpa.

## Verifikasi

```sh
rtk proxy node --test apps/api/test/menu.test.cjs apps/api/test/menu.integration.cjs
```

Tes mencakup input harga invalid, field tenant injeksi, akses tanpa sesi, staff create/edit ditolak, Origin salah, sesi tenant lain, ID menu tenant lain, status habis, publish/unpublish, serta constraint harga PostgreSQL nyata. Akun/menu probe tes dibersihkan tanpa menghapus data demo yang sudah ada.

## Verifikasi lintas dashboard

```sh
rtk proxy node --test apps/api/test/dashboard-web.integration.cjs
```

Membutuhkan FE dan BE lokal aktif. Tes HTTP melewati route Next.js hingga PostgreSQL pada tenant sintetis khusus: owner tambah/edit menu, staff tersedia/habis, staff ditolak pada konfigurasi meja/jadwal/profil, Origin asing ditolak, serta hasil publik berubah. Semua baris fixture milik tes dibersihkan. Cookie sesi sintetis dibuat langsung di DB; login diuji terpisah pada suite auth. Ini bukan tes klik form browser, keyboard atau screenshot.

## Batas saat ini

- Pengelolaan meja, jadwal dan reservasi tersedia melalui alur terpisah; panduan ini hanya membahas menu.
- Daftar belum berpaginasi; gunakan korpus demo kecil.
- Perubahan simultan memakai last-write-wins; belum ada optimistic version check.
- Foto dan data seed bersifat sintetis; bukan katalog restoran produksi.
- Tes browser pemilihan foto, preview, simpan, muat ulang dan pelepasan foto tersedia pada suite dashboard menu dengan API stub. Pengujian ini tidak membuktikan penyimpanan PostgreSQL nyata atau seluruh interaksi keyboard.

## Sources

- [Sharp constructor](https://sharp.pixelplumbing.com/api-constructor/)
- [NestJS Controllers](https://docs.nestjs.com/controllers)
- [Next.js Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route)
