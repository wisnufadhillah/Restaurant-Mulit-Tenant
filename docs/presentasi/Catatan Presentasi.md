# Catatan Presentasi Dapur Sela

Catatan bicara untuk slide 18–31, masing-masing tiga kalimat: pembuka, penjelasan, dan simpulan. Baca santai sambil menunjuk diagram, bukan membaca daftar kolom; durasi maksimal sekitar 60–90 detik per slide, bukan hasil pengukuran latihan.

Angka harga, merek pembanding, waktu booking, dan FAQ pada contoh adalah ilustrasi fiktif, bukan data atau bukti runtime. Paparan menjelaskan struktur lokal, bukan hasil uji deployment atau pembayaran live.

## Urutan slide

1. Dapur Sela
2. Satu restoran, dua jalur customer
3. BFF, Caddy, dan API punya tugas berbeda
4. Alur data melintasi batas kepercayaan
5. Satu API, modul dipisah menurut domain
6. Satu VPS, namespace API dibagi dengan assistant
7. Tenant harus cocok sampai ke relasi data
8. Chat membaca fakta, UI memegang persetujuan
9. Budget kecil membuat kegagalan terukur
10. FAQ masuk setelah tenant dan revision benar
11. Reservasi lahir setelah ringkasan privat
12. Overlap dicegah di transaksi dan PostgreSQL
13. Reservasi hanya punya satu state awal
14. Intent disimpan sebelum HTTP ke Snap
15. Lunas diputuskan dari verifikasi server
16. Operasional dan pesanan tidak punya izin sama
17. Sesi berbeda, masa hidup berbeda
18. Data dibagi menurut tugasnya
19. Tenant itu restoran; outlet itu lokasi
20. Menu menyimpan harga, upload menyimpan foto
21. Akun staff tetap; sesi login bisa berakhir
22. Satu reservasi memakai satu meja, 90 menit
23. Ringkasan menyimpan izin, bukan menahan meja
24. Akses pembuat berbeda dari akses satu booking
25. Harga pesanan disalin saat order dibuat
26. Order terikat sesi browser pembuatnya
27. Riwayat pembayaran mencatat perubahan status
28. FAQ punya dokumen, versi, dan potongan teks
29. FK gabungan mencegah meja tertukar tenant
30. Klik dua kali tetap satu reservasi
31. Tiga pilihan desain yang perlu diingat

## Naskah bicara

### Slide 18: Data dibagi menurut tugasnya

Mengapa data restoran dipisah menjadi beberapa kelompok? Dari 21 tabel, operasional menyimpan kondisi restoran, akses menyimpan sesi, reservasi menyimpan booking, pesanan menyimpan tagihan, dan pengetahuan menyimpan FAQ. Kelompok ini membantu membaca hubungan data tanpa harus menghafal semua kolom.

### Slide 19: Tenant itu restoran; outlet itu lokasi

Apa beda tenant dengan outlet? Tenant adalah pemilik data restoran, sedangkan Outlet adalah lokasi miliknya; PK berarti penanda unik dan FK berarti rujukan ke data induk, sehingga satu tenant boleh punya banyak outlet tetapi setiap outlet punya satu tenant. Struktur mendukung banyak lokasi, tetapi demo dan alur reservasi aktif memakai satu tenant dengan tepat satu outlet aktif, bukan UI multi-outlet.

### Slide 20: Menu menyimpan harga, upload menyimpan foto

Mengapa foto tidak disimpan langsung di data menu? MenuItem menyimpan nama, harga, dan image_key, sedangkan MenuUpload menyimpan pemilik serta ukuran file upload yang berada di volume; satu upload boleh dipakai banyak menu dan satu menu paling banyak memakai satu upload. Garis putus adalah rujukan logis yang diperiksa service dan trigger tenant, bukan FK biasa, karena foto statis tidak punya baris upload dan penyimpanan file tidak satu transaksi dengan database.

### Slide 21: Akun staff tetap; sesi login bisa berakhir

Mengapa akun dan sesi login menjadi dua tabel? Staff menyimpan akun dan role, sementara StaffSession menunjuk akun melalui tenant_id serta staff_id dan menyimpan masa akses; satu akun boleh memiliki beberapa sesi login. Akun tidak hilang saat sesi habis, tetapi akses berakhir setelah idle 30 menit atau batas absolut 8 jam, dan polling dashboard tidak memperpanjang idle.

### Slide 22: Satu reservasi memakai satu meja, 90 menit

Apa yang sebenarnya disimpan sebagai reservasi? Setiap Reservation menunjuk satu DiningTable lewat gabungan tenant, outlet, dan table_id, lalu memakai interval tepat 90 menit; satu meja bisa punya banyak reservasi pada waktu berbeda. Contoh jam di layar adalah ilustrasi: booking 18.00 sampai 19.30 boleh disusul mulai 19.30, sedangkan cek availability belum menahan meja dan transaksi tetap memeriksa bentrok.

### Slide 23: Ringkasan menyimpan izin, bukan menahan meja

Untuk apa ReservationConfirmation dibuat sebelum booking? Tabel ini mengikat sesi pembuat, hash detail, dan hash nonce, yaitu kode sekali pakai dari ringkasan privat; creator wajib satu, sedangkan hasil reservasinya masih kosong sebelum konsumsi dan maksimal satu setelah dipakai. Konfirmasi berlaku maksimal lima menit tanpa menahan meja, perubahan detail memerlukan ringkasan baru, dan klik sah tetap diikuti pemeriksaan serta penyimpanan booking bersama konsumsi nonce.

### Slide 24: Akses pembuat berbeda dari akses satu booking

Apakah kode referensi cukup untuk membuka reservasi? ReservationCreatorSession membuktikan browser pembuat dan dapat memulihkan hasil dengan key percobaan, sedangkan ReservationManagementSession menunjuk tepat satu Reservation melalui FK tenant dan reservation_id untuk melihat atau membatalkannya. Kode referensi bukan kunci akses, dan menutup akses privat hanya mencabut sesi management, bukan membatalkan booking atau otomatis mencabut sesi pembuat.

### Slide 25: Harga pesanan disalin saat order dibuat

Mengapa Order menyimpan salinan item, bukan FK ke menu? Pada contoh fiktif ini, API membaca harga Nasi rendang Rp28.000 lalu menyimpan ID, nama, harga, dan jumlah dalam items berbentuk JSON; dua porsi tetap tercatat Rp56.000 walaupun katalog kemudian berubah menjadi Rp30.000. Snapshot berarti salinan saat transaksi dibuat, sehingga perubahan menu tidak menulis ulang tagihan lama dan harga tetap dihitung backend, bukan model atau browser.

### Slide 26: Order terikat sesi browser pembuatnya

Bagaimana customer membaca order tanpa membuat akun? Create order aktif selalu mengikat Order ke ChatSession yang masih aktif pada tenant sama, sehingga membaca status membutuhkan sesi pemilik di browser pembuat; satu sesi dapat memiliki banyak order. FK chat_session_id memang opsional pada schema, tetapi endpoint aktif tetap mewajibkan sesi, dan ID chat atau kode order saja tidak menggantikan cookie privat yang menyimpan bukti sesi di browser.

### Slide 27: Riwayat pembayaran mencatat perubahan status

Mengapa status pembayaran memerlukan tabel riwayat? Satu Order punya nol atau banyak OrderPaymentEvent yang terikat FK tenant dan order_id, berisi from_status, to_status, serta waktu; contoh pending ke settlement hanya sah sesudah server memverifikasi signature, nominal, dan Status API sandbox. Server Key dipakai untuk API, Signature Secret Key terpisah untuk SHA512 biasa tanpa HMAC atau fallback, dan status beserta event commit bersama tanpa efek duplikat atau penurunan settlement, sementara redirect browser bukan bukti lunas.

### Slide 28: FAQ punya dokumen, versi, dan potongan teks

Mengapa knowledge dibagi menjadi tiga tabel? KnowledgeDocument adalah identitas FAQ, KnowledgeDocumentRevision menyimpan versinya, dan KnowledgeChunk menyimpan potongan teks; contoh pertanyaan fiktif tentang kursi bayi hanya boleh memakai versi published yang aktif dan berasal dari tenant sama. Satu dokumen bisa punya banyak versi dan satu versi banyak potongan, tetapi dokumen memilih paling banyak satu versi aktif, sedangkan harga, jam, dan ketersediaan tetap dibaca dari API operasional.

### Slide 29: FK gabungan mencegah meja tertukar tenant

Mengapa table_id saja belum cukup untuk menghubungkan booking? Pada contoh dua merek fiktif, booking Dapur Sela tidak boleh memakai meja milik Dapur Pagi karena FK komposit memeriksa tenant_id, outlet_id, dan table_id sekaligus terhadap DiningTable. Komposit berarti gabungan beberapa kolom yang harus cocok, melengkapi filter query serta izin server dan bukan klaim bahwa UI sudah mengelola banyak outlet.

### Slide 30: Klik dua kali tetap satu reservasi

Apa yang terjadi jika customer menekan konfirmasi dua kali? Dengan key, detail, dan sesi pembuat yang sama, request kedua mengembalikan hasil booking pertama, sementara transaksi pertama menyimpan Reservation, ReservationEvent, dan konsumsi ReservationConfirmation bersama. Idempotency berarti pengulangan tidak menambah booking, atomic berarti semua perubahan berhasil atau batal bersama, dan respons putus harus dipulihkan memakai key tetap tanpa menganggap booking gagal.

### Slide 31: Tiga pilihan desain yang perlu diingat

Apa inti rancangan data yang perlu dibawa dari paparan ini? Server mengikat tenant dan sesi, database menjaga relasi serta transaksi, dan snapshot bersama event mempertahankan fakta transaksi ketika katalog atau status berubah. Cakupan saat ini adalah demo satu tenant satu outlet, reservasi privat dan pembayaran sandbox dengan chat baca-saja, bukan bukti deployment live, UI multi-outlet, POS, delivery, refund, atau fulfillment.

## Istilah saat menjelaskan

- PK: penanda unik satu baris data.
- FK: rujukan dari satu data ke data induk; komposit berarti beberapa kolom harus cocok bersama.
- 1 dan 0..N: satu induk dapat belum memiliki anak atau memiliki banyak anak; setiap anak pada hubungan wajib menunjuk satu induk.
- 0..1: hubungan opsional, paling banyak satu; aturan endpoint bisa lebih ketat daripada schema.
- Nonce: kode sekali pakai yang mengikat ringkasan privat dengan detail yang ditinjau.
- Snapshot: salinan fakta saat transaksi dibuat, bukan hubungan hidup ke katalog.
- Atomic: seluruh perubahan dalam transaksi DB berhasil bersama atau batal bersama.
- Idempotency: mengulang permintaan yang sama tidak membuat transaksi kedua.
- Unknown: hasil belum pasti, bukan gagal atau lunas.

## Inventaris model untuk tanya jawab

Daftar ini untuk pegangan presenter, bukan dibacakan di layar. Definisi lengkap 21 tabel dan 168 kolom tetap pada [ERD Database](../ERD%20Database.md).

### Operasional

`Tenant`, `Outlet`, `WeeklyHours`, `SpecialHours`, `DiningTable`, `MenuItem`, `MenuUpload`, `OperationalAudit`.

### Akses

`Staff`, `StaffSession`, `ChatSession`.

### Reservasi

`ReservationCreatorSession`, `ReservationConfirmation`, `Reservation`, `ReservationManagementSession`, `ReservationEvent`.

### Pesanan

`Order`, `OrderPaymentEvent`.

### Pengetahuan

`KnowledgeDocument`, `KnowledgeDocumentRevision`, `KnowledgeChunk`.

WeeklyHours menyimpan jadwal reguler; SpecialHours menggantikannya pada tanggal tertentu. Baris jadwal tidak ada berarti belum dikonfigurasi, sedangkan dua jam null pada baris berarti tutup.

OperationalAudit mencatat tindakan operasional staff; ReservationEvent mencatat create/transisi booking. Ini tabel riwayat berbeda, bukan satu tabel audit semua domain.

KnowledgeDocument memiliki nol atau banyak revision, revision memiliki nol atau banyak chunk; setiap anak wajib satu induk melalui FK komposit. Pointer active_revision opsional mengarah ke revision dokumen dan tenant sama, terpisah dari relasi kepemilikan; hanya published/current masuk retrieval lexical, bukan embedding.

OrderPaymentEvent hanya bertambah saat status benar-benar berubah. Duplikat tidak membuat event tambahan, settlement tidak diturunkan, dan ready pada Snap hanya berarti akses pembayaran siap, bukan lunas.

## Batas pratinjau

PPTX memakai teks dan bentuk yang dapat diedit. PDF, PNG, dan HTML adalah pratinjau statis dari layout yang sama, bukan render native PowerPoint; periksa kembali di PowerPoint sebelum tampil. Tidak menjalankan DB, provider, server, migrasi, atau deployment untuk membuat paparan ini.
