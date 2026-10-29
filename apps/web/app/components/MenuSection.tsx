"use client";

import { useEffect, useState } from "react";
import { MENU_ITEMS, MenuItem } from "../data/restaurant-data";
import { fetchRestaurantMenu } from "../data/restaurant-api";

export default function MenuSection() {
  const [selectedCategory, setSelectedCategory] = useState<string>("semua");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedDish, setSelectedDish] = useState<MenuItem | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>(MENU_ITEMS);

  useEffect(() => {
    let active = true;
    fetchRestaurantMenu().then((items) => { if (active) setMenuItems(items); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const categories = [
    { key: "semua", label: "Semua Hidangan" },
    { key: "utama", label: "Makanan Utama" },
    { key: "gulai", label: "Gulai & Kuah" },
    { key: "sambal", label: "Sambal Khas" },
    { key: "minuman", label: "Minuman Tradisional" },
    { key: "kudapan", label: "Kudapan & Pelengkap" },
  ];

  const filteredItems = menuItems.filter((item) => {
    const matchesCategory = selectedCategory === "semua" || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(num);
  };

  return (
    <section className="section section-alt" id="menu">
      <div className="container">
        <div className="section-header">
          <span className="section-tag">Katalog Rasa & Cita Rasa</span>
          <h2 className="section-title">Buku Menu Pilihan Kami</h2>
          <p className="section-subtitle">
            Setiap hidangan diolah dari rempah asli ranah Minang, santan kelapa tua murni, dan dimasak perlahan untuk menghasilkan kelezatan mendalam.
          </p>
        </div>

        {/* Controls: Category Tabs & Search Bar */}
        <div className="menu-controls">
          <div className="category-tabs" role="tablist">
            {categories.map((cat) => (
              <button
                key={cat.key}
                role="tab"
                aria-selected={selectedCategory === cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={`category-tab-btn ${selectedCategory === cat.key ? "active" : ""}`}
                id={`menu-cat-${cat.key}`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="menu-search-box">
            <label htmlFor="menu-search-input" className="sr-only">Cari menu</label>
            <svg className="menu-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              className="menu-search-input"
              placeholder="Cari rendang, ayam pop, teh talua..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              id="menu-search-input"
            />
          </div>
        </div>

        {/* Menu Grid */}
        <div className="menu-grid">
          {filteredItems.map((item) => (
            <div 
              key={item.id} 
              className="menu-card"
              onClick={() => setSelectedDish(item)}
              style={{ cursor: "pointer" }}
              id={`dish-card-${item.id}`}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                  <div className="menu-card-dish-icon">
                    <span>{item.icon}</span>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {item.isFavorite && (
                      <span className="badge badge-gold">Favorit</span>
                    )}
                    {item.isAvailable ? (
                      <span className="badge badge-emerald">Tersedia</span>
                    ) : (
                      <span className="badge badge-gray">Habis</span>
                    )}
                  </div>
                </div>

                <div className="menu-card-details">
                  <h3 className="menu-card-title">{item.name}</h3>
                  <p className="menu-card-desc">{item.description}</p>
                </div>
              </div>

              <div className="menu-card-bottom">
                <div>
                  <span style={{ fontSize: "0.75rem", color: "var(--color-gray-500)", display: "block" }}>Harga Per Porsi</span>
                  <span className="menu-card-price">{formatRupiah(item.price)}</span>
                </div>
                <button 
                  className="btn btn-secondary" 
                  style={{ padding: "8px 14px", fontSize: "0.82rem" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDish(item);
                  }}
                >
                  Detail Hidangan
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredItems.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--color-gray-500)" }}>
            <p style={{ fontSize: "1.1rem" }}>Tidak ada hidangan yang cocok dengan kata kunci &quot;{searchQuery}&quot;.</p>
            <button 
              className="btn btn-secondary" 
              style={{ marginTop: "16px" }}
              onClick={() => { setSelectedCategory("semua"); setSearchQuery(""); }}
            >
              Reset Pencarian
            </button>
          </div>
        )}
      </div>

      {/* Dish Detail Modal */}
      {selectedDish && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1100,
          padding: "20px"
        }} onClick={() => setSelectedDish(null)}>
          <div style={{
            background: "#ffffff",
            borderRadius: "var(--radius-xl)",
            maxWidth: "520px",
            width: "100%",
            padding: "32px",
            boxShadow: "var(--shadow-xl)",
            border: "1px solid rgba(155, 27, 27, 0.12)"
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <span className="badge badge-crimson" style={{ textTransform: "capitalize" }}>{selectedDish.category}</span>
              <button 
                onClick={() => setSelectedDish(null)}
                style={{ fontSize: "1.2rem", color: "var(--color-gray-500)", padding: "4px 8px" }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: "3.5rem", textAlign: "center", margin: "10px 0" }}>
              {selectedDish.icon}
            </div>

            <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "1.6rem", color: "var(--color-gray-900)", marginBottom: "8px" }}>
              {selectedDish.name}
            </h3>

            <p style={{ color: "var(--color-gray-600)", lineHeight: 1.6, marginBottom: "20px" }}>
              {selectedDish.description}
            </p>

            <div style={{
              background: "var(--color-warm-bg)",
              padding: "16px 20px",
              borderRadius: "var(--radius-md)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "24px"
            }}>
              <div>
                <span style={{ fontSize: "0.8rem", color: "var(--color-gray-500)", display: "block" }}>Status Dapur</span>
                <strong style={{ color: selectedDish.isAvailable ? "var(--color-emerald)" : "var(--color-primary)" }}>
                  {selectedDish.isAvailable ? "✓ Siap Disajikan Hari Ini" : "✕ Sedang Habis"}
                </strong>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "0.8rem", color: "var(--color-gray-500)", display: "block" }}>Harga Resmi</span>
                <span style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--color-primary)" }}>
                  {formatRupiah(selectedDish.price)}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <a 
                href="#reservasi" 
                onClick={() => setSelectedDish(null)}
                className="btn btn-primary" 
                style={{ flex: 1 }}
              >
                Reservasi Meja & Nikmati
              </a>
              <button 
                onClick={() => setSelectedDish(null)}
                className="btn btn-secondary" 
                style={{ flex: 1 }}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
interface PublicMenu { id: string; name: string; description: string; price: number; isAvailable: boolean; }
const images: Record<string, [string, string]> = {
  "Rendang sapi": ["padang-rendang", "Rendang sapi berbumbu gelap di atas daun pisang"],
  "Gulai ayam": ["padang-gulai", "Gulai ayam berkuah kuning disajikan dalam mangkuk"],
  "Dendeng balado": ["padang-dendeng", "Dendeng sapi dengan sambal balado merah"],
};

export default async function MenuSection() {
  let items: PublicMenu[] = [], unavailable = false;
  try {
    const response = await fetch("http://127.0.0.1:3001/api/v1/public/tenants/demo-padang/menu", { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("Menu unavailable");
    items = (await response.json()).data;
  } catch { unavailable = true; }
  return <section className="senja-section sela-menu" id="menu" aria-labelledby="menu-heading">
    <p className="senja-eyebrow">DARI MEJA KAMI</p><h2 id="menu-heading">Sepiring nasi, pilihan lauk Padang.</h2>
    <p className="senja-note">Harga dan ketersediaan dari katalog restoran. Data sintetis untuk demo; gambar merupakan ilustrasi.</p>
    {unavailable ? <p role="status">Menu belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.</p> : items.length === 0 ? <p>Belum ada menu yang dipublikasikan.</p> : <div className="senja-dishes">{items.map(dish => <article key={dish.id}>
      {images[dish.name] ? <img src={`/images/${images[dish.name][0]}.webp`} alt={images[dish.name][1]} width="1376" height="768" loading="lazy" /> : <div className="sela-menu-photo-placeholder"><span>{dish.name}</span><small>Foto hidangan belum tersedia</small></div>}
      <div className="sela-dish-heading"><h3>{dish.name}</h3><span>{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(dish.price)}</span></div>
      <p>{dish.description}</p><span className="sela-sample-label">{dish.isAvailable ? "Tersedia" : "Habis"}</span>
    </article>)}</div>}
  </section>;
}
