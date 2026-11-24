# Penjelasan Presentasi Arsitektur Dapur Sela

Panduan ini mendampingi 31 slide pada presentasi Arsitektur Dapur Sela. Bagian **Naskah** bisa dipakai saat berbicara, bukan harus dibaca persis. Bagian **Yang ditunjuk** membantu menjelaskan diagram. Contoh harga, waktu dan nama pembanding adalah ilustrasi, bukan transaksi nyata.

Presentasi menjelaskan implementasi sistem. Keberhasilan satu diagram atau contoh tidak berarti seluruh sistem siap produksi. Pembayaran yang dibahas adalah sandbox.

## Pembukaan

“Pada presentasi ini saya menjelaskan bagaimana website Dapur Sela menghubungkan tampilan customer, dashboard pengelola, database, chatbot, dan pembayaran. Fokusnya bukan hanya teknologi yang digunakan, tetapi siapa yang menentukan data, siapa yang boleh melakukan transaksi, serta bagaimana konsistensi dijaga ketika terjadi pengulangan atau kegagalan request.”

## Slide 1 — Dapur Sela

**Pesan utama:** sistem restoran terdiri dari tampilan web, API bisnis, dan assistant dengan tanggung jawab berbeda.

**Naskah:**
“Dapur Sela adalah website restoran dengan menu, reservasi, dashboard, chatbot, dan pembayaran sandbox. Customer bisa menggunakan website biasa tanpa wajib membuka chat. Aturan bisnis tetap ditentukan backend; model AI hanya membantu membaca informasi dan menyusun usulan.”

**Yang ditunjuk:** Web untuk pengalaman pengguna, Bisnis untuk aturan dan penyimpanan, Assistant untuk percakapan.

**Transisi:** “Saya mulai dari dua cara customer menggunakan sistem ini.”

## Slide 2 — Satu restoran, dua jalur customer

**Pesan utama:** jalur website dan percakapan memakai sumber data bisnis yang sama.

**Naskah:**
“Customer bisa langsung melihat menu dan mengisi form reservasi melalui website. Customer juga bisa bertanya lewat chat untuk mencari informasi atau menyiapkan draft pesanan. Kedua jalur mengambil fakta dari API yang sama, jadi harga dan ketersediaan tidak dibuat sendiri oleh chatbot.”

**Yang ditunjuk:** dua jalur bertemu pada API bisnis. Jalur percakapan bukan database atau sistem reservasi kedua.

**Transisi:** “Supaya jalur ini aman, lapisan web dan backend memiliki peran masing-masing.”

## Slide 3 — BFF, Caddy, dan API punya tugas berbeda

**Pesan utama:** tiga lapisan ini tidak saling menggantikan.

**Naskah:**
“BFF adalah Backend for Frontend, yaitu route server Next.js yang melayani request browser, termasuk pengelolaan cookie dan penerusan request. Caddy adalah reverse proxy untuk HTTPS dan pintu masuk backend di VPS. NestJS memeriksa sesi, tenant, role, input, dan aturan bisnis sebelum mengakses database.”

**Yang ditunjuk:** BFF menangani kebutuhan web; Caddy menangani koneksi; API menentukan izin dan transaksi.

**Jika ditanya mengapa tidak langsung browser ke API:** “Pola BFF mempertahankan request privat pada origin website dan cookie HttpOnly. Backend tetap memeriksa semuanya lagi, jadi BFF bukan satu-satunya pengaman.”

## Slide 4 — Alur data melintasi batas kepercayaan

**Pesan utama:** setiap perpindahan lapisan memerlukan pemeriksaan, bukan otomatis dipercaya.

**Naskah:**
“Request dimulai dari browser, masuk ke Next.js, melewati HTTPS Caddy, lalu diproses NestJS. Untuk pertanyaan AI, API memanggil Agno; Agno dapat membaca tool internal dengan autentikasi service dan konteks sesi. PostgreSQL, OpenRouter, serta Midtrans memiliki peran berbeda dan tidak diberi akses bebas satu sama lain.”

**Yang ditunjuk:** jalur data bisnis ke PostgreSQL, percakapan ke OpenRouter, pembayaran ke Midtrans. Jangan menjelaskan semua panah sebagai request yang selalu terjadi pada setiap kunjungan.

**Transisi:** “Di sisi backend, pembagian ini tetap dibuat sederhana.”

## Slide 5 — Satu API, modul dipisah menurut domain

**Pesan utama:** backend adalah modular monolith, bukan banyak microservice bisnis.

**Naskah:**
“NestJS tetap satu aplikasi API, tetapi kodenya dipisah menurut domain: operasional restoran, reservasi, akses, percakapan, dan pesanan. Pemisahan ini membantu perubahan menu tidak bercampur dengan aturan pembayaran atau sesi. Audit juga mengikuti domain: perubahan operasional, reservasi, dan pembayaran memiliki catatan yang berbeda.”

**Yang ditunjuk:** nama kelompok domain dan data yang dimilikinya. Tidak perlu membaca seluruh nama file.

**Transisi:** “Berikut penempatan komponen saat staging.”

## Slide 6 — Satu VPS, namespace API dibagi dengan assistant

**Pesan utama:** frontend terpisah di Vercel; layanan backend berada di VPS dengan port internal.

**Naskah:**
“Frontend Next.js berada di Vercel, sedangkan Caddy, API, Agno, dan PostgreSQL berada di VPS melalui Docker Compose. API dan Agno berbagi network namespace sehingga komunikasi loopback tetap bekerja meskipun prosesnya terpisah. Hanya Caddy menerbitkan port 80 dan 443; database serta port API dan Agno tidak dipublikasikan langsung.”

**Yang ditunjuk:** port publik Caddy, koneksi loopback API–Agno, serta volume DB dan foto.

**Catatan:** nama network private tidak berarti seluruh egress diblokir. Agno tetap memerlukan koneksi keluar ke OpenRouter. Pemisahan jaringan juga bukan bukti kapasitas atau high availability.

## Slide 7 — Tenant harus cocok sampai ke relasi data

**Pesan utama:** isolasi bukan hanya menambahkan kolom tenant.

**Naskah:**
“Tenant menyatakan pemilik data restoran. Server menentukan tenant dari sesi dan menggunakan scope itu saat membaca atau menulis. Database ikut memeriksa relasi gabungan, misalnya reservasi harus menunjuk meja dari tenant dan outlet yang sama.”

**Yang ditunjuk:** pasangan tenant, outlet, dan resource. Slug publik memilih katalog, bukan memberikan izin membuka data privat.

**Batas:** struktur mendukung pengujian isolasi beberapa tenant, tetapi demo beroperasi pada satu tenant dan satu outlet aktif.

## Slide 8 — Chat membaca fakta, UI memegang persetujuan

**Pesan utama:** usulan AI bukan izin transaksi.

**Naskah:**
“Pesan customer diperiksa dan disamarkan sebelum masuk runtime AI. Agent membaca informasi melalui tool yang diizinkan, lalu aplikasi memvalidasi respons sebelum menampilkan teks, kartu, atau draft. Membuat reservasi, order, atau pembayaran tetap memerlukan tindakan customer pada UI privat, bukan sekadar chatbot mengatakan berhasil.”

**Yang ditunjuk:** pisahkan baca fakta dan tindakan konfirmasi. Tool availability hanya membaca; prepare_order menyiapkan usulan tanpa membuat order DB.

**Transisi:** “Runtime AI juga dibatasi agar kegagalan tidak berlarut.”

## Slide 9 — Budget kecil membuat kegagalan terukur

**Pesan utama:** model dan tool berjalan dengan batas operasional eksplisit.

**Naskah:**
“Satu giliran percakapan memiliki deadline core 30 detik, maksimal tiga inference request, dan tiga tool call. Input, history, output, serta ukuran respons tool juga dibatasi. Kalau model atau tool gagal, sistem memberi keterbatasan dan jalur website, bukan retry tanpa batas atau mengarang hasil transaksi.”

**Yang ditunjuk:** 30 detik sebagai batas core, lima turn per menit per sesi sebagai limiter API. Angka ini konfigurasi kode, bukan hasil pengukuran latency atau jaminan SLA.

**Catatan:** deadline berbasis pembatalan kooperatif; bukan jaminan pekerjaan provider langsung berhenti.

## Slide 10 — FAQ masuk setelah tenant dan revision benar

**Pesan utama:** retrieval memilih sumber yang berhak dan masih aktif sebelum menyusun jawaban.

**Naskah:**
“Untuk pertanyaan kebijakan, sistem mencari cuplikan FAQ dalam tenant yang sama. Dokumen harus menggunakan revision aktif yang published, kemudian pencarian lexical memilih cuplikan relevan. Harga, jam, dan ketersediaan tetap dari API operasional, bukan diambil dari dokumen FAQ.”

**Yang ditunjuk:** tenant/sesi, revision aktif, lalu ranking. Lexical berarti pencocokan kata/token; jalur aktif belum menggunakan embedding.

**Transisi:** “Setelah percakapan, saya masuk ke transaksi reservasi yang tidak bergantung pada model.”

## Slide 11 — Reservasi lahir setelah ringkasan privat

**Pesan utama:** booking dibuat setelah customer meninjau detail dan memberi konfirmasi eksplisit.

**Naskah:**
“Customer mengisi waktu, jumlah tamu, dan kontak lewat form privat. Aplikasi membuat ringkasan yang belum menahan meja, kemudian customer menekan konfirmasi. API baru memeriksa ulang dan menyimpan reservasi confirmed, event awal, serta konsumsi bukti konfirmasi dalam transaksi.”

**Yang ditunjuk:** form, ringkasan, klik, commit. Status berhasil baru ditampilkan setelah hasil backend jelas.

**Jika ditanya batas input:** baseline durasi 90 menit, minimal 60 menit sebelum kedatangan, maksimal 30 hari, dan 1–12 tamu sesuai kapasitas meja.

## Slide 12 — Overlap dicegah di transaksi dan PostgreSQL

**Pesan utama:** availability bukan penahanan meja; create tetap harus memeriksa ulang.

**Naskah:**
“Dua customer bisa melihat snapshot tersedia pada saat yang berdekatan. Saat create, API mengambil lock tenant dan memvalidasi aturan kembali; PostgreSQL memiliki exclusion constraint yang menolak reservasi confirmed bertabrakan pada meja yang sama. Interval memakai batas akhir terbuka, sehingga booking berikutnya boleh dimulai tepat saat booking sebelumnya selesai.”

**Yang ditunjuk:** interval [start_at, end_at), lock, dan constraint. Bila respons terputus, customer memulihkan hasil dengan key sama, bukan langsung membuat booking baru.

## Slide 13 — Reservasi hanya punya satu state awal

**Pesan utama:** reservasi tidak memakai pending atau approval staff pada jalur create.

**Naskah:**
“Setelah konfirmasi customer dan transaksi valid, status awal reservasi langsung confirmed. Dari sana status bisa menjadi cancelled, completed, atau no_show sesuai aturan. Status akhir tidak dikembalikan ke confirmed; selesai dan tidak hadir hanya diterima setelah waktu reservasi berakhir.”

**Yang ditunjuk:** tiga cabang terminal. Cancellation customer mengikuti cutoff, sedangkan cancellation staff membutuhkan alasan.

**Transisi:** “Berbeda dengan reservasi, pesanan memiliki proses pembayaran eksternal.”

## Slide 14 — Intent disimpan sebelum HTTP ke Snap

**Pesan utama:** simpan niat transaksi lebih dahulu agar pengulangan tidak mengirim transaksi provider lagi.

**Naskah:**
“API menghitung total dari harga DB, menyimpan order dan intent pembayaran, lalu baru memanggil Midtrans Snap di luar transaksi DB. Jika token berhasil diterima, hasilnya disimpan agar retry dapat memakai hasil yang sama. Jika hasil HTTP tidak pasti, status creating atau unknown tidak otomatis dikirim ulang karena provider mungkin sudah menerima permintaan pertama.”

**Yang ditunjuk:** DB commit sebelum HTTP, dispatch sekali, lalu simpan hasil. Ready berarti akses Snap tersedia, bukan sudah lunas.

## Slide 15 — Lunas diputuskan dari verifikasi server

**Pesan utama:** halaman selesai bayar atau callback browser bukan bukti lunas.

**Naskah:**
“Midtrans mengirim notifikasi ke backend. Backend memeriksa SHA512 menggunakan Signature Secret Key, mencocokkan nominal, lalu meminta status otoritatif memakai Server Key. Setelah identitas dan status memenuhi syarat, perubahan pembayaran dan event audit disimpan bersama.”

**Yang ditunjuk:** Signature Secret Key untuk signature, Server Key untuk API, kemudian commit status dan event.

**Catatan:** SHA512 biasa, bukan HMAC. Settlement tidak diturunkan oleh notifikasi terlambat. Seluruh alur presentasi ini tetap sandbox.

## Slide 16 — Operasional dan pesanan tidak punya izin sama

**Pesan utama:** dashboard memiliki batas role dan batas jenis tindakan.

**Naskah:**
“Owner mengelola profil, menu beserta foto, meja, dan jadwal. Staff dapat mengubah tersedia atau habis, serta menjalankan operasional reservasi yang diizinkan. Dashboard Pesanan hanya membaca snapshot dan histori pembayaran; tidak memiliki tombol manual menandai lunas, refund, atau pengelolaan dapur.”

**Yang ditunjuk:** perbedaan owner/staff dan proses file foto. File berada di volume backend, bukan penyimpanan sementara Vercel.

**Catatan:** file dan DB bukan satu transaksi; file yatim mungkin tertinggal dan perlu rekonsiliasi, bukan dihapus sembarangan.

## Slide 17 — Sesi berbeda, masa hidup berbeda

**Pesan utama:** satu jenis sesi tidak memberikan semua akses.

**Naskah:**
“Sesi staff, chat, pembuat reservasi, dan pengelolaan reservasi memiliki tujuan serta masa hidup berbeda. Staff memiliki idle 30 menit dan batas absolut 8 jam, sedangkan sesi chat berlaku 24 jam sejak dibuat. Management session hanya untuk satu booking; kode referensi bukan credential dan tidak menggantikan cookie privat.”

**Yang ditunjuk:** pilih tiga contoh penting; jangan membaca semua angka tabel.

**Transisi:** “Sampai sini kita sudah melihat perilaku sistem. Bagian berikut menjelaskan mengapa datanya dipisah seperti itu.”

## Slide 18 — Data dibagi menurut tugasnya

**Pesan utama:** pahami kelompok data, bukan menghafal 21 tabel.

**Naskah:**
“Database memiliki 21 tabel aplikasi, tetapi bisa dibaca sebagai lima kelompok. Operasional menyimpan kondisi restoran; akses menyimpan akun dan sesi; reservasi menyimpan booking; pesanan menyimpan snapshot tagihan; knowledge menyimpan FAQ. Pembagian ini memudahkan melihat tanggung jawab data tanpa menampilkan seluruh kolom di layar.”

**Yang ditunjuk:** lima kelompok. Tabel bukan berarti lima database berbeda.

## Slide 19 — Tenant itu restoran; outlet itu lokasi

**Pesan utama:** pemilik data berbeda dari lokasi fisik.

**Naskah:**
“Dalam model produk ini, tenant mewakili brand atau pemilik data restoran, sedangkan outlet adalah lokasi fisik miliknya. Setiap outlet harus menunjuk satu tenant melalui foreign key. Model dapat menyimpan banyak outlet, tetapi demo aktif memakai satu tenant dengan tepat satu outlet aktif.”

**Yang ditunjuk:** PK id sebagai penanda baris, FK tenant_id sebagai penghubung ke induk.

**Batas:** jangan menyebut UI multi-outlet sudah tersedia.

## Slide 20 — Menu menyimpan harga, upload menyimpan foto

**Pesan utama:** metadata menu dan berkas foto memiliki siklus penyimpanan berbeda.

**Naskah:**
“MenuItem menyimpan nama, harga, dan image_key. MenuUpload menyimpan pemilik serta ukuran foto upload, sementara file WebP berada di volume backend. Referensinya diperiksa service dan trigger tenant; bukan FK biasa, karena key juga bisa menunjuk gambar statis yang tidak memiliki record upload.”

**Yang ditunjuk:** MenuItem, image_key, MenuUpload. Foto baru dipasang pada menu setelah penyimpanan form berhasil.

## Slide 21 — Akun staff tetap; sesi login bisa berakhir

**Pesan utama:** logout atau expiry tidak menghapus akun.

**Naskah:**
“Staff menyimpan identitas akun dan role; StaffSession menyimpan akses login pada browser. Satu akun bisa memiliki beberapa sesi, dan masing-masing harus memenuhi aturan server. Setelah idle 30 menit atau batas 8 jam, sesi ditolak dan dashboard menuju login; polling otomatis tidak memperpanjang idle.”

**Yang ditunjuk:** satu akun ke nol atau banyak sesi.

**Jika ditanya laptop mati:** server tidak mendeteksi tombol power laptop. Server menilai waktu aktivitas terakhir dan expiry saat menerima request.

## Slide 22 — Satu reservasi memakai satu meja, 90 menit

**Pesan utama:** reservasi adalah komitmen meja pada suatu interval.

**Naskah:**
“Setiap booking menunjuk tepat satu meja dengan tenant dan outlet yang sesuai. Meja yang sama dapat memiliki banyak booking pada waktu berbeda, tetapi rentang confirmed tidak boleh bertabrakan. Contoh 18.00–19.30 dapat disusul booking mulai 19.30 karena waktu akhir tidak ikut mengunci interval berikutnya.”

**Yang ditunjuk:** relasi meja–reservasi, kemudian contoh dua interval. Contoh tersebut ilustrasi, bukan booking staging.

## Slide 23 — Ringkasan menyimpan izin, bukan menahan meja

**Pesan utama:** konfirmasi terikat pada detail yang benar-benar ditinjau customer.

**Naskah:**
“ReservationConfirmation mengikat sesi pembuat, hash detail, hash nonce dan expiry. Nonce adalah kode sekali pakai untuk ringkasan tertentu; perubahan detail memerlukan ringkasan baru. Masa berlaku maksimal lima menit tidak berarti meja ditahan, sehingga create tetap memeriksa ulang availability.”

**Yang ditunjuk:** nonce_hash, request_hash, expires_at. Sebelum dikonsumsi, konfirmasi belum memiliki hasil reservasi.

## Slide 24 — Akses pembuat berbeda dari akses satu booking

**Pesan utama:** sesi pemulihan dan sesi pengelolaan bukan hal yang sama.

**Naskah:**
“Creator session membuktikan browser pembuat dan dapat membantu memulihkan hasil request yang terputus bersama key percobaan. Management session memberi akses melihat atau membatalkan tepat satu reservasi. Menutup akses privat mencabut management session, bukan membatalkan booking; kode referensi sendiri juga tidak bisa membuka data.”

**Yang ditunjuk:** satu Reservation dan banyak kemungkinan management session. Setiap management session tetap menunjuk satu booking saja.

## Slide 25 — Harga pesanan disalin saat order dibuat

**Pesan utama:** perubahan harga katalog tidak mengubah transaksi lama.

**Naskah:**
“Misalnya dua porsi dipesan saat harga satuannya Rp28.000, total yang disimpan adalah Rp56.000. Kalau katalog kemudian berubah menjadi Rp30.000, tagihan lama tetap memakai snapshot saat order dibuat. Snapshot tersimpan sebagai JSON item, bukan relasi hidup yang selalu membaca harga katalog terbaru.”

**Yang ditunjuk:** harga menu sekarang dibanding snapshot Order.items. Semua angka di contoh ini ilustrasi.

## Slide 26 — Order terikat sesi browser pembuatnya

**Pesan utama:** tidak memiliki akun customer bukan berarti order bebas dibaca siapa pun.

**Naskah:**
“Create order mengikat pesanan ke ChatSession yang aktif dalam tenant yang sama. Customer membaca status dengan bukti sesi browser pemilik, bukan hanya mengetahui kode order. Relasi sesi memang nullable pada schema untuk kompatibilitas, tetapi jalur pembuatan order aktif tetap mewajibkan sesi.”

**Yang ditunjuk:** ChatSession ke Order. Staff memakai sesi staff sendiri pada endpoint terpisah untuk daftar/detail tenantnya.

## Slide 27 — Riwayat pembayaran mencatat perubahan status

**Pesan utama:** status terkini dan histori perubahan memiliki kegunaan berbeda.

**Naskah:**
“Order menyimpan status pembayaran terkini, sedangkan OrderPaymentEvent menyimpan perpindahan status beserta waktunya. Jika status benar-benar berubah setelah verifikasi server, keduanya ditulis dalam transaksi yang sama. Notifikasi duplikat tidak menambah event lagi, sehingga histori tidak berisi perubahan palsu akibat retry.”

**Yang ditunjuk:** contoh pending menuju settlement, lalu hubungan satu order ke banyak event. Jangan menyamakan event pembayaran dengan audit operasional atau laporan keuangan.

## Slide 28 — FAQ punya dokumen, versi, dan potongan teks

**Pesan utama:** identitas, versi, dan bahan pencarian dipisahkan.

**Naskah:**
“KnowledgeDocument adalah identitas FAQ, revision menyimpan versi isi, dan chunk adalah potongan teks untuk pencarian. Misalnya pertanyaan tentang fasilitas keluarga hanya dijawab dari revision aktif yang published dan tenant yang sesuai. Harga dan availability tidak dimasukkan ke pengetahuan ini karena harus dibaca dari API aktual.”

**Yang ditunjuk:** satu dokumen, versi yang dipilih, lalu potongan teks. Editor FAQ dashboard belum menjadi bagian implementasi ini.

## Slide 29 — FK gabungan mencegah meja tertukar tenant

**Pesan utama:** foreign key komposit memeriksa kecocokan seluruh konteks relasi.

**Naskah:**
“Pada ilustrasi dua restoran, booking Dapur Sela tidak boleh menunjuk meja milik Dapur Pagi. FK gabungan memeriksa tenant_id, outlet_id dan table_id sebagai satu pasangan konteks. Ini melengkapi pemeriksaan API: bukan hanya mencari ID meja yang ada, tetapi memastikan meja tersebut memang milik tenant dan outlet booking.”

**Yang ditunjuk:** relasi yang ditolak dan tiga kolom yang harus cocok. Dua restoran itu ilustrasi pengujian isolasi, bukan UI multi-tenant baru.

## Slide 30 — Klik dua kali tetap satu reservasi

**Pesan utama:** retry yang sama mengembalikan hasil, bukan membuat booking kedua.

**Naskah:**
“Kalau customer menekan konfirmasi dua kali dengan key, payload dan sesi pembuat sama, request kedua memulihkan hasil pertama. Transaksi menyimpan reservasi, event dan konsumsi konfirmasi bersama, sehingga tidak ada booking tanpa catatan yang seharusnya menyertainya. Jika respons putus, key tetap dipakai untuk memeriksa hasil; membuat key baru berisiko membuat permintaan lain.”

**Yang ditunjuk:** dua klik menuju satu hasil. Idempotency menjaga pengulangan; atomicity menjaga perubahan terkait tetap konsisten.

## Slide 31 — Tiga pilihan desain yang perlu diingat

**Pesan utama:** tutup dengan alasan desain, bukan daftar teknologi.

**Naskah:**
“Pertama, server mengikat tenant dan sesi sehingga browser atau model tidak menentukan izin sendiri. Kedua, relasi dan transaksi database menjaga booking, audit dan konfirmasi tetap konsisten. Ketiga, snapshot dan event mempertahankan fakta transaksi walaupun katalog atau status berubah; cakupannya tetap satu tenant/outlet untuk demo dan pembayaran sandbox.”

**Penutup:**
“Jadi kontribusi AI berada pada bantuan bahasa dan pengambilan informasi, sedangkan izin, transaksi, serta sumber fakta tetap berada di aplikasi bisnis. Itu alasan arsitektur ini memisahkan percakapan dari keputusan yang berdampak pada data.”

## Istilah untuk tanya jawab

| Istilah | Penjelasan singkat |
| --- | --- |
| API | Antarmuka terkontrol untuk membaca atau menjalankan operasi aplikasi |
| BFF | Lapisan backend Next.js yang khusus melayani frontend |
| Reverse proxy | Pintu masuk yang meneruskan koneksi ke layanan internal |
| Tenant | Brand atau pemilik data yang harus terisolasi |
| Outlet | Lokasi fisik milik tenant |
| PK | Penanda unik satu baris |
| FK | Rujukan ke data induk |
| FK komposit | Rujukan menggunakan beberapa kolom yang harus cocok bersama |
| Nonce | Bukti sekali pakai yang terikat pada ringkasan |
| Snapshot | Salinan fakta pada saat transaksi dibuat |
| Atomic | Seluruh perubahan dalam transaksi berhasil atau batal bersama |
| Idempotency | Pengulangan request yang sama tidak menggandakan hasil |
| RAG | Mencari konteks sumber terlebih dahulu untuk membantu penyusunan jawaban |
| Lexical retrieval | Pencarian berdasarkan kata/token, bukan embedding |
| Webhook | Notifikasi HTTP dari provider ke backend |
| Sandbox | Lingkungan pengujian, bukan transaksi uang nyata |
| Namespace jaringan | Ruang jaringan proses/container; dua proses bisa berbagi loopback |
| Unknown outcome | Hasil request belum pasti; bukan otomatis gagal atau berhasil |

## Jawaban untuk pertanyaan yang sering muncul

**Apakah ini sudah SaaS multi-tenant penuh?**

Belum. Data dan pengujian isolasinya tenant-scoped, tetapi demo dan UI aktif memakai satu restoran dengan satu outlet. Billing dan onboarding mandiri tidak menjadi bagian ini.

**Mengapa data kontak tidak dikirim ke chatbot?**

Model hanya memerlukan fakta publik dan detail nonprivat untuk membantu. Nama/kontak reservasi serta izin konfirmasi diproses form privat dan backend, bukan dijadikan bahan inference.

**Apakah model bisa langsung membuat booking atau membayar?**

Tidak. Registry aktif tidak menyediakan tool tulis bisnis; persetujuan berasal dari kontrol UI customer dan tetap divalidasi backend.

**Mengapa tidak semua data dijadikan RAG?**

RAG cocok untuk FAQ/kebijakan. Harga, jadwal, availability dan status transaksi memiliki sumber operasional yang harus dibaca langsung dari API.

**Apakah pembayaran berhasil di browser berarti lunas?**

Tidak. Backend memverifikasi signature, nominal dan Status API sebelum menyimpan perubahan status. Tampilan browser membaca status dari backend.

**Apakah semua lapisan diuji live saat PPT dibuat?**

Tidak. PPT berasal dari pembacaan implementasi. Pengujian stub, integrasi DB, dan smoke deployment/provider memiliki cakupan berbeda; jangan menyatukannya menjadi klaim siap produksi.

## Cara latihan

- Untuk presentasi singkat, pakai slide 1–17, lalu pilih relasi data yang relevan dari 18–30. Slide 31 tetap sebagai simpulan.
- Sebut pesan utama dahulu, tunjuk diagram, lalu jelaskan satu contoh. Jangan membaca seluruh nama kolom.
- Jika ditanya detail schema, gunakan dokumen ERD sebagai bahan lanjutan; slide memang tidak menampilkan seluruh 168 kolom.
- Catat durasi latihan sendiri. Panduan ini tidak mengklaim estimasi durasi sebagai hasil pengukuran.
- Buka PPTX di PowerPoint sebelum tampil. PDF/HTML/PNG adalah pratinjau dari generator, bukan bukti render native PowerPoint.
