# Akses Internal Tools

Endpoint read-only tersedia pada /api/v1/internal/tenants/:slug/restaurant dan /menu. Keduanya membaca service bisnis canonical yang sama dengan halaman publik. Tidak ada endpoint tulis atau akses reservasi privat.

Request membutuhkan tiga header server-side: x-internal-service-token, x-internal-context, x-session-id. Nilai rahasia tidak boleh berada di browser, URL, prompt, log atau contoh literal. API membaca INTERNAL_TOOL_SERVICE_TOKEN dan INTERNAL_CONTEXT_SECRET dari konfigurasi privat; masing-masing minimal 32 karakter. Tanpa konfigurasi lengkap, akses ditolak.

Service token saja tidak memberi akses. Konteks bertanda tangan HMAC harus cocok dengan tenant slug, session ID dan expiry. Token malformed, segmen tambahan, tenant/sesi lain atau expired ditolak. Perbandingan service token menggunakan timingSafeEqual. Response memakai data publik aktif, tidak menyertakan data staff/customer.

## Pemeriksaan

```sh
rtk proxy node --test apps/api/test/internal-tools.integration.cjs apps/api/test/internal-context.test.cjs
```

Tes memakai credential acak sementara melalui environment, tidak mencetak nilainya, dan memanggil API hingga PostgreSQL nyata. Mencakup service/context hilang, tenant lain, sesi lain, expiry, baca info/menu berhasil dan POST ditolak.

## Batas

Ini boundary pembacaan internal, bukan chat gateway. Penerbit konteks harus tetap server terpercaya, memverifikasi sesi chat aktif sebelum menandatangani. Registry sesi chat server kini menyimpan hash bearer, ID publik, tenant dan expiry 24 jam; konteks tool diterbitkan maksimal 30 detik. Internal tools memeriksa registry aktif setelah signature, sehingga revoke langsung menolak konteks lama. Registry masih in-memory, maksimal 1000 sesi per proses; restart membatalkan sesi dan belum cocok untuk multi-instance. Endpoint sesi cookie tersedia di /api/v1/chat/session (GET/POST/DELETE), diproxy same-origin oleh Next.js /chat/session. POST memakai tenant demo-padang tetap dari aplikasi dan memverifikasi tenant/outlet aktif. JSON hanya ID publik dan expiry; bearer ada pada HttpOnly/SameSite=Strict cookie, Secure pada production. POST sesi valid memakai sesi lama; token expired/invalid ditolak, tidak diganti diam-diam. DELETE memerlukan Origin terpercaya dan mencabut sesi sebelum menghapus cookie. Persistence sesi belum tersedia. Panel bantuan kini memuat kartu menu/profil/jadwal melalui /chat/catalogue/:resource (Next.js) → /api/v1/chat/catalogue/:resource. Allowlist hanya menu, restaurant dan hours; cookie valid wajib, tenant tetap dari sesi. Data berasal service API yang sama, tidak dari fixture. Ini aksi katalog eksplisit, bukan inference AI atau balasan keyword. Panel tetap menyatakan percakapan AI bebas belum tersedia. Adapter Python, menu tool dan gateway percakapan AI belum terintegrasi. Kontrak OpenAPI untuk route ini masih perlu diselaraskan sebelum penerimaan akhir.
