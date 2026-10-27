# Transport Model

## Alur yang diuji

```text
Agno arun → OpenRouter adapter → HTTPX BudgetTransport → MockTransport
    ↑                                                   ↓
    └──────── hasil tool → final response sintetis ───────┘
```

Agno dan adapter SDK sungguhan dijalankan, tetapi respons model berasal dari HTTPX MockTransport. Respons pertama meminta get_restaurant_info; fungsi stub dijalankan sekali; hasilnya masuk pesan tool pada request kedua; respons kedua memberikan jawaban final sintetis. Tes memblokir socket connect. Tidak ada provider eksternal, key nyata atau data customer yang dipakai.

## Batas transport

`model_transport.py` membungkus AsyncBaseTransport HTTPX. Sebelum meneruskan request, ia memeriksa metode POST, endpoint OpenRouter chat completions persis, model sesuai konfigurasi dengan suffix :free, serta melarang override models/route/plugins/provider. RequestBudget.consume dijalankan tepat sebelum forwarding. Request keempat ditolak sebelum inner transport dipanggil; request gagal tetap menghabiskan budget. Counter harus baru untuk setiap giliran.

Wrapper membatasi transport yang benar-benar dipasang padanya, bukan seluruh aplikasi. Jangan memakai SDK client lain atau transport yang tidak dibungkus untuk menjalankan model. Test membuktikan Agno memakai client HTTPX yang diinjeksikan pada adapter. Factory menerima http_client dan tool sebagai dependency injection internal; jangan menerima objek tersebut dari request customer.

Runner simulasi async terpadu sudah tersedia dan dijelaskan pada `Runner Async.md`; kedua transport wajib MockTransport. Belum tersedia runner live yang menyatukan gateway, transport dan tool jaringan sungguhan. Tool profil saat ini sinkron; deadline kooperatif tidak menjamin penghentian thread blocking. BudgetExceeded dapat dibungkus exception oleh SDK pada jalur error; status khusus budget_exhausted belum diuji menyeluruh lewat Agno. Jangan mengklaim endpoint chat siap hanya karena tes transport lulus.

## Loader konfigurasi privat

`private_config.py` menyediakan load_model_settings(path, environment). Path harus absolut. Nilai file dibaca menggunakan dotenv_values dengan interpolasi dimatikan; mapping environment eksplisit mengambil prioritas dan tidak dimutasi. Hasil divalidasi lewat ModelSettings. Missing file tetap dapat memakai environment lengkap; konfigurasi tidak lengkap ditolak.

Loader tidak dijalankan otomatis saat import/factory. Tes memakai TemporaryDirectory dengan nilai sintetis. File key pengguna tidak dibaca selama pengerjaan ini. Jangan print mapping, isi file, adapter, atau URL credential ketika memanggil loader pada tahap berikutnya. Proteksi repr ModelSettings bukan alasan melakukan dump objek lain.

## Cara verifikasi

```sh
rtk proxy uv run --project apps/assistant --locked python -m unittest discover -s apps/assistant -p "test_*.py"
```

Suite total 24 test: loop Agno dua request/sekali tool, budget transport, penolakan routing/model berbayar sebelum forwarding, loader path/precedence, serta tes schema/gateway sebelumnya. Peringatan slow task asyncio ketika import/initialization tidak berarti inference live terjadi; tidak ada koneksi jaringan yang diizinkan test loop.

## Berikutnya

Satukan runner async dan gateway, uji budget failure serta timeout sepanjang loop dengan tool async, dan lengkapi penanganan error tanpa logging sensitif. Endpoint chat, session binding, input redaction, rate limit, pemilihan katalog model dan persetujuan smoke live tetap diperlukan. Status Linear tidak diubah.

## Sources

- [HTTPX: Transports and MockTransport](https://www.python-httpx.org/advanced/transports/)
- [Agno: Building agents](https://docs.agno.com/agents/building-agents.md)
