"use client";

import { useState } from "react";
import { RESTAURANT_TABLES, RestaurantTable } from "../data/restaurant-data";

export default function ReservationSection() {
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("12:00");
  const [partySize, setPartySize] = useState<number>(2);
  const [areaPreference, setAreaPreference] = useState<string>("Indoor AC");
  
  // Step in reservation: 1: Form & Check, 2: Proposal Review, 3: Confirmed Receipt
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [guestName, setGuestName] = useState<string>("");
  const [guestPhone, setGuestPhone] = useState<string>("");
  const [specialNotes, setSpecialNotes] = useState<string>("");

  const [availableTables, setAvailableTables] = useState<RestaurantTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<RestaurantTable | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Confirmed Receipt State
  const [receipt, setReceipt] = useState<{
    referenceCode: string;
    managementToken: string;
    table: string;
    partySize: number;
    dateTime: string;
    guestName: string;
    status: string;
  } | null>(null);

  // Check Availability Logic (Adhering to PRD: capacity, time, operating hours)
  const handleCheckAvailability = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!date) {
      setErrorMessage("Silakan pilih tanggal reservasi.");
      return;
    }

    const selectedDateTime = new Date(`${date}T${time}`);
    const now = new Date();
    
    // Check 1: Cannot book past date
    if (selectedDateTime < now) {
      setErrorMessage("Waktu reservasi tidak boleh di masa lampau.");
      return;
    }

    // Check 2: Minimum notice 60 minutes
    const diffMinutes = (selectedDateTime.getTime() - now.getTime()) / (1000 * 60);
    if (diffMinutes < 60) {
      setErrorMessage("Pemesanan membutuhkan pemberitahuan minimal 60 menit sebelum kedatangan.");
      return;
    }

    // Check 3: Max advance 30 days
    const diffDays = diffMinutes / (60 * 24);
    if (diffDays > 30) {
      setErrorMessage("Pemesanan maksimal dapat dilakukan 30 hari sebelumnya.");
      return;
    }

    setIsChecking(true);
    setTimeout(() => {
      // Find matching available tables
      const matched = RESTAURANT_TABLES.filter((t) => {
        const capacityMatch = t.capacity >= partySize;
        const areaMatch = areaPreference === "Semua" || t.area === areaPreference;
        const statusMatch = t.status === "available";
        return capacityMatch && areaMatch && statusMatch;
      });

      setIsChecking(false);
      if (matched.length === 0) {
        setErrorMessage("Maaf, tidak ada meja kosong yang sesuai dengan kapasitas dan area pada waktu tersebut. Coba ganti area atau jam kedatangan.");
      } else {
        setAvailableTables(matched);
        setSelectedTable(matched[0]);
      }
    }, 400);
  };

  const handleProceedToProposal = () => {
    if (!guestName.trim() || !guestPhone.trim()) {
      setErrorMessage("Nama pemesan dan nomor telepon wajib diisi untuk verifikasi reservasi.");
      return;
    }
    setErrorMessage("");
    setStep(2);
  };

  const handleConfirmReservation = () => {
    // Atomic confirmation simulation
    const randomCode = "RSV-" + Math.floor(100000 + Math.random() * 900000);
    const fakeToken = "mgt_" + Math.random().toString(36).substring(2, 12);
    
    setReceipt({
      referenceCode: randomCode,
      managementToken: fakeToken,
      table: selectedTable?.tableNumber || "Meja M-01",
      partySize: partySize,
      dateTime: `${date} pukul ${time} WIB`,
      guestName: guestName,
      status: "CONFIRMED"
    });
    setStep(3);
  };

  const handleReset = () => {
    setStep(1);
    setSelectedTable(null);
    setAvailableTables([]);
    setReceipt(null);
    setErrorMessage("");
  };

  // Set default min date to today
  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <section className="section" id="reservasi">
      <div className="container">
        <div className="section-header">
          <span className="section-tag">Pemesanan Meja Langsung</span>
          <h2 className="section-title">Reservasi Meja Restoran</h2>
          <p className="section-subtitle">
            Pastikan momen bersantap Anda dan keluarga terjamin tanpa antre. Sistem kami memvalidasi slot meja secara real-time.
          </p>
        </div>

        <div className="reservation-container">
          {/* Left Info Card */}
          <div className="reservation-info-card">
            <div>
              <span className="badge badge-gold" style={{ marginBottom: "12px" }}>Aturan Reservasi</span>
              <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "1.8rem", color: "#ffffff", marginBottom: "8px" }}>
                Komitmen Kenyamanan Anda
              </h3>
              <p style={{ color: "var(--color-gray-300)", lineHeight: 1.6, fontSize: "0.95rem" }}>
                Meja langsung berstatus <strong style={{ color: "#34d399" }}>CONFIRMED</strong> setelah persetujuan. Tidak ada biaya pemesanan awal.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "rgba(217,119,6,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-accent)", flexShrink: 0 }}>
                  ⏱️
                </div>
                <div>
                  <h4 style={{ color: "#ffffff", fontSize: "0.95rem", marginBottom: "2px" }}>Durasi Santap 90 Menit</h4>
                  <p style={{ color: "var(--color-gray-400)", fontSize: "0.85rem" }}>Waktu cukup dan nyaman untuk menikmati hidangan hidang khas Minang.</p>
                </div>
              </div>

              <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "rgba(5,150,105,0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#34d399", flexShrink: 0 }}>
                  🔒
                </div>
                <div>
                  <h4 style={{ color: "#ffffff", fontSize: "0.95rem", marginBottom: "2px" }}>Privasi Terlindungi</h4>
                  <p style={{ color: "var(--color-gray-400)", fontSize: "0.85rem" }}>Kontak hanya digunakan untuk verifikasi kedatangan dan pembatalan resmi.</p>
                </div>
              </div>

              <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "rgba(155,27,27,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171", flexShrink: 0 }}>
                  🔄
                </div>
                <div>
                  <h4 style={{ color: "#ffffff", fontSize: "0.95rem", marginBottom: "2px" }}>Batal Mandiri Mudah</h4>
                  <p style={{ color: "var(--color-gray-400)", fontSize: "0.85rem" }}>Bisa dibatalkan via kode referensi & token privat hingga 2 jam sebelum jadwal.</p>
                </div>
              </div>
            </div>

            <div style={{ background: "rgba(255,255,255,0.06)", padding: "16px 20px", borderRadius: "var(--radius-md)", border: "1px solid rgba(255,255,255,0.1)" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--color-gray-400)", display: "block" }}>Butuh Bantuan Cepat?</span>
              <strong style={{ color: "#ffffff", fontSize: "1.1rem" }}>Hubungi Hotline: (021) 7888-2910</strong>
            </div>
          </div>

          {/* Right Form Card */}
          <div className="reservation-form-card">
            {errorMessage && (
              <div style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#b91c1c",
                padding: "12px 16px",
                borderRadius: "var(--radius-md)",
                fontSize: "0.9rem",
                marginBottom: "20px"
              }}>
                ⚠️ {errorMessage}
              </div>
            )}

            {step === 1 && (
              <div>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--color-gray-900)", marginBottom: "18px" }}>
                  1. Pilih Waktu & Cek Ketersediaan Meja
                </h3>

                <form onSubmit={handleCheckAvailability}>
                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label" htmlFor="res-date">Tanggal Reservasi</label>
                      <input
                        type="date"
                        id="res-date"
                        min={todayStr}
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="form-input"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="res-time">Jam Kedatangan</label>
                      <select
                        id="res-time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="form-select"
                      >
                        <option value="11:00">11:00 WIB (Makan Siang)</option>
                        <option value="12:00">12:00 WIB (Makan Siang)</option>
                        <option value="13:00">13:00 WIB (Makan Siang)</option>
                        <option value="14:00">14:00 WIB (Siang Santai)</option>
                        <option value="17:30">17:30 WIB (Makan Malam)</option>
                        <option value="18:30">18:30 WIB (Makan Malam)</option>
                        <option value="19:30">19:30 WIB (Makan Malam)</option>
                        <option value="20:30">20:30 WIB (Malam)</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-grid-2">
                    <div className="form-group">
                      <label className="form-label" htmlFor="res-party">Jumlah Tamu</label>
                      <select
                        id="res-party"
                        value={partySize}
                        onChange={(e) => setPartySize(Number(e.target.value))}
                        className="form-select"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 10, 12].map((num) => (
                          <option key={num} value={num}>
                            {num} Orang {num >= 8 ? "(Disarankan VIP)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="res-area">Preferensi Area</label>
                      <select
                        id="res-area"
                        value={areaPreference}
                        onChange={(e) => setAreaPreference(e.target.value)}
                        className="form-select"
                      >
                        <option value="Indoor AC">Indoor Ber-AC</option>
                        <option value="VIP Room">VIP Room (Privat)</option>
                        <option value="Semi-Outdoor">Semi-Outdoor Asri</option>
                        <option value="Semua">Bebas / Meja Mana Saja</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ width: "100%", marginTop: "10px" }}
                    disabled={isChecking}
                    id="btn-check-table"
                  >
                    {isChecking ? "Memeriksa Slot Database..." : "🔍 Cek Ketersediaan Meja"}
                  </button>
                </form>

                {/* Available Tables List */}
                {availableTables.length > 0 && (
                  <div style={{ marginTop: "28px", paddingTop: "24px", borderTop: "1px solid var(--color-gray-200)" }}>
                    <h4 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--color-emerald)", marginBottom: "12px" }}>
                      ✓ Meja Tersedia! Silakan Pilih Meja:
                    </h4>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
                      {availableTables.map((tbl) => (
                        <div
                          key={tbl.id}
                          onClick={() => setSelectedTable(tbl)}
                          style={{
                            padding: "14px",
                            borderRadius: "var(--radius-md)",
                            border: selectedTable?.id === tbl.id ? "2px solid var(--color-primary)" : "1px solid var(--color-gray-300)",
                            background: selectedTable?.id === tbl.id ? "var(--color-primary-light)" : "#ffffff",
                            cursor: "pointer",
                            transition: "all var(--transition-fast)"
                          }}
                        >
                          <div style={{ fontWeight: 700, color: "var(--color-gray-900)" }}>{tbl.tableNumber}</div>
                          <div style={{ fontSize: "0.82rem", color: "var(--color-gray-600)" }}>
                            Kapasitas: {tbl.capacity} orang • {tbl.area}
                          </div>
                        </div>
                      ))}
                    </div>

                    <h4 style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--color-gray-900)", marginBottom: "14px" }}>
                      2. Data Kontak Pemesan
                    </h4>

                    <div className="form-grid-2">
                      <div className="form-group">
                        <label className="form-label" htmlFor="res-name">Nama Lengkap</label>
                        <input
                          type="text"
                          id="res-name"
                          placeholder="Contoh: Budi Santoso"
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          className="form-input"
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="res-phone">Nomor WhatsApp / HP</label>
                        <input
                          type="tel"
                          id="res-phone"
                          placeholder="Contoh: 081234567890"
                          value={guestPhone}
                          onChange={(e) => setGuestPhone(e.target.value)}
                          className="form-input"
                          required
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="res-notes">Catatan Khusus (Opsional)</label>
                      <input
                        type="text"
                        id="res-notes"
                        placeholder="Contoh: Kursi bayi, perayaan ulang tahun..."
                        value={specialNotes}
                        onChange={(e) => setSpecialNotes(e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleProceedToProposal}
                      className="btn btn-accent"
                      style={{ width: "100%", marginTop: "10px" }}
                      id="btn-proceed-proposal"
                    >
                      Lanjut ke Ringkasan Proposal Reservasi →
                    </button>
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div>
                <span className="badge badge-crimson" style={{ marginBottom: "12px" }}>Persetujuan Pelanggan</span>
                <h3 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--color-gray-900)", marginBottom: "14px" }}>
                  Ringkasan Usulan Reservasi
                </h3>
                <p style={{ color: "var(--color-gray-600)", fontSize: "0.92rem", marginBottom: "20px" }}>
                  Sesuai aturan sistem, reservasi hanya dieksekusi setelah Anda memeriksa dan menekan tombol konfirmasi berikut:
                </p>

                <div style={{
                  background: "var(--color-warm-bg)",
                  borderRadius: "var(--radius-lg)",
                  padding: "20px",
                  border: "1px solid rgba(155, 27, 27, 0.12)",
                  marginBottom: "24px"
                }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", fontSize: "0.92rem" }}>
                    <div>
                      <span style={{ color: "var(--color-gray-500)", fontSize: "0.8rem", display: "block" }}>Nama Tamu</span>
                      <strong>{guestName}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--color-gray-500)", fontSize: "0.8rem", display: "block" }}>Nomor Telepon</span>
                      <strong>{guestPhone}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--color-gray-500)", fontSize: "0.8rem", display: "block" }}>Jadwal Kedatangan</span>
                      <strong>{date} • {time} WIB</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--color-gray-500)", fontSize: "0.8rem", display: "block" }}>Alokasi Meja</span>
                      <strong style={{ color: "var(--color-primary)" }}>{selectedTable?.tableNumber} ({selectedTable?.area})</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--color-gray-500)", fontSize: "0.8rem", display: "block" }}>Jumlah Tamu</span>
                      <strong>{partySize} Orang</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--color-gray-500)", fontSize: "0.8rem", display: "block" }}>Durasi Santap</span>
                      <strong>90 Menit</strong>
                    </div>
                  </div>
                  {specialNotes && (
                    <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px dashed var(--color-gray-300)", fontSize: "0.88rem" }}>
                      <span style={{ color: "var(--color-gray-500)", fontSize: "0.8rem", display: "block" }}>Catatan:</span>
                      <em>{specialNotes}</em>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                  >
                    ← Koreksi Detail
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmReservation}
                    className="btn btn-primary"
                    style={{ flex: 1.5 }}
                    id="btn-confirm-booking"
                  >
                    ✓ Konfirmasi & Buat Reservasi
                  </button>
                </div>
              </div>
            )}

            {step === 3 && receipt && (
              <div style={{ textAlign: "center", padding: "10px 0" }}>
                <div style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "var(--color-emerald-light)",
                  color: "var(--color-emerald)",
                  fontSize: "2rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px"
                }}>
                  ✓
                </div>

                <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "1.7rem", color: "var(--color-gray-900)", marginBottom: "6px" }}>
                  Reservasi Anda Berhasil!
                </h3>
                <p style={{ color: "var(--color-gray-600)", fontSize: "0.92rem", marginBottom: "24px" }}>
                  Meja Anda telah diamankan secara resmi di database restoran.
                </p>

                <div style={{
                  background: "#ffffff",
                  border: "2px solid var(--color-emerald)",
                  borderRadius: "var(--radius-lg)",
                  padding: "24px",
                  textAlign: "left",
                  boxShadow: "var(--shadow-md)",
                  marginBottom: "24px"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--color-gray-200)", paddingBottom: "12px", marginBottom: "14px" }}>
                    <div>
                      <span style={{ fontSize: "0.75rem", color: "var(--color-gray-500)", textTransform: "uppercase" }}>Kode Referensi</span>
                      <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--color-primary)" }}>{receipt.referenceCode}</div>
                    </div>
                    <span className="badge badge-emerald">CONFIRMED</span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "0.9rem", marginBottom: "16px" }}>
                    <div>
                      <span style={{ color: "var(--color-gray-500)", fontSize: "0.78rem" }}>Pemesan:</span>
                      <div><strong>{receipt.guestName}</strong></div>
                    </div>
                    <div>
                      <span style={{ color: "var(--color-gray-500)", fontSize: "0.78rem" }}>Meja Terpilih:</span>
                      <div><strong>{receipt.table}</strong></div>
                    </div>
                    <div>
                      <span style={{ color: "var(--color-gray-500)", fontSize: "0.78rem" }}>Waktu:</span>
                      <div><strong>{receipt.dateTime}</strong></div>
                    </div>
                    <div>
                      <span style={{ color: "var(--color-gray-500)", fontSize: "0.78rem" }}>Kapasitas:</span>
                      <div><strong>{receipt.partySize} Orang</strong></div>
                    </div>
                  </div>

                  <div style={{
                    background: "var(--color-gray-50)",
                    padding: "10px 14px",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "0.8rem",
                    color: "var(--color-gray-600)"
                  }}>
                    🔑 <strong>Token Akses Privat:</strong> <code style={{ color: "var(--color-accent)", fontWeight: 700 }}>{receipt.managementToken}</code>
                    <div style={{ marginTop: "4px" }}>Simpan kode ini untuk melihat atau membatalkan reservasi secara mandiri.</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                  <button
                    onClick={handleReset}
                    className="btn btn-secondary"
                  >
                    Buat Reservasi Baru
                  </button>
                  <a
                    href="#beranda"
                    className="btn btn-primary"
                  >
                    Kembali ke Beranda
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
