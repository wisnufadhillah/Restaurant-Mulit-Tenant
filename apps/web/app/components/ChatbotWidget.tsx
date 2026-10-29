"use client";

import { useRef, useState } from "react";
interface MenuItem { id: string; name: string; description: string; price: number; isAvailable: boolean; }
interface Profile { name: string; outlets: { name: string; address: string; contactPhone: string }[]; }
interface Hours { weekday: number; openMinute: number | null; closeMinute: number | null; }
const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const time = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}.${String(n % 60).padStart(2, "0")}`;

export default function ChatbotWidget() {
  const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const [ready, setReady] = useState(false), [pending, setPending] = useState(false), [message, setMessage] = useState("");
  const [menu, setMenu] = useState<MenuItem[] | null>(null), [profile, setProfile] = useState<Profile | null>(null), [hours, setHours] = useState<Hours[] | null>(null);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ sender: string; text: string }[]>([]);
  const close = () => { dialog.current?.close(); trigger.current?.focus(); };
  async function initialize() {
    setPending(true); setMessage("");
    try { const response = await fetch("/chat/session", { method: "POST" }); const body = await response.json(); if (!response.ok) throw new Error(body.message); setReady(true); }
    catch (error) { setReady(false); setMessage(error instanceof Error ? error.message : "Chat belum tersedia. Coba lagi nanti."); }
    finally { setPending(false); }
  }
  async function load(resource: "menu" | "restaurant" | "hours") {
    setPending(true); setMessage(""); setMenu(null); setProfile(null); setHours(null);
    try { const response = await fetch(`/chat/catalogue/${resource}`, { cache: "no-store" }); const body = await response.json(); if (!response.ok) { if (response.status === 403) setReady(false); throw new Error(body.message); } if (resource === "menu") setMenu(body.data); else if (resource === "restaurant") setProfile(body.data); else setHours(body.data); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Informasi gagal dimuat. Coba lagi."); }
    finally { setPending(false); }
  }
  return <>
    <button ref={trigger} className="senja-text-button senja-assistant-trigger sela-chat-launcher" type="button" onClick={() => { dialog.current?.showModal(); void initialize(); }}>Tanya restoran</button>
    <dialog className="senja-dialog sela-chat-panel" ref={dialog} onClose={() => trigger.current?.focus()} aria-labelledby="assistant-heading" aria-describedby="assistant-description">
      <div className="senja-dialog-heading"><span>Bantuan restoran</span><button className="senja-text-button" type="button" onClick={close}>Tutup <span aria-hidden="true">×</span></button></div>
      <h2 id="assistant-heading">Ada yang ingin dilihat?</h2>
      <p id="assistant-description">Tanyakan menu atau info restoran. Jawaban AI memakai tools read-only; bila layanan gagal, gunakan pilihan katalog atau halaman web. Jangan masukkan data pribadi atau token akses.</p>
      <div className="senja-hero-actions"><button className="sela-button-outline" disabled={!ready || pending} onClick={() => void load("menu")}>Lihat menu</button><button className="sela-button-outline" disabled={!ready || pending} onClick={() => void load("restaurant")}>Info restoran</button><button className="sela-button-outline" disabled={!ready || pending} onClick={() => void load("hours")}>Jam buka</button></div>
      <div role="log" aria-live="polite" aria-label="Percakapan restoran">{messages.map((item, index) => <p key={index}><strong>{item.sender === "user" ? "Kamu" : "Asisten"}:</strong> {item.text}</p>)}</div>
      <form className="senja-form" onSubmit={async event => {
        event.preventDefault(); if (!ready || pending || !input.trim()) return;
        setPending(true); setMessage("");
        try {
          const response = await fetch("/chat/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: input }) });
          const body = await response.json();
          if (!response.ok) { if (response.status === 403) setReady(false); throw new Error(body.message); }
          setMessages(previous => [...previous, { sender: "user", text: body.input }, { sender: "assistant", text: body.message }].slice(-20));
          setMenu(null); setProfile(null); setHours(null);
          for (const card of body.cards ?? []) { if (card.type === "menu") setMenu(card.data); else if (card.type === "restaurant") setProfile(card.data); }
          setInput("");
        } catch (error) { setMessage(error instanceof Error ? error.message : "Pesan gagal. Coba lagi."); }
        finally { setPending(false); }
      }}><label htmlFor="chat-message">Pesan untuk asisten</label><input id="chat-message" value={input} onChange={event => setInput(event.target.value)} maxLength={2000} required autoComplete="off" /><button className="senja-button" disabled={!ready || pending}>{pending ? "Memproses…" : "Kirim pesan"}</button></form>
      <p role="status">{pending ? "Memuat informasi…" : message}</p>
      {!ready && !pending && <button className="senja-text-button" onClick={async () => {
        setPending(true);
        try { const response = await fetch("/chat/session", { method: "DELETE" }); if (!response.ok) throw new Error("Sesi belum dapat diakhiri. Coba lagi nanti."); setMessages([]); setMenu(null); setProfile(null); setHours(null); setInput(""); await initialize(); }
        catch (error) { setMessage(error instanceof Error ? error.message : "Sesi baru gagal dimulai. Coba lagi."); }
        finally { setPending(false); }
      }}>Mulai sesi baru</button>}
      {menu && <section aria-label="Hasil menu dari API">{menu.length ? menu.map(item => <article key={item.id} className="senja-service-state"><h3>{item.name}</h3><p>{item.description}</p><p>{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(item.price)} · {item.isAvailable ? "Tersedia" : "Habis"}</p></article>) : <p>Belum ada menu aktif.</p>}<p className="senja-note">Sumber: API menu restoran</p></section>}
      {profile && <section aria-label="Profil dari API"><h3>{profile.name}</h3>{profile.outlets.map(outlet => <div key={outlet.name}><p>{outlet.name}</p><p>{outlet.address}</p>{outlet.contactPhone && <p>{outlet.contactPhone}</p>}</div>)}<p className="senja-note">Sumber: API profil restoran</p></section>}
      {hours && <section aria-label="Jadwal mingguan dari API"><dl className="sela-hours">{[1, 2, 3, 4, 5, 6, 0].map(day => { const row = hours.find(r => r.weekday === day); return <div key={day}><dt>{days[day]}</dt><dd>{!row ? "Belum diatur" : row.openMinute === null || row.closeMinute === null ? "Tutup" : `${time(row.openMinute)}–${time(row.closeMinute)}`}</dd></div>; })}</dl><p className="senja-note">Jadwal mingguan, bukan konfirmasi jam tanggal khusus atau availability meja.</p></section>}
      <a className="senja-text-link" href="#menu" onClick={close}>Lanjut di halaman menu</a>
    </dialog>
  </>;
}
