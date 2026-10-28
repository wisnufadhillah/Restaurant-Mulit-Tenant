"use client";

import { useState, useRef, useEffect } from "react";
import { MENU_ITEMS, FAQ_ITEMS, RESTAURANT_INFO } from "../data/restaurant-data";
import { fetchRestaurantMenu } from "../data/restaurant-api";

interface ChatMessage {
  id: string;
  sender: "bot" | "user";
  text: string;
  type?: "text" | "menu_cards" | "table_proposal" | "manage_auth" | "manage_card";
  data?: any;
  source?: string;
  timestamp: string;
}

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-welcome",
      sender: "bot",
      text: "Halo! Selamat datang di Raso Minang. Ada yang bisa saya bantu hari ini? Anda bisa mengecek rekomendasi menu, cek ketersediaan meja, atau informasi kebijakan restoran.",
      timestamp: "Baru saja"
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [menuItems, setMenuItems] = useState(MENU_ITEMS);

  // Management verification state
  const [manageCode, setManageCode] = useState("");
  const [manageToken, setManageToken] = useState("");
  const [manageResult, setManageResult] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    let active = true;
    fetchRestaurantMenu().then((items) => { if (active) setMenuItems(items); }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const addBotMessage = (msg: Omit<ChatMessage, "id" | "sender" | "timestamp">) => {
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          ...msg,
          id: "bot-" + Date.now(),
          sender: "bot",
          timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
        }
      ]);
    }, 500);
  };

  const handleSend = (textToSend?: string) => {
    const text = textToSend || inputVal;
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: "usr-" + Date.now(),
      sender: "user",
      text: text,
      timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputVal("");

    const lower = text.toLowerCase();

    // Intent 1: Menu
    if (lower.includes("menu") || lower.includes("makan") || lower.includes("rendang") || lower.includes("ayam")) {
      addBotMessage({
        text: "Berikut hidangan favorit dan terlaris di Raso Minang hari ini:",
        type: "menu_cards",
        data: menuItems.slice(0, 3)
      });
      return;
    }

    // Intent 2: Meja / Reservasi
    if (lower.includes("meja") || lower.includes("booking") || lower.includes("pesan") || lower.includes("jadwal")) {
      addBotMessage({
        text: "Kami memiliki beberapa slot meja siap reservasi hari ini untuk Anda. Anda juga dapat menggunakan formulir reservasi langsung di halaman kami.",
        type: "table_proposal",
        data: {
          table: "Meja VIP-01 (Kapasitas 8-10 orang, Ber-AC)",
          date: "Hari Ini",
          duration: "90 Menit"
        }
      });
      return;
    }

    // Intent 3: Kelola / Cek Reservasi
    if (lower.includes("batal") || lower.includes("kelola") || lower.includes("cek reservasi") || lower.includes("status")) {
      addBotMessage({
        text: "Sesuai standar privasi, silakan masukkan Kode Referensi dan Token Akses Privat Anda pada kartu aman di bawah ini (data tidak akan masuk ke prompt model):",
        type: "manage_auth"
      });
      return;
    }

    // Intent 4: FAQ / Halal / Lokasi
    if (lower.includes("halal") || lower.includes("sertifikasi")) {
      addBotMessage({
        text: FAQ_ITEMS[0].answer,
        source: "Dokumen Kebijakan Restoran (MUI Certified)"
      });
      return;
    }

    if (lower.includes("lokasi") || lower.includes("alamat") || lower.includes("jam")) {
      addBotMessage({
        text: `Raso Minang berlokasi di ${RESTAURANT_INFO.address}. Jam buka hari ini: 10:00 - 22:00 WIB. Parkir luas dan musholla tersedia.`,
        source: "Data Outlet Raso Minang"
      });
      return;
    }

    // Fallback general response
    addBotMessage({
      text: "Terima kasih atas pertanyaannya! Saya dapat memandu Anda melihat menu unggulan, memeriksa ketersediaan meja, atau memeriksa status reservasi Anda. Silakan pilih salah satu tombol opsi cepat di bawah:",
    });
  };

  const handleVerifyBooking = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manageCode || !manageToken) return;

    setManageResult({
      code: manageCode,
      status: "CONFIRMED",
      date: "Hari Ini, 19:30 WIB",
      table: "Meja 03 (Indoor AC)",
      guests: 4
    });
  };

  const handleCancelBooking = () => {
    if (manageResult) {
      setManageResult({
        ...manageResult,
        status: "CANCELLED"
      });
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        className="chat-widget-fab"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Buka Chat Tanya Restoran"
        id="btn-open-chatbot"
      >
        <span className="chat-fab-pulse"></span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span>{isOpen ? "Tutup Bantuan" : "Tanya Restoran"}</span>
      </button>

      {/* Chat Drawer Window */}
      {isOpen && (
        <div className="chat-drawer" id="chatbot-window" role="dialog" aria-modal="false" aria-labelledby="chatbot-title">
          {/* Header */}
          <div className="chat-header">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#ffffff", color: "var(--color-primary)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "0.9rem" }}>
                AI
              </div>
              <div>
                <div id="chatbot-title" style={{ fontWeight: 700, fontSize: "0.95rem" }}>Asisten Raso Minang</div>
                <div style={{ fontSize: "0.75rem", opacity: 0.9, display: "flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#34d399", display: "inline-block" }}></span>
                  Online • Bantuan Cepat
                </div>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ color: "#ffffff", padding: "4px 8px", fontSize: "1.2rem", cursor: "pointer" }}
              aria-label="Tutup Chat"
            >
              ✕
            </button>
          </div>

          {/* Messages Area */}
          <div className="chat-messages" role="log" aria-live="polite" aria-label="Percakapan dengan asisten">
            {messages.map((m) => (
              <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <div className={`chat-bubble ${m.sender === "bot" ? "chat-bubble-bot" : "chat-bubble-user"}`}>
                  <div>{m.text}</div>

                  {/* Menu Cards Structured Output */}
                  {m.type === "menu_cards" && m.data && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
                      {m.data.map((item: any) => (
                        <div key={item.id} style={{ background: "var(--color-warm-bg)", padding: "10px", borderRadius: "var(--radius-md)", border: "1px solid rgba(155,27,27,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>{item.icon} {item.name}</div>
                            <div style={{ fontSize: "0.78rem", color: "var(--color-gray-600)" }}>
                              Rp {item.price.toLocaleString("id-ID")} • {item.isAvailable ? "Tersedia" : "Habis"}
                            </div>
                          </div>
                          <a href="#reservasi" onClick={() => setIsOpen(false)} style={{ fontSize: "0.78rem", color: "var(--color-primary)", fontWeight: 700 }}>
                            Pesan →
                          </a>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Table Proposal Card */}
                  {m.type === "table_proposal" && m.data && (
                    <div style={{ background: "var(--color-warm-bg)", padding: "12px", borderRadius: "var(--radius-md)", border: "1px solid rgba(155,27,27,0.12)", marginTop: "10px" }}>
                      <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--color-primary)" }}>{m.data.table}</div>
                      <div style={{ fontSize: "0.8rem", color: "var(--color-gray-600)", margin: "4px 0 10px" }}>
                        Slot: {m.data.date} • Durasi: {m.data.duration}
                      </div>
                      <a href="#reservasi" onClick={() => setIsOpen(false)} className="btn btn-primary" style={{ padding: "6px 12px", fontSize: "0.8rem", width: "100%" }}>
                        Lanjut Reservasi di Form Web
                      </a>
                    </div>
                  )}

                  {/* Private Manage Auth Component (Direct Backend Security Pattern) */}
                  {m.type === "manage_auth" && (
                    <div style={{ background: "#ffffff", padding: "12px", borderRadius: "var(--radius-md)", border: "1px solid var(--color-gray-300)", marginTop: "10px" }}>
                      {!manageResult ? (
                        <form onSubmit={handleVerifyBooking} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <label htmlFor="manage-code" className="sr-only">Kode referensi reservasi</label>
                          <input
                            id="manage-code"
                            type="text"
                            placeholder="Kode Referensi (misal: RSV-123456)"
                            value={manageCode}
                            onChange={(e) => setManageCode(e.target.value)}
                            style={{ padding: "8px 10px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "0.82rem" }}
                            required
                          />
                          <label htmlFor="manage-token" className="sr-only">Token akses privat</label>
                          <input
                            id="manage-token"
                            type="password"
                            placeholder="Token Akses Privat"
                            value={manageToken}
                            onChange={(e) => setManageToken(e.target.value)}
                            style={{ padding: "8px 10px", borderRadius: "4px", border: "1px solid #ccc", fontSize: "0.82rem" }}
                            required
                          />
                          <button type="submit" className="btn btn-primary" style={{ padding: "6px", fontSize: "0.8rem" }}>
                            Verifikasi Tiket Reservasi
                          </button>
                        </form>
                      ) : (
                        <div style={{ fontSize: "0.85rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                            <strong>{manageResult.code}</strong>
                            <span className={`badge ${manageResult.status === "CONFIRMED" ? "badge-emerald" : "badge-crimson"}`}>
                              {manageResult.status}
                            </span>
                          </div>
                          <div style={{ color: "var(--color-gray-600)", fontSize: "0.8rem", marginBottom: "8px" }}>
                            {manageResult.date} • {manageResult.table} ({manageResult.guests} Orang)
                          </div>
                          {manageResult.status === "CONFIRMED" && (
                            <button
                              onClick={handleCancelBooking}
                              className="btn btn-secondary"
                              style={{ width: "100%", padding: "6px", fontSize: "0.8rem", color: "#b91c1c", borderColor: "#fca5a5" }}
                            >
                              Batalkan Reservasi Ini
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* RAG Source Citation */}
                  {m.source && (
                    <div style={{ marginTop: "6px", fontSize: "0.72rem", color: "var(--color-gray-500)", fontStyle: "italic", borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: "4px" }}>
                      Sumber: {m.source}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: "0.68rem", color: "var(--color-gray-400)", alignSelf: m.sender === "bot" ? "flex-start" : "flex-end", padding: "0 4px" }}>
                  {m.timestamp}
                </span>
              </div>
            ))}

            {isTyping && (
              <div className="chat-bubble chat-bubble-bot" style={{ display: "inline-block", width: "auto" }}>
                <span style={{ color: "var(--color-gray-400)", fontSize: "0.85rem" }}>Asisten sedang memproses jawaban...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Action Pills */}
          <div style={{ padding: "10px 16px", background: "#ffffff", borderTop: "1px solid var(--color-gray-100)" }}>
            <div className="chat-quick-actions">
              <button className="chat-quick-btn" onClick={() => handleSend("Lihat menu favorit")}>
                🍲 Rekomendasi Menu
              </button>
              <button className="chat-quick-btn" onClick={() => handleSend("Cek meja untuk hari ini")}>
                🪑 Cek Slot Meja
              </button>
              <button className="chat-quick-btn" onClick={() => handleSend("Apakah makanan halal?")}>
                📜 Kebijakan Halal
              </button>
              <button className="chat-quick-btn" onClick={() => handleSend("Kelola atau cek reservasi")}>
                🔍 Kelola Reservasi
              </button>
            </div>
          </div>

          {/* Input Footer */}
          <form className="chat-footer" onSubmit={(e) => { e.preventDefault(); handleSend(); }}>
            <label htmlFor="chatbot-input" className="sr-only">Pesan untuk asisten</label>
            <input
              type="text"
              className="chat-input"
              placeholder="Ketik pertanyaan Anda di sini..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              id="chatbot-input"
            />
            <button type="submit" className="btn btn-primary" style={{ padding: "8px 16px" }} id="chatbot-submit">
              Kirim
            </button>
          </form>
        </div>
      )}
    </>
  );
}
