# Addendum PRD — Restaurant Assistant MVP

Dokumen ini adalah tambahan keputusan domain untuk MVP. PRD utama tetap menjadi sumber scope dan aturan bisnis; dokumen ini tidak mengubah atau menimpa PRD utama.

## Keputusan domain

Pada MVP, `Restaurant` menjadi akar isolasi data sekaligus merepresentasikan satu brand dan satu lokasi operasional. Tidak ada entitas `Outlet` terpisah pada UI atau alur MVP. Dukungan banyak lokasi ditunda dan memerlukan keputusan model data baru.

Istilah `Tenant` tetap digunakan untuk menyebut batas isolasi secara konseptual. Pada implementasi MVP, batas tersebut direpresentasikan langsung oleh `Restaurant`.

## Dampak model data

- Resource milik restoran menggunakan `restaurant_id` yang wajib dan konsisten.
- Owner, staff, menu, jam buka, hari khusus, meja, reservasi, dokumen knowledge, proposal, sesi chat, dan audit harus ter-scope ke `Restaurant`.
- Foreign key dan constraint harus mencegah relasi lintas `Restaurant`.
- Harga, availability, jam operasional, dan slot meja tetap berasal dari API bisnis.

## Dampak antarmuka

- Halaman publik memilih `Restaurant` melalui slug, misalnya `/r/rumah-padang`.
- Slug hanya memilih katalog publik dan bukan bukti akses privat.
- Browser dan model tidak boleh memilih `restaurant_id` arbitrer untuk aksi privat.
- API menentukan dan mengikat konteks `Restaurant` dari server/session.

## Dampak penerimaan

- Pengujian isolasi menggunakan sedikitnya dua `Restaurant` sintetis.
- Tidak boleh ada kebocoran menu, sesi, proposal, dokumen, reservasi, atau metadata antar-`Restaurant`.
- Pengujian integrasi membuktikan foreign key lintas `Restaurant`, transaksi atomic, idempotency, dan pencegahan overlap reservasi.

## Batas perubahan

Addendum ini tidak menambah billing, onboarding SaaS, banyak lokasi dalam UI, pembayaran, kanal eksternal, atau perubahan jadwal/meja. Perubahan tersebut memerlukan keputusan scope terpisah.
