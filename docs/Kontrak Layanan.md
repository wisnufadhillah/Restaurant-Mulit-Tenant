# Kontrak Layanan

## Status

Health, profil katalog publik tenant dan filter error API sudah diimplementasikan. Kontrak sesi internal dan proposal di bawah tetap rancangan, belum tersedia. Kontrak tidak memberi izin akses database atau model secara otomatis.

## Batas layanan

- Web menyajikan halaman restoran dan widget; customer tetap dapat memakai form biasa.
- API bisnis memiliki tenant, sesi, data restoran, reservasi, otorisasi dan database.
- Service assistant memiliki satu agent dan tools read-only. Tidak mempunyai credential DB bisnis atau tool tulis.
- Tenant dari slug diresolusikan server untuk katalog publik. Resource privat tetap memerlukan bukti akses yang cocok; slug bukan credential.

## Health yang tersedia

`GET /api/v1/health` pada API mengembalikan `status: ok` dan `service: restaurant-api`. Assistant menyediakan `GET /health` dengan `status: ok`, `service: restaurant-assistant`, dan `model_enabled: false`. Keduanya liveness, bukan readiness database/model. Jangan menyamakan field status ini dengan status reservasi.

## Error domain yang diusulkan

Respons error API bisnis memiliki bentuk `error` berisi `code` dan `message`, dengan `request_id` untuk penelusuran. Pesan tidak memuat stack trace, query SQL, credential atau detail tenant lain. Validation failure memakai 422, akses tidak valid 401/403 dengan respons tidak membocorkan keberadaan resource, konflik slot/idempotency 409, pembatasan 429, serta ketergantungan AI unavailable 503.

Filter global API sudah menghasilkan error.code, error.message dan request_id buatan server dengan pesan tetap; 404 diuji lewat HTTP. Detail error driver tidak diteruskan. Uji khusus 500/503 dan validasi domain masih perlu dilengkapi. UI tidak boleh menganggap semua kegagalan sebagai konflik slot.

## Konteks sesi dan internal tool

API memverifikasi session secret, tenant aktif, outlet serta expiry, lalu memberikan konteks opaque berumur pendek kepada assistant. Setiap tool call internal memerlukan service authentication sekaligus binding konteks tersebut. Credential service tidak memberikan akses global. Field tenant, role atau persetujuan dari LLM tidak dipercaya.

Tool pertama yang direncanakan adalah `get_restaurant_info`, tanpa argumen tenant dari model. API menentukan tenant dari konteks tervalidasi dan mengembalikan profil/outlet/jadwal publik dengan waktu pengambilan. Fixture sintetis boleh dipakai pada smoke awal, tetapi harus ditandai fixture dan tidak dianggap DB live.

Jika konteks tidak ada/expired atau API gagal, tool ditolak; assistant tidak memakai tenant default dan tidak membuat fakta pengganti. Schema invalid serta tool tidak terdaftar tidak dieksekusi. Wrapper Python get_restaurant_info sudah membaca route katalog publik tenant dengan slug terikat aplikasi, timeout dan error aman. Profil berasal dari PostgreSQL; jadwal belum tersedia. Route publik ini bukan implementasi service auth atau sesi internal yang dijelaskan di atas.

## Usulan reservasi dan izin aksi

Agent hanya mengusulkan waktu absolut dan jumlah tamu. API memvalidasi lalu membuat proposal dengan binding tenant/sesi, hash payload, expiry dan nonce. Kontak diisi dalam komponen privat. Persetujuan melalui tombol customer memicu transaksi backend, bukan write tool LLM.

Management token dan kartu reservasi privat tidak masuk model atau transcript. Perubahan detail membatalkan proposal lama. Retry idempotent harus memulihkan hasil lama tanpa memberi akses ke sesi lain. Kontrak detail request/response baru dikunci bersama implementasi schema; jangan menambah signature spekulatif pada client sekarang.

## Kriteria review

- Wisnu dan Ridho menyetujui boundary layanan serta metode binding sesi sebelum integrasi domain.
- Sepakati struktur error dan response tools dengan schema yang dapat diuji.
- Tentukan model gratis berdasarkan smoke test, bukan sekadar adapter dapat diimpor.
- Pastikan kedua jalur UI memakai service bisnis yang sama, bukan menyalin aturan ke Python.
