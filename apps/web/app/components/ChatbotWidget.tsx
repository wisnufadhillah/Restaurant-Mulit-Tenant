"use client";

import { useEffect, useRef, useState } from "react";
import { maskedChatPreview } from "./chat-presentation";
interface MenuItem { id: string; name: string; description: string; price: number; isAvailable: boolean; }
interface Profile { name: string; outlets: { name: string; address: string; contactPhone: string }[]; }
interface Hours { weekday: number; openMinute: number | null; closeMinute: number | null; }
interface KnowledgeExcerpt { documentId: string; revision: number; position: number; title: string; text: string; }
type Card = { type: "knowledge"; data: KnowledgeExcerpt[] } | { type: "menu"; data: MenuItem[] } | { type: "restaurant"; data: Profile } | { type: "hours"; data: Hours[] };
type Action = { id: string; type: "navigate"; label: string; target: "#menu" | "#reservasi" } | { id: string; type: "prompt"; label: string; message: "Jam buka hari ini kapan?" | "Apa kebijakan restoran lain yang perlu saya tahu?" };
interface Message { sender: "user" | "assistant"; text: string; cards?: Card[]; actions?: Action[]; }
const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const time = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}.${String(n % 60).padStart(2, "0")}`;
const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function ChatCard({ card }: { card: Card }) {
  if (card.type === "knowledge") return <div className="sela-chat-card" role="group" aria-label="Sumber jawaban"><p className="senja-note">Sumber jawaban</p>{card.data.length ? card.data.map(item => <div key={`${item.documentId}-${item.revision}-${item.position}`}><strong>{item.title}</strong><p>{item.text}</p><small>Versi sumber {item.revision}</small></div>) : <p>Belum ada sumber FAQ yang sesuai.</p>}</div>;
  return <div className="sela-chat-card" role="group" aria-label={card.type === "menu" ? "Menu dan harga" : card.type === "hours" ? "Jadwal mingguan" : "Info restoran"}>
    {card.type === "menu" ? (card.data.length ? card.data.map(item => <div className="sela-chat-menu-item" key={item.id}><strong>{item.name}</strong><span>{currency.format(item.price)} · {item.isAvailable ? "Tersedia" : "Habis"}</span><p>{item.description}</p></div>) : <p>Belum ada menu aktif.</p>) : card.type === "restaurant" ? <><strong>{card.data.name}</strong>{card.data.outlets.map(outlet => <div key={outlet.name}><p>{outlet.name}</p><p>{outlet.address}</p>{outlet.contactPhone && <p>{outlet.contactPhone}</p>}</div>)}</> : <><dl>{[1, 2, 3, 4, 5, 6, 0].map(day => { const row = card.data.find(item => item.weekday === day); return <div key={day}><dt>{days[day]}</dt><dd>{!row ? "Belum diatur" : row.openMinute === null || row.closeMinute === null ? "Tutup" : `${time(row.openMinute)}–${time(row.closeMinute)} WIB`}</dd></div>; })}</dl><p>Jadwal reguler; hari khusus bisa berbeda.</p></>}
    <small>Data restoran</small>
  </div>;
}

function ChatActions({ actions, onAction, disabled }: { actions: Action[]; onAction: (action: Action) => void; disabled: boolean }) {
  if (!actions.length) return null;
  return <div className="sela-chat-actions" role="group" aria-label="Pilihan tindakan">{actions.map(action => <button key={action.id} type="button" disabled={disabled} onClick={() => onAction(action)}>{action.label}</button>)}</div>;
}

export default function ChatbotWidget() {
  const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null), log = useRef<HTMLDivElement>(null), composer = useRef<HTMLTextAreaElement>(null);
  const busy = useRef(false);
  const [ready, setReady] = useState(false), [pending, setPending] = useState(false), [error, setError] = useState("");
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) trigger.current?.focus();
    wasOpen.current = open;
  }, [open]);
  const [messages, setMessages] = useState<Message[]>([]);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [messages, pending]);
  useEffect(() => {
    if (!composer.current) return;
    composer.current.style.height = "auto";
    const height = composer.current.scrollHeight;
    composer.current.style.height = `${Math.min(height, 112)}px`;
    composer.current.style.overflowY = height > 112 ? "auto" : "hidden";
  }, [input, open]);
  const close = () => { dialog.current?.close(); };
  function runAction(action: Action) {
    if (action.type === "navigate") {
      document.querySelector(action.target)?.scrollIntoView({ behavior: "smooth", block: "start" });
      close();
      return;
    }
    setInput(action.message);
    composer.current?.focus();
  }
  async function initialize() {
    if (busy.current || ready) return;
    busy.current = true; setPending(true); setError("");
    try { const response = await fetch("/chat/session", { method: "POST" }); if (!response.ok) throw new Error(); setReady(true); }
    catch { setReady(false); setError("Chat belum tersambung. Coba mulai sesi baru."); }
    finally { busy.current = false; setPending(false); }
  }
  async function load(resource: "menu" | "restaurant" | "hours") {
    if (busy.current || !ready) return;
    busy.current = true; setPending(true); setError("");
    try {
      const response = await fetch(`/chat/catalogue/${resource}`, { cache: "no-store" }); const body = await response.json();
      if (!response.ok) { if (response.status === 403) setReady(false); throw new Error(); }
      const card = { type: resource, data: body.data } as Card;
      const label = resource === "menu" ? "Lihat menu" : resource === "hours" ? "Jam buka" : "Info restoran";
      setMessages(previous => [...previous, { sender: "user" as const, text: label }, { sender: "assistant", text: resource === "hours" ? "Berikut jadwal reguler yang tercatat." : "Berikut informasi yang tercatat.", cards: [card] } as Message].slice(-20));
    } catch { setError("Informasi belum bisa dimuat. Coba lagi atau buka halaman menu."); }
    finally { busy.current = false; setPending(false); }
  }
  async function send() {
    if (!ready || busy.current || !input.trim()) return;
    const submitted = input;
    busy.current = true; setPending(true); setError("");
    setMessages(previous => [...previous, { sender: "user" as const, text: maskedChatPreview(submitted) }].slice(-19));
    setInput("");
    try {
      const response = await fetch("/chat/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: submitted }) });
      const body = await response.json();
      if (!response.ok) { if (response.status === 403) setReady(false); throw new Error(); }
      const actions = (Array.isArray(body.actions) ? body.actions : []).filter((action: Action) => action && typeof action.id === "string" && typeof action.label === "string" && ((action.type === "navigate" && (action.target === "#menu" || action.target === "#reservasi")) || (action.type === "prompt" && (action.message === "Jam buka hari ini kapan?" || action.message === "Apa kebijakan restoran lain yang perlu saya tahu?"))));
      setMessages(previous => [...previous.slice(0, -1), { sender: "user" as const, text: body.input }, { sender: "assistant", text: body.message, cards: (body.cards ?? []).filter((card: Card) => card.type === "menu" || card.type === "knowledge" || card.type === "restaurant"), actions } as Message].slice(-20));
    } catch {
      setMessages(previous => previous.slice(0, -1));
      setInput(submitted);
      setError("Pesan belum terkirim. Coba lagi; pesanmu tetap ada di kolom ketik.");
    }
    finally { busy.current = false; setPending(false); }
  }
  return <>
    <button ref={trigger} className="senja-text-button senja-assistant-trigger sela-chat-launcher" type="button" hidden={open} aria-haspopup="dialog" aria-expanded={open} aria-controls="restaurant-chat" onClick={() => { dialog.current?.showModal(); setOpen(true); void initialize(); }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-2 2V11.5A8.5 8.5 0 0 1 10.5 3h2a8.5 8.5 0 0 1 8.5 8.5Z" /><path d="M7 11h10M7 15h6" /></svg>Tanya restoran</button>
    <dialog id="restaurant-chat" className="senja-dialog sela-chat-panel" ref={dialog} onClose={() => setOpen(false)} aria-labelledby="assistant-heading" aria-describedby="assistant-description">
      <header className="sela-chat-header"><span className="sela-chat-avatar" aria-hidden="true">DS</span><div><h2 id="assistant-heading">Asisten Dapur Sela</h2><p>Menu, jam buka, dan info kunjungan</p></div><button type="button" className="sela-chat-close" aria-label="Tutup chat" onClick={close}>×</button></header>
      <div className="sela-chat-log" ref={log} role="log" aria-live="polite" aria-label="Percakapan restoran" aria-busy={pending}>
        {messages.length === 0 && <div className="sela-chat-bubble sela-chat-assistant sela-chat-welcome"><p>Halo! Mau lihat menu atau cek jam buka Dapur Sela? Tanyakan di sini.</p></div>}
        {messages.map((item, index) => <div key={index} className={`sela-chat-bubble sela-chat-${item.sender}`}><span className="sela-chat-sr-only">{item.sender === "user" ? "Kamu" : "Asisten"}:</span><p>{item.text}</p>{item.cards?.map((card, cardIndex) => <ChatCard key={cardIndex} card={card} />)}{item.sender === "assistant" && <ChatActions actions={item.actions ?? []} onAction={runAction} disabled={pending} />}</div>)}
        <div id="chat-shortcuts" className="sela-chat-shortcuts" hidden={messages.length > 0} role="group" aria-label="Pilihan informasi"><button type="button" disabled={!ready || pending} onClick={() => void load("menu")}>Menu</button><button type="button" disabled={!ready || pending} onClick={() => void load("restaurant")}>Info restoran</button><button type="button" disabled={!ready || pending} onClick={() => void load("hours")}>Jam buka</button></div>
        {pending && <div className="sela-chat-bubble sela-chat-assistant sela-chat-loading"><span>{ready ? "Sedang mengetik…" : "Menyambungkan chat…"}</span></div>}
      </div>
      <footer className="sela-chat-footer">
        <p className="sela-chat-error" role="status">{error}</p>
        {!ready && !pending && <button className="senja-text-button" onClick={async () => {
          if (busy.current) return;
          busy.current = true; setPending(true);
          try { const response = await fetch("/chat/session", { method: "DELETE" }); if (!response.ok) throw new Error(); setMessages([]); setInput(""); busy.current = false; await initialize(); }
          catch { setError("Sesi baru belum bisa dimulai. Coba lagi nanti."); }
          finally { busy.current = false; setPending(false); }
        }}>Mulai sesi baru</button>}
        <form className="sela-chat-composer" onSubmit={event => { event.preventDefault(); void send(); }}>
          <label className="sela-chat-sr-only" htmlFor="chat-message">Pesan untuk asisten</label>
          <textarea disabled={pending} ref={composer} id="chat-message" value={input} onChange={event => setInput(event.target.value)} maxLength={2000} required autoComplete="off" rows={1} placeholder="Tulis pertanyaan…" aria-describedby="assistant-description" onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
          <button type="submit" disabled={!ready || pending}>Kirim</button>
        </form>
        <p id="assistant-description" className="sela-chat-privacy">Jangan kirim kontak atau kode akses. <a href="#menu" onClick={close}>Buka halaman menu</a></p>
      </footer>
    </dialog>
  </>;
}
