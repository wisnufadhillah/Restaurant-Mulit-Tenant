"use client";
import { useEffect, useRef, useState } from "react";
import { staffFetch } from "./staff-fetch";
interface Order { id: string; code: string; createdAt: string; orderTotal: number; status: string; paymentStatus: string; }
interface Detail extends Order { customerName: string; items: { name: string; price: number; quantity: number; subtotal: number }[]; paymentEvents: { id: string; fromStatus: string; toStatus: string; createdAt: string }[]; }
const payments: Record<string, string> = { unpaid: "Belum dibayar", pending: "Menunggu pembayaran", settlement: "Lunas", deny: "Ditolak", cancel: "Dibatalkan", expire: "Kedaluwarsa", failure: "Gagal" };
const statuses: Record<string, string> = { pending: "Menunggu", confirmed: "Terkonfirmasi", cancelled: "Dibatalkan" };
const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
const time = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
export default function OrderManager() {
  const [items, setItems] = useState<Order[]>([]), [detail, setDetail] = useState<Detail | null>(null);
  const [date, setDate] = useState(""), [paymentStatus, setPaymentStatus] = useState("");
  const [page, setPage] = useState(1), [total, setTotal] = useState(0), [busy, setBusy] = useState(true), [error, setError] = useState("");
  const generation = useRef(0), filters = useRef({ date: "", paymentStatus: "" });
  const heading = useRef<HTMLHeadingElement>(null), trigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { if (detail) heading.current?.focus(); }, [detail]);
  async function load(next = 1) {
    const current = ++generation.current;
    setBusy(true); setError(""); setDetail(null); setItems([]);
    const params = new URLSearchParams({ page: String(next), ...(filters.current.date ? { date: filters.current.date } : {}), ...(filters.current.paymentStatus ? { paymentStatus: filters.current.paymentStatus } : {}) });
    try {
      const response = await staffFetch(`/staff/orders?${params}`, { cache: "no-store" });
      const body = await response.json(); if (!response.ok) throw new Error(body.message);
      if (current !== generation.current) return;
      setItems(body.data); setPage(body.page); setTotal(body.total);
    } catch (error) { if (current === generation.current) { setTotal(0); setError(error instanceof Error ? error.message : "Pesanan gagal dimuat. Coba muat ulang."); } }
    finally { if (current === generation.current) setBusy(false); }
  }
  async function open(id: string) {
    const current = ++generation.current; setBusy(true); setDetail(null); setError("");
    try {
      const response = await staffFetch(`/staff/orders?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const body = await response.json(); if (!response.ok) throw new Error(body.message);
      if (current === generation.current) setDetail(body.data);
    } catch (error) { if (current === generation.current) setError(error instanceof Error ? error.message : "Detail gagal dimuat. Coba lagi."); }
    finally { if (current === generation.current) setBusy(false); }
  }
  useEffect(() => { void load(); return () => { generation.current++; }; }, []);
  return <section className="sela-reservations" aria-labelledby="staff-orders-heading">
    <h2 id="staff-orders-heading">Daftar pesanan</h2><p className="senja-note">Hanya baca. Pembayaran sandbox bukan transaksi uang nyata; status berasal dari server, bukan audit aktivitas.</p>
    <form className="sela-reservation-filters" onSubmit={event => { event.preventDefault(); filters.current = { date, paymentStatus }; void load(); }}>
      <label>Tanggal pesanan (WIB)<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
      <div className="senja-field"><label htmlFor="staff-order-payment">Status pembayaran</label><select id="staff-order-payment" value={paymentStatus} onChange={event => setPaymentStatus(event.target.value)}><option value="">Semua pembayaran</option>{Object.entries(payments).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
      <button className="senja-button" disabled={busy}>Terapkan filter</button>
      <button type="button" className="sela-button-outline" disabled={busy} onClick={() => { setDate(""); setPaymentStatus(""); filters.current = { date: "", paymentStatus: "" }; void load(); }}>Hapus filter</button>
    </form>
    <p role="status">{busy ? "Memuat pesanan…" : error ? "" : `${total} pesanan ditemukan.`}</p>{error && <p role="alert">{error} Gunakan Muat ulang untuk mencoba lagi.</p>}
    <div className="sela-admin-table-wrap" role="region" aria-label="Daftar pesanan, dapat digeser horizontal" tabIndex={0}><table className="sela-admin-table sela-orders-table"><thead><tr><th scope="col">Kode pesanan</th><th scope="col">Waktu (WIB)</th><th scope="col">Total</th><th scope="col">Status pesanan</th><th scope="col">Pembayaran</th><th scope="col">Detail</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><th scope="row" className="sela-order-code">{item.code}</th><td>{time(item.createdAt)}</td><td>{money(item.orderTotal)}</td><td>{statuses[item.status] ?? item.status}</td><td>{payments[item.paymentStatus] ?? item.paymentStatus}</td><td><button className="sela-button-outline" disabled={busy} aria-label={`Lihat detail ${item.code}`} onClick={event => { trigger.current = event.currentTarget; void open(item.id); }}>Lihat detail</button></td></tr>)}</tbody></table></div>
    {!busy && !error && !items.length && <p>Belum ada pesanan sesuai filter. Hapus filter untuk melihat pesanan lainnya.</p>}
    <div className="senja-hero-actions sela-reservation-pagination"><button className="sela-button-outline" disabled={busy || page <= 1} onClick={() => void load(page - 1)}>Sebelumnya</button><span>Halaman {page}</span><button className="sela-button-outline" disabled={busy || page * 20 >= total} onClick={() => void load(page + 1)}>Berikutnya</button><button className="sela-button-outline" disabled={busy} onClick={() => void load(page)}>Muat ulang</button></div>
    {detail && <section className="sela-reservation-detail" aria-labelledby="order-detail-heading"><header><h3 id="order-detail-heading" ref={heading} tabIndex={-1}>Detail pesanan</h3><button className="sela-button-outline" onClick={() => { setDetail(null); trigger.current?.focus(); }}>Tutup detail</button></header>
      <p className="sela-order-code">{detail.code}</p><dl><div><dt>Nama pemesan</dt><dd>{detail.customerName}</dd></div><div><dt>Waktu (WIB)</dt><dd>{time(detail.createdAt)}</dd></div><div><dt>Status pesanan</dt><dd>{statuses[detail.status] ?? detail.status}</dd></div><div><dt>Pembayaran sandbox</dt><dd>{payments[detail.paymentStatus] ?? detail.paymentStatus}</dd></div></dl>
      <h4>Item saat pemesanan</h4><ul className="sela-order-items">{detail.items.map((item, index) => <li key={index}><strong>{item.name}</strong><span>{item.quantity} × {money(item.price)}</span><span>Subtotal {money(item.subtotal)}</span></li>)}</ul><p><strong>Total {money(detail.orderTotal)}</strong></p>
      <h4>Histori pembayaran</h4>{detail.paymentEvents.length ? <ol className="sela-order-events">{detail.paymentEvents.map(event => <li key={event.id}><time dateTime={event.createdAt}>{time(event.createdAt)} WIB</time><span>{payments[event.fromStatus] ?? event.fromStatus} menjadi {payments[event.toStatus] ?? event.toStatus}</span></li>)}</ol> : <p>Belum ada transisi pembayaran tersimpan.</p>}
    </section>}
  </section>;
}
