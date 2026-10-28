"use client";

import { useState } from "react";
import Link from "next/link";
import { MENU_ITEMS, RESTAURANT_TABLES, RESTAURANT_INFO, MenuItem, RestaurantTable } from "../data/restaurant-data";

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<"menu" | "meja" | "jadwal" | "reservasi">("menu");
  const [menuList, setMenuList] = useState<MenuItem[]>(MENU_ITEMS);
  const [tableList, setTableList] = useState<RestaurantTable[]>(RESTAURANT_TABLES);
  
  // Dummy reservations state for staff monitoring
  const [reservations, setReservations] = useState([
    { id: "RSV-982144", guestName: "Hendro Wibowo", phone: "08123456789", partySize: 4, table: "Meja 02 (Indoor AC)", time: "Hari Ini, 12:30 WIB", status: "CONFIRMED" },
    { id: "RSV-412903", guestName: "Siti Rahmawati", phone: "08567890123", partySize: 8, table: "VIP Room 01", time: "Hari Ini, 19:00 WIB", status: "CONFIRMED" },
    { id: "RSV-102948", guestName: "Dimas Anggara", phone: "08198765432", partySize: 2, table: "Meja 05 (Semi-Outdoor)", time: "Besok, 13:00 WIB", status: "CONFIRMED" }
  ]);

  // Toggle availability of a menu item
  const handleToggleMenu = (id: string) => {
    setMenuList((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isAvailable: !item.isAvailable } : item
      )
    );
  };

  // Toggle table status
  const handleToggleTable = (id: string) => {
    setTableList((prev) =>
      prev.map((tbl) => {
        if (tbl.id === id) {
          const nextStatus = tbl.status === "available" ? "maintenance" : "available";
          return { ...tbl, status: nextStatus };
        }
        return tbl;
      })
    );
  };

  const handleCancelReservation = (id: string) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "CANCELLED" } : r))
    );
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingBottom: "16px", borderBottom: "1px solid var(--color-gray-200)" }}>
          <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: "var(--color-primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800 }}>
            RM
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--color-gray-900)" }}>Portal Staff</div>
            <div style={{ fontSize: "0.75rem", color: "var(--color-gray-500)" }}>Raso Minang • Margonda</div>
          </div>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <button
            className={`dashboard-nav-item ${activeTab === "menu" ? "active" : ""}`}
            onClick={() => setActiveTab("menu")}
          >
            🍛 Manajemen Menu
          </button>
          <button
            className={`dashboard-nav-item ${activeTab === "meja" ? "active" : ""}`}
            onClick={() => setActiveTab("meja")}
          >
            🪑 Manajemen Meja
          </button>
          <button
            className={`dashboard-nav-item ${activeTab === "jadwal" ? "active" : ""}`}
            onClick={() => setActiveTab("jadwal")}
          >
            ⏰ Jam Operasional
          </button>
          <button
            className={`dashboard-nav-item ${activeTab === "reservasi" ? "active" : ""}`}
            onClick={() => setActiveTab("reservasi")}
          >
            📋 Daftar Reservasi
          </button>
        </nav>

        <div style={{ marginTop: "auto", paddingTop: "16px", borderTop: "1px solid var(--color-gray-200)" }}>
          <Link href="/" className="btn btn-secondary" style={{ width: "100%", padding: "10px", fontSize: "0.85rem" }}>
            ← Kembali ke Website
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="dashboard-main">
        {/* Top Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
          <div>
            <h1 style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--color-gray-900)" }}>
              {activeTab === "menu" && "Katalog & Ketersediaan Menu"}
              {activeTab === "meja" && "Kapasitas & Status Meja"}
              {activeTab === "jadwal" && "Jadwal & Jam Buka Operasional"}
              {activeTab === "reservasi" && "Monitoring Reservasi Pelanggan"}
            </h1>
            <p style={{ color: "var(--color-gray-500)", fontSize: "0.9rem" }}>
              Panel kendali operasional staf untuk tenant <strong>demo-padang (Raso Minang)</strong>.
            </p>
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <span className="badge badge-emerald">Outlet: Margonda (Aktif)</span>
            <span className="badge badge-gray">Role: Staff Operasional</span>
          </div>
        </div>

        {/* Stats Row */}
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-label">Total Hidangan Menu</span>
            <span className="stat-value">{menuList.length}</span>
            <span style={{ fontSize: "0.78rem", color: "var(--color-emerald)", fontWeight: 600 }}>
              {menuList.filter((m) => m.isAvailable).length} Siap Disajikan
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total Meja Restoran</span>
            <span className="stat-value">{tableList.length}</span>
            <span style={{ fontSize: "0.78rem", color: "var(--color-primary)", fontWeight: 600 }}>
              {tableList.filter((t) => t.status === "available").length} Meja Tersedia
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Reservasi Hari Ini</span>
            <span className="stat-value">{reservations.filter((r) => r.status === "CONFIRMED").length}</span>
            <span style={{ fontSize: "0.78rem", color: "var(--color-accent)", fontWeight: 600 }}>
              Semua Terkonfirmasi
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Status AI Chatbot</span>
            <span className="stat-value" style={{ color: "var(--color-emerald)" }}>Aktif</span>
            <span style={{ fontSize: "0.78rem", color: "var(--color-gray-500)" }}>
              Model Gratis (Nemotron Lightning)
            </span>
          </div>
        </div>

        {/* TAB 1: MENU MANAGEMENT */}
        {activeTab === "menu" && (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama Hidangan</th>
                  <th>Kategori</th>
                  <th>Harga Resmi</th>
                  <th>Status Dapur</th>
                  <th>Aksi Cepat</th>
                </tr>
              </thead>
              <tbody>
                {menuList.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{ fontSize: "1.5rem" }}>{item.icon}</span>
                        <div>
                          <strong style={{ color: "var(--color-gray-900)" }}>{item.name}</strong>
                          {item.isFavorite && <span className="badge badge-gold" style={{ marginLeft: "8px", fontSize: "0.7rem", padding: "2px 6px" }}>Favorit</span>}
                          <div style={{ fontSize: "0.78rem", color: "var(--color-gray-500)", maxWidth: "340px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.description}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-crimson" style={{ textTransform: "capitalize", fontSize: "0.75rem" }}>
                        {item.category}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: "var(--color-primary)" }}>
                      Rp {item.price.toLocaleString("id-ID")}
                    </td>
                    <td>
                      <span className={`badge ${item.isAvailable ? "badge-emerald" : "badge-gray"}`}>
                        {item.isAvailable ? "Tersedia" : "Habis"}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleMenu(item.id)}
                        className={`btn ${item.isAvailable ? "btn-secondary" : "btn-primary"}`}
                        style={{ padding: "6px 14px", fontSize: "0.8rem" }}
                      >
                        {item.isAvailable ? "Tandai Habis" : "Tandai Tersedia"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: TABLE MANAGEMENT */}
        {activeTab === "meja" && (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nomor Meja</th>
                  <th>Area Restoran</th>
                  <th>Kapasitas Kursi</th>
                  <th>Status Operasional</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {tableList.map((tbl) => (
                  <tr key={tbl.id}>
                    <td>
                      <strong style={{ fontSize: "1rem", color: "var(--color-gray-900)" }}>{tbl.tableNumber}</strong>
                    </td>
                    <td>
                      <span className="badge badge-gold" style={{ fontSize: "0.75rem" }}>{tbl.area}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {tbl.capacity} Orang
                    </td>
                    <td>
                      <span className={`badge ${tbl.status === "available" ? "badge-emerald" : tbl.status === "reserved" ? "badge-crimson" : "badge-gray"}`}>
                        {tbl.status === "available" ? "Tersedia (Ready)" : tbl.status === "reserved" ? "Terisi / Reservasi" : "Perbaikan / Ditutup"}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleToggleTable(tbl.id)}
                        className="btn btn-secondary"
                        style={{ padding: "6px 12px", fontSize: "0.8rem" }}
                      >
                        {tbl.status === "available" ? "Kunci Meja" : "Buka Meja"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: OPERATING HOURS */}
        {activeTab === "jadwal" && (
          <div style={{ background: "#ffffff", borderRadius: "var(--radius-lg)", padding: "28px", border: "1px solid var(--color-gray-200)" }}>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "16px" }}>Jadwal Buka Reguler</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: "600px", marginBottom: "32px" }}>
              {RESTAURANT_INFO.operatingHours.map((h, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", background: "var(--color-gray-50)", borderRadius: "var(--radius-md)" }}>
                  <strong>{h.day}</strong>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <span style={{ color: "var(--color-emerald)", fontWeight: 700 }}>{h.open} - {h.close} WIB</span>
                    <span className="badge badge-emerald">Aktif</span>
                  </div>
                </div>
              ))}
            </div>

            <h3 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: "12px" }}>Aturan Pengecualian Hari Khusus (Holiday Override)</h3>
            <p style={{ color: "var(--color-gray-600)", fontSize: "0.88rem", marginBottom: "16px" }}>
              Hari libur nasional atau perayaan keagamaan (misal: Idul Fitri / Idul Adha) mengesampingkan jadwal mingguan otomatis.
            </p>
            <div style={{ background: "var(--color-warm-bg)", padding: "16px", borderRadius: "var(--radius-md)", border: "1px dashed rgba(155,27,27,0.2)" }}>
              <strong>Belum ada hari libur khusus yang dijadwalkan dalam 30 hari ke depan.</strong>
            </div>
          </div>
        )}

        {/* TAB 4: RESERVATIONS MONITOR */}
        {activeTab === "reservasi" && (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kode Booking</th>
                  <th>Nama Tamu</th>
                  <th>Kontak Telepon</th>
                  <th>Alokasi Meja</th>
                  <th>Jadwal & Tamu</th>
                  <th>Status</th>
                  <th>Aksi Staf</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((res) => (
                  <tr key={res.id}>
                    <td>
                      <strong style={{ color: "var(--color-primary)", fontFamily: "monospace", fontSize: "0.95rem" }}>
                        {res.id}
                      </strong>
                    </td>
                    <td>
                      <strong>{res.guestName}</strong>
                    </td>
                    <td style={{ color: "var(--color-gray-600)", fontSize: "0.85rem" }}>
                      {res.phone}
                    </td>
                    <td>{res.table}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{res.time}</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--color-gray-500)" }}>{res.partySize} Tamu</div>
                    </td>
                    <td>
                      <span className={`badge ${res.status === "CONFIRMED" ? "badge-emerald" : "badge-crimson"}`}>
                        {res.status}
                      </span>
                    </td>
                    <td>
                      {res.status === "CONFIRMED" ? (
                        <button
                          onClick={() => handleCancelReservation(res.id)}
                          className="btn btn-secondary"
                          style={{ padding: "6px 12px", fontSize: "0.78rem", color: "#b91c1c", borderColor: "#fca5a5" }}
                        >
                          Batalkan
                        </button>
                      ) : (
                        <span style={{ fontSize: "0.8rem", color: "var(--color-gray-400)" }}>Selesai / Batal</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
