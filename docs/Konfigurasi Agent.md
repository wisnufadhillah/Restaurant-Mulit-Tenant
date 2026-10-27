# Konfigurasi Agent

## Yang sudah tersedia

Factory `create_restaurant_agent` membangun satu agent Agno dengan satu fungsi `get_restaurant_info`. Factory tidak memanggil run/arun, tidak memuat file credential, dan tidak mengaktifkan endpoint chat. Health assistant tetap melaporkan model_enabled false karena service HTTP belum melayani inference.

Alur offline:

```text
Mapping konfigurasi eksplisit → validasi model/allowlist → OpenRouter adapter
                                                        ↓
                              satu Agent + tool profil publik terikat slug
```

## Konfigurasi privat

Template `apps/assistant/.env.example` memuat nama variabel kosong. Untuk nanti menjalankan model, pengguna menyiapkan file privat sendiri:

- OPENROUTER_API_KEY: key server-only, jangan kirim ke browser/chat/log.
- OPENROUTER_MODEL: ID model terpilih dengan suffix :free.
- OPENROUTER_ALLOWED_MODELS: daftar ID gratis yang disetujui, dipisahkan koma. Model terpilih harus masuk daftar ini.

Jangan mengisi nama model contoh dari unit test sebagai model sungguhan. Test memakai identifier sintetis dan tidak memeriksa katalog provider. Factory menerima mapping melalui ModelSettings.from_environment; nama method tidak berarti file .env dimuat otomatis. Loader file privat eksplisit sudah tersedia di private_config.py, tetapi belum dipanggil oleh service HTTP. Endpoint inference belum diimplementasikan. Tidak perlu key nyata untuk menjalankan tes offline.

Validasi menolak model berbayar, model tidak masuk allowlist, allowlist kosong atau key kosong. Dataclass menyembunyikan key dari repr; jangan melakukan dump seluruh dataclass atau adapter karena masih dapat memuat credential. Factory memvalidasi ulang meski settings dibuat langsung.

Suffix :free dan allowlist adalah pembatas konfigurasi, bukan bukti model masih tersedia atau tool calling didukung. Sebelum live, periksa katalog, harga, kemampuan tools, kebijakan provider dan kuota. Tidak ada fallback model berbayar maupun model cadangan otomatis yang dikonfigurasi.

## Pembatas agent

- Hanya satu tool profil publik, tidak ada SQL, write tools, memory/database agent atau pencarian web.
- tool_call_limit satu pada loop agent; output model maksimal 512 token; timeout adapter sepuluh detik; retry adapter/SDK/agent nol.
- Debug dan telemetry Agno dimatikan; history tidak ditambahkan otomatis ke konteks.
- Tool API memiliki timeout lima detik dan batas payload 64 KiB.

Tool-call limit bukan hard cap seluruh request inferensi dan bukan deadline end-to-end. Batas request total, pembatalan deadline, redaksi input, rate limit, gateway sesi, dan error-to-fallback yang teruji masih wajib sebelum endpoint inference dibuka. Instruksi agent untuk fallback bukan pengganti kode penanganan kegagalan.

## Schema respons tool

`restaurant_schema.py` memakai Pydantic dengan extra fields forbidden dan strict mode. Respons memerlukan data profil publik, daftar outlet berskema, source restaurant_api dan timestamp dengan timezone. Nilai angka kebijakan harus integer dengan batas positif/nonnegatif; boolean atau string angka bukan pengganti integer.

Timezone dibatasi Asia/Jakarta untuk demo; jangan memperluas data outlet ke timezone lain tanpa perubahan schema dan tes. Field privat atau tambahan tak dikenal ditolak, bukan diteruskan ke model. Respons valid dikembalikan sebagai dict JSON yang sudah dinormalisasi. Slug hasil tetap dibandingkan dengan konteks tool.

Validasi struktural tidak membuktikan kebenaran semua fakta atau menghilangkan prompt injection. String profil masih data tak tepercaya. Jadwal, harga menu dan slot belum ada dalam tool; agent diperintahkan tidak menebaknya.

## Pemeriksaan

```sh
rtk proxy uv run --project apps/assistant --locked python -m unittest discover -s apps/assistant -p "test_*.py"
rtk proxy uv run --project apps/assistant --locked python scripts/smoke_restaurant_tool.py
```

Sebelas unit test mencakup import dasar, URL/context, argumen model tenant, respons tenant salah, timeout, JSON rusak/oversize/schema invalid, konfigurasi berbayar/tidak lengkap, repr key dan konstruksi agent offline. Test konstruksi memblokir socket connect dan memakai konfigurasi sintetis; tidak menjalankan loop agent atau inference.

Smoke terpisah membaca dua katalog dari API dan PostgreSQL lokal melalui wrapper dengan schema baru. Tidak memanggil OpenRouter. Proses API sementara dihentikan sesudah pemeriksaan; port 3001 harus kosong.

## Langkah menuju live

- Gateway runner offline dengan budget kooperatif, timeout dan fallback deterministik tersedia; lihat `Gateway Eksekusi.md`. Instrumentasi request transport Agno dan deadline terhadap I/O nyata belum tersedia.
- Loader file privat dan precedence sudah diuji menggunakan file sintetis; nilai key pengguna belum dibaca.
- Loop Agno dengan request tool dan final response sintetis sudah diuji lewat MockTransport; penghitungan budget dan penolakan override teruji di transport. Lihat `Transport Model.md`; runner gabungan dan failure path penuh masih perlu.
- Tentukan model gratis yang benar-benar tersedia dan minta persetujuan inference live menggunakan data sintetis.
- Setelah itu baru jalankan smoke live; catat model/provider, jumlah request, tool call, latensi serta kegagalan. Tidak ada klaim tool calling live berhasil sebelum bukti tersebut tersedia.

## Sources

- [Agno: Building agents](https://docs.agno.com/agents/building-agents.md)
- [Agno: Tool call limit](https://docs.agno.com/tools/tool-call-limit.md)
- [Agno: Tools overview](https://docs.agno.com/tools/overview.md)
