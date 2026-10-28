import Navbar from "./components/Navbar";
import MenuSection from "./components/MenuSection";
import ReservationSection from "./components/ReservationSection";
import ChatbotWidget from "./components/ChatbotWidget";
import { RESTAURANT_INFO } from "./data/restaurant-data";
import Link from "next/link";

export default function Home() {
  return (
    <>
      <Navbar />

      <main>
        {/* HERO SECTION */}
        <section className="hero-section" id="beranda">
          <div className="container">
            <div className="hero-grid">
              <div className="hero-content">
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <span className="badge badge-crimson">Authentic Minangkabau Kitchen</span>
                  <span className="badge badge-gold">⭐ 4.9 / 5 (1,400+ Ulasan Puas)</span>
                </div>

                <h1 className="hero-title">
                  Warisan Cita Rasa <span>Autentik Minangkabau</span> di Setiap Suapan
                </h1>

                <p className="hero-subtitle">
                  Menghadirkan kelezatan legendaris masakan Padang dari Payakumbuh dan Bukittinggi. Diracik dengan 24 rempah nusantara segar dan santan kelapa tua murni yang dimasak perlahan di atas tungku kayu bakar.
                </p>

                <div className="hero-cta-group">
                  <a href="#reservasi" className="btn btn-primary" id="hero-btn-reservasi">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    Pesan Meja Sekarang
                  </a>
                  <a href="#menu" className="btn btn-secondary" id="hero-btn-menu">
                    Buku Menu Lengkap
                  </a>
                </div>

                <div className="hero-badges-row">
                  <div className="hero-badge-item">
                    <span style={{ color: "var(--color-emerald)", fontSize: "1.2rem" }}>✓</span>
                    <span>100% Halal MUI</span>
                  </div>
                  <div className="hero-badge-item">
                    <span style={{ color: "var(--color-accent)", fontSize: "1.2rem" }}>🔥</span>
                    <span>Tungku Kayu Bakar</span>
                  </div>
                  <div className="hero-badge-item">
                    <span style={{ color: "var(--color-primary)", fontSize: "1.2rem" }}>🪑</span>
                    <span>Slot Meja Real-time</span>
                  </div>
                </div>
              </div>

              {/* Hero Visual Card */}
              <div className="hero-visual">
                <div className="hero-card-featured">
                  <div className="hero-dish-image-wrap">
                    <div className="hero-dish-badge badge badge-gold">
                      👑 Resep Mahkota Restoran
                    </div>
                    <div style={{ fontSize: "5rem", marginBottom: "10px", filter: "drop-shadow(0 10px 15px rgba(0,0,0,0.5))" }}>
                      🥩
                    </div>
                    <div style={{ textAlign: "center", padding: "0 20px" }}>
                      <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "1.45rem", fontWeight: 700 }}>
                        Rendang Daging Sapi Payakumbuh
                      </h3>
                      <p style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.85)", marginTop: "4px" }}>
                        Dimasak 8 Jam Tanpa Henti • Daging Gandik Empuk Meresap
                      </p>
                    </div>
                  </div>

                  <div style={{ marginTop: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontSize: "0.8rem", color: "var(--color-gray-500)", display: "block" }}>Porsi Rekomendasi</span>
                      <strong style={{ fontSize: "1.3rem", color: "var(--color-primary)" }}>Rp 32.000</strong>
                    </div>
                    <span className="badge badge-emerald">Tersedia Hari Ini</span>
                  </div>

                  <div className="hero-floating-tag">
                    <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", fontWeight: 800 }}>
                      90m
                    </div>
                    <div>
                      <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--color-gray-900)" }}>Durasi Santap Santai</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--color-gray-500)" }}>Bebas antre dengan reservasi</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TENTANG KAMI SECTION */}
        <section className="section" id="tentang">
          <div className="container">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "60px", alignItems: "center" }}>
              <div>
                <span className="section-tag">Kisah & Filosofi Dapur</span>
                <h2 className="section-title" style={{ textAlign: "left", marginBottom: "20px" }}>
                  Menjaga Marwah Masakan Minang Asli
                </h2>
                <p style={{ color: "var(--color-gray-600)", lineHeight: 1.7, marginBottom: "16px" }}>
                  Di {RESTAURANT_INFO.name}, kami memegang teguh petuah adat: <em>&quot;Kari karang, rami baralek, lamak makan di Rumah Makan.&quot;</em> Kami tidak menggunakan bumbu instan atau pengawet. Setiap subuh, para koki kami menumbuk cabai segar, memarut kelapa tua pilihan, dan meracik rempah aromatik.
                </p>
                <p style={{ color: "var(--color-gray-600)", lineHeight: 1.7, marginBottom: "28px" }}>
                  Mulai dari Ayam Pop berkuah minyak kelapa gurih, Dendeng Batokok bertabur cabai hijau muda, hingga Gulai Kepala Kakap Merah yang harum semerbak daun ruku-ruku — setiap santapan adalah jamuan penuh kehormatan bagi Anda.
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  <div style={{ background: "#ffffff", padding: "18px", borderRadius: "var(--radius-md)", border: "1px solid rgba(155,27,27,0.1)" }}>
                    <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--color-primary)", marginBottom: "4px" }}>24+</div>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--color-gray-900)" }}>Rempah Segar</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--color-gray-500)" }}>Didatangkan langsung dari sentra rempah Sumatera Barat.</div>
                  </div>
                  <div style={{ background: "#ffffff", padding: "18px", borderRadius: "var(--radius-md)", border: "1px solid rgba(155,27,27,0.1)" }}>
                    <div style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--color-accent)", marginBottom: "4px" }}>8 Jam</div>
                    <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--color-gray-900)" }}>Proses Marandang</div>
                    <div style={{ fontSize: "0.8rem", color: "var(--color-gray-500)" }}>Ketelatenan api kecil tungku menghasilkan minyak kelapa karamel alami.</div>
                  </div>
                </div>
              </div>

              <div style={{ background: "linear-gradient(135deg, rgba(155,27,27,0.06), rgba(217,119,6,0.08))", borderRadius: "var(--radius-xl)", padding: "40px", border: "1px solid rgba(155,27,27,0.1)" }}>
                <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "1.6rem", color: "var(--color-gray-900)", marginBottom: "20px" }}>
                  Fasilitas & Standar Layanan Kami
                </h3>
                <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "14px" }}>
                  {RESTAURANT_INFO.features.map((feat, idx) => (
                    <li key={idx} style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "0.95rem", color: "var(--color-gray-700)" }}>
                      <span style={{ width: "24px", height: "24px", borderRadius: "50%", background: "var(--color-emerald-light)", color: "var(--color-emerald)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.8rem", flexShrink: 0 }}>✓</span>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <div style={{ marginTop: "32px", paddingTop: "24px", borderTop: "1px solid rgba(155,27,27,0.12)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: "0.8rem", color: "var(--color-gray-500)", display: "block" }}>Area Makan Tersedia:</span>
                    <strong style={{ fontSize: "0.95rem", color: "var(--color-gray-800)" }}>Indoor AC • VIP Room • Semi-Outdoor</strong>
                  </div>
                  <a href="#reservasi" className="btn btn-secondary" style={{ padding: "8px 16px", fontSize: "0.85rem" }}>
                    Cek Meja →
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* MENU SECTION */}
        <MenuSection />

        {/* RESERVATION SECTION */}
        <ReservationSection />

        {/* LOKASI & JAM OPERASIONAL SECTION */}
        <section className="section section-alt" id="lokasi">
          <div className="container">
            <div className="section-header">
              <span className="section-tag">Kunjungi Rumah Makan Kami</span>
              <h2 className="section-title">Lokasi & Jam Buka Outlet</h2>
              <p className="section-subtitle">
                Suasana nyaman, sejuk, dan asri untuk bersantap bersama keluarga, kolega bisnis, maupun acara syukuran.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "40px", alignItems: "start" }}>
              {/* Alamat & Maps Preview Card */}
              <div style={{ background: "#ffffff", borderRadius: "var(--radius-xl)", border: "1px solid var(--color-gray-200)", padding: "32px", boxShadow: "var(--shadow-md)" }}>
                <span className="badge badge-crimson" style={{ marginBottom: "14px" }}>Outlet Utama</span>
                <h3 style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--color-gray-900)", marginBottom: "8px" }}>
                  {RESTAURANT_INFO.name} — Margonda Raya
                </h3>
                <p style={{ color: "var(--color-gray-600)", lineHeight: 1.6, marginBottom: "20px" }}>
                  📍 {RESTAURANT_INFO.address}
                </p>

                <div style={{ background: "var(--color-gray-100)", borderRadius: "var(--radius-lg)", height: "200px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--color-gray-500)", marginBottom: "20px", border: "1px dashed var(--color-gray-300)" }}>
                  <span style={{ fontSize: "2.5rem", marginBottom: "8px" }}>🗺️</span>
                  <strong style={{ color: "var(--color-gray-700)" }}>Peta Lokasi Interaktif</strong>
                  <span style={{ fontSize: "0.82rem" }}>Akses mudah 5 menit dari Tol Kukusan / Margonda</span>
                </div>

                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <a 
                    href="https://maps.google.com" 
                    target="_blank" 
                    rel="noreferrer" 
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                  >
                    Buka di Google Maps
                  </a>
                  <a 
                    href={`https://wa.me/${RESTAURANT_INFO.whatsapp.replace(/[^0-9]/g, "")}`} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                  >
                    Chat WhatsApp
                  </a>
                </div>
              </div>

              {/* Jam Buka Table */}
              <div style={{ background: "var(--color-dark)", color: "#ffffff", borderRadius: "var(--radius-xl)", padding: "32px" }}>
                <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "1.4rem", marginBottom: "18px", color: "#ffffff" }}>
                  Jadwal Operasional Restoran
                </h3>

                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {RESTAURANT_INFO.operatingHours.map((sched, idx) => (
                    <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "12px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                      <span style={{ color: "var(--color-gray-300)", fontWeight: 600 }}>{sched.day}</span>
                      <strong style={{ color: "var(--color-accent)", fontSize: "0.95rem" }}>
                        {sched.open} - {sched.close} WIB
                      </strong>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: "24px", background: "rgba(255,255,255,0.06)", padding: "16px", borderRadius: "var(--radius-md)" }}>
                  <div style={{ fontSize: "0.85rem", color: "var(--color-gray-300)", display: "flex", gap: "8px", alignItems: "center" }}>
                    <span>ℹ️</span>
                    <span>Reservasi terakhir diterima pukul <strong>20:30 WIB</strong> setiap harinya.</span>
                  </div>
                </div>

                <div style={{ marginTop: "24px", textAlign: "center" }}>
                  <a href="#reservasi" className="btn btn-accent" style={{ width: "100%" }}>
                    Amankan Meja Sekarang
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="footer">
        <div className="container">
          <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: "40px", paddingBottom: "40px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "var(--radius-md)", background: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800 }}>
                  RM
                </div>
                <strong style={{ fontFamily: "var(--font-serif)", fontSize: "1.4rem", color: "#ffffff" }}>
                  {RESTAURANT_INFO.name}
                </strong>
              </div>
              <p style={{ color: "var(--color-gray-400)", fontSize: "0.88rem", lineHeight: 1.6, maxWidth: "340px" }}>
                Restoran Masakan Padang Autentik dengan warisan rasa Payakumbuh dan Bukittinggi. Sistem reservasi modern & layanan ramah.
              </p>
            </div>

            <div>
              <h4 style={{ color: "#ffffff", fontSize: "0.95rem", marginBottom: "14px", fontWeight: 700 }}>Navigasi Cepat</h4>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.88rem", color: "var(--color-gray-400)" }}>
                <li><a href="#beranda" style={{ color: "inherit" }}>Beranda</a></li>
                <li><a href="#tentang" style={{ color: "inherit" }}>Tentang Restoran</a></li>
                <li><a href="#menu" style={{ color: "inherit" }}>Buku Menu</a></li>
                <li><a href="#reservasi" style={{ color: "inherit" }}>Pesan Meja</a></li>
              </ul>
            </div>

            <div>
              <h4 style={{ color: "#ffffff", fontSize: "0.95rem", marginBottom: "14px", fontWeight: 700 }}>Kontak & Bantuan</h4>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.88rem", color: "var(--color-gray-400)" }}>
                <li>Telp: {RESTAURANT_INFO.phone}</li>
                <li>WA: {RESTAURANT_INFO.whatsapp}</li>
                <li>Email: {RESTAURANT_INFO.email}</li>
              </ul>
            </div>

            <div>
              <h4 style={{ color: "#ffffff", fontSize: "0.95rem", marginBottom: "14px", fontWeight: 700 }}>Internal Staff</h4>
              <p style={{ fontSize: "0.82rem", color: "var(--color-gray-400)", marginBottom: "12px" }}>
                Kelola menu, ketersediaan meja, dan jadwal outlet.
              </p>
              <Link href="/dashboard" className="btn btn-secondary" style={{ padding: "8px 14px", fontSize: "0.82rem", background: "transparent", color: "#ffffff", borderColor: "rgba(255,255,255,0.3)" }}>
                Buka Dashboard Staff →
              </Link>
            </div>
          </div>

          <div style={{ paddingTop: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", fontSize: "0.82rem", color: "var(--color-gray-500)" }}>
            <div>
              © 2026 {RESTAURANT_INFO.name}. Hak Cipta Dilindungi Undang-Undang.
            </div>
            <div>
              Designed & Built for Phase 2: Website dan Data Restoran.
            </div>
          </div>
        </div>
      </footer>

      {/* FLOATING CHATBOT WIDGET */}
      <ChatbotWidget />
    </>
  );
}
