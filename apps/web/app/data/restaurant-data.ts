export interface MenuItem {
  id: string;
  name: string;
  category: 'utama' | 'gulai' | 'sambal' | 'minuman' | 'kudapan';
  price: number;
  description: string;
  isAvailable: boolean;
  isFavorite?: boolean;
  icon: string;
  spicyLevel?: 1 | 2 | 3;
}

export interface RestaurantTable {
  id: string;
  tableNumber: string;
  capacity: number;
  area: 'Indoor AC' | 'VIP Room' | 'Semi-Outdoor';
  status: 'available' | 'reserved' | 'maintenance';
}

export interface OperatingHours {
  day: string;
  open: string;
  close: string;
  isOpen: boolean;
}

export interface RestaurantData {
  name: string;
  tagline: string;
  description: string;
  address: string;
  phone: string;
  whatsapp: string;
  email: string;
  rating: number;
  reviewCount: number;
  operatingHours: OperatingHours[];
  features: string[];
}

export const RESTAURANT_INFO: RestaurantData = {
  name: "Raso Minang",
  tagline: "Warisan Cita Rasa Autentik Minangkabau di Setiap Suapan",
  description: "Menghadirkan kelezatan tradisi marandang dari Payakumbuh dan Bukittinggi. Diracik dengan 24 rempah nusantara segar pilihan dan dimasak perlahan menggunakan tungku kayu bakar untuk aroma sedap yang tak tertandingi.",
  address: "Jl. Margonda Raya No. 450, Beji, Kota Depok, Jawa Barat 16424",
  phone: "(021) 7888-2910",
  whatsapp: "+62 812-9876-5432",
  email: "layanan@rasominang.com",
  rating: 4.9,
  reviewCount: 1420,
  operatingHours: [
    { day: "Senin - Kamis", open: "10:00", close: "21:30", isOpen: true },
    { day: "Jumat", open: "13:00", close: "22:00", isOpen: true },
    { day: "Sabtu - Minggu", open: "09:30", close: "22:00", isOpen: true }
  ],
  features: [
    "100% Halal Certified",
    "Ruang VIP Ber-AC",
    "Parkir Mobil & Bus Luas",
    "Musholla Bersih & Nyaman",
    "High-speed Free Wi-Fi",
    "Area Bermain Anak"
  ]
};

export const MENU_ITEMS: MenuItem[] = [
  {
    id: "m-01",
    name: "Rendang Daging Sapi Dapur Kayu",
    category: "utama",
    price: 32000,
    description: "Daging gandik sapi empuk dimasak 8 jam dengan santan kelapa tua dan rempah kelapa sangrai (ambum-ambum) sampai hitam kecokelatan.",
    isAvailable: true,
    isFavorite: true,
    icon: "🥩",
    spicyLevel: 2
  },
  {
    id: "m-02",
    name: "Ayam Pop Gurih Saus Tomat Tradisional",
    category: "utama",
    price: 26000,
    description: "Ayam kampung muda diungkep air kelapa dan bawang putih, digoreng kilat dalam minyak kelapa panas. Disajikan dengan cocolan saus tomat asam gurih.",
    isAvailable: true,
    isFavorite: true,
    icon: "🍗",
    spicyLevel: 1
  },
  {
    id: "m-03",
    name: "Dendeng Batokok Lado Mudo",
    category: "utama",
    price: 30000,
    description: "Irisan tipis daging sapi khas yang dipukul empuk, dipanggang di atas arang, lalu disiram racikan cabai hijau keriting Bukittinggi dan minyak kelapa.",
    isAvailable: true,
    isFavorite: true,
    icon: "🌶️",
    spicyLevel: 3
  },
  {
    id: "m-04",
    name: "Gulai Kepala Ikan Kakap Merah",
    category: "gulai",
    price: 68000,
    description: "Kepala kakap merah segar dengan kuah gulai kental kuning beraroma daun ruku-ruku, asam kandis, dan kecombrang. Porsi pas untuk 2-3 orang.",
    isAvailable: true,
    isFavorite: true,
    icon: "🐟",
    spicyLevel: 2
  },
  {
    id: "m-05",
    name: "Gulai Tunjang Sapi Lembut",
    category: "gulai",
    price: 32000,
    description: "Kikil tunjang sapi empuk kenyal dengan bumbu gulai merah rempah pekat yang meresap sempurna.",
    isAvailable: true,
    isFavorite: false,
    icon: "🍲",
    spicyLevel: 2
  },
  {
    id: "m-06",
    name: "Gulai Pucuk Daun Singkong",
    category: "gulai",
    price: 15000,
    description: "Pucuk daun singkong muda rebusan lembut dengan kuah santan gurih, serai wangi, dan kunyit asli.",
    isAvailable: true,
    isFavorite: false,
    icon: "🥬",
    spicyLevel: 1
  },
  {
    id: "m-07",
    name: "Sambal Ijo Teri Medan",
    category: "sambal",
    price: 12000,
    description: "Cabai hijau kukus kasar ditumis minyak kelapa dengan taburan teri Medan renyah gurih.",
    isAvailable: true,
    isFavorite: false,
    icon: "🌿",
    spicyLevel: 2
  },
  {
    id: "m-08",
    name: "Sambal Merah Lado Merah Dendeng",
    category: "sambal",
    price: 12000,
    description: "Sambal cabai merah ulek kasar dengan bawang merah giling yang digoreng hingga harum matang.",
    isAvailable: true,
    isFavorite: false,
    icon: "🔥",
    spicyLevel: 3
  },
  {
    id: "m-09",
    name: "Teh Talua Pinang Rempah",
    category: "minuman",
    price: 22000,
    description: "Minuman legendaris kocokan kuning telur bebek, perasan jeruk nipis, bubuk kayu manis, dan seduhan teh hitam pekat bertingkat busa creamy.",
    isAvailable: true,
    isFavorite: true,
    icon: "☕",
    spicyLevel: 1
  },
  {
    id: "m-10",
    name: "Es Tebak Padang Asli",
    category: "minuman",
    price: 24000,
    description: "Olahan mi tebak tepung beras kenyal, cincau hitam, tapai singkong, kolang-kaling manis, sirup merah, dan susu kental manis di atas es serut.",
    isAvailable: true,
    isFavorite: true,
    icon: "🍧"
  },
  {
    id: "m-11",
    name: "Jus Pinang Muda Madu",
    category: "minuman",
    price: 20000,
    description: "Segarnya sari pinang muda alami dipadukan dengan madu hutan murni untuk kesegaran dan stamina.",
    isAvailable: false,
    isFavorite: false,
    icon: "🥤"
  },
  {
    id: "m-12",
    name: "Kerupuk Kulit Jariang Kuah Gulai",
    category: "kudapan",
    price: 15000,
    description: "Kerupuk kulit sapi renyah disajikan dengan semangkuk kecil kuah gulai kental hangat untuk dicelup.",
    isAvailable: true,
    isFavorite: false,
    icon: "🍘"
  }
];

export const RESTAURANT_TABLES: RestaurantTable[] = [
  { id: "tbl-01", tableNumber: "Meja 01", capacity: 2, area: "Indoor AC", status: "available" },
  { id: "tbl-02", tableNumber: "Meja 02", capacity: 4, area: "Indoor AC", status: "available" },
  { id: "tbl-03", tableNumber: "Meja 03", capacity: 4, area: "Indoor AC", status: "available" },
  { id: "tbl-04", tableNumber: "Meja 04", capacity: 6, area: "Indoor AC", status: "reserved" },
  { id: "tbl-05", tableNumber: "Meja 05", capacity: 6, area: "Semi-Outdoor", status: "available" },
  { id: "tbl-06", tableNumber: "Meja 06", capacity: 8, area: "Semi-Outdoor", status: "available" },
  { id: "tbl-07", tableNumber: "VIP Room 01", capacity: 10, area: "VIP Room", status: "available" },
  { id: "tbl-08", tableNumber: "VIP Room 02", capacity: 12, area: "VIP Room", status: "available" }
];

export const FAQ_ITEMS = [
  {
    question: "Apakah semua hidangan di Raso Minang Halal?",
    answer: "Ya, 100% halal bersertifikat resmi MUI. Daging sapi dan ayam disembelih secara syar'i dari peternak tersertifikasi.",
    category: "Kualitas & Halal"
  },
  {
    question: "Berapa kapasitas maksimal pemesanan meja?",
    answer: "Untuk reservasi biasa melalui website, kapasitas hingga 12 orang (ruang VIP). Untuk grup lebih besar (acara keluarga/kantor), silakan hubungi hotline kami.",
    category: "Reservasi"
  },
  {
    question: "Bagaimana kebijakan pembatalan reservasi?",
    answer: "Pembatalan dapat dilakukan mandiri melalui fitur 'Kelola Reservasi' paling lambat 120 menit (2 jam) sebelum waktu kedatangan tanpa biaya.",
    category: "Kebijakan"
  },
  {
    question: "Apakah tersedia area parkir untuk kendaraan roda empat & bus?",
    answer: "Tersedia area parkir luas berkapasitas hingga 30 mobil dan aman dengan penjagaan sekuriti 24 jam.",
    category: "Fasilitas"
  }
];
