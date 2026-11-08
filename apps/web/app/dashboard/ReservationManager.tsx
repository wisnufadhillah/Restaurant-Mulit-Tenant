"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
interface Reservation { id: string; referenceCode: string; guestName: string; partySize: number; startAt: string; endAt: string; status: string; table: { name: string }; outlet: { name: string }; guestPhone?: string; }
const format = (date: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(date));
const labels: Record<string, string> = { confirmed: "Terkonfirmasi", cancelled: "Dibatalkan", completed: "Selesai", no_show: "Tidak hadir" };
export default function ReservationManager() {
  const [items, setItems] = useState<Reservation[]>([]), [detail, setDetail] = useState<Reservation | null>(null);
  const [date, setDate] = useState(""), [status, setStatus] = useState(""), [page, setPage] = useState(1), [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const generation = useRef(0);
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const detailTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { if (detail) detailHeading.current?.focus(); }, [detail]);
  function closeDetail() { setDetail(null); detailTrigger.current?.focus(); }
  const applied = useRef({ date: "", status: "" });
  async function load(nextPage = 1, filters = applied.current) {
    const current = ++generation.current;
    setBusy(true); setError(""); setDetail(null);
    const params = new URLSearchParams({ page: String(nextPage), ...(filters.date ? { date: filters.date } : {}), ...(filters.status ? { status: filters.status } : {}) });
    try {
      const response = await fetch(`/staff/reservations?${params}`, { cache: "no-store" });
      const body = await response.json(); if (!response.ok) throw new Error(body.message);
      if (current !== generation.current) return;
      setItems(body.data); setPage(body.page); setTotal(body.total);
    } catch (e) { if (current === generation.current) { setItems([]); setTotal(0); setError(e instanceof Error ? e.message : "Reservasi gagal dimuat."); } }
    finally { if (current === generation.current) setBusy(false); }
  }
  useEffect(() => { void load(); return () => { generation.current++; }; }, []);
  async function open(id: string) {
    const current = ++generation.current; setBusy(true); setError(""); setDetail(null);
    try { const response = await fetch(`/staff/reservations?id=${encodeURIComponent(id)}`, { cache: "no-store" }); const body = await response.json(); if (!response.ok) { if (current === generation.current && (response.status === 401 || response.status === 403)) { setItems([]); setTotal(0); } throw new Error(body.message); } if (current === generation.current) setDetail(body.data); }
    catch (e) { if (current === generation.current) setError(e instanceof Error ? e.message : "Detail gagal dimuat."); }
    finally { if (current === generation.current) setBusy(false); }
  }
  return <section className="sela-reservations" aria-labelledby="staff-reservations-heading"><h2 id="staff-reservations-heading">Daftar reservasi</h2><p className="senja-note">Hanya baca. Perubahan status belum tersedia. Kontak tamu hanya ditampilkan pada detail; jangan salin ke chat atau bahan demo.</p>
    <form className="sela-reservation-filters" onSubmit={(event: FormEvent) => { event.preventDefault(); applied.current = { date, status }; void load(1, applied.current); }}><label>Tanggal kedatangan (WIB)<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label><label>Status<select value={status} onChange={e => setStatus(e.target.value)}><option value="">Semua status</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><button className="senja-button" disabled={busy}>Terapkan filter</button></form>
    <p role="status">{busy ? "Memuat reservasi…" : error ? "" : `${total} reservasi ditemukan.`}</p>{error && <p role="alert">{error}</p>}
    <div className="sela-admin-table-wrap" role="region" aria-label="Daftar reservasi, dapat digeser horizontal" tabIndex={0}><table className="sela-admin-table sela-reservations-table"><thead><tr><th scope="col">Referensi</th><th scope="col">Tamu</th><th scope="col">Kedatangan (WIB)</th><th scope="col">Meja</th><th scope="col">Tamu</th><th scope="col">Status</th><th scope="col">Detail</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><th scope="row"><span className="sela-reservation-reference" title={item.referenceCode} aria-label={item.referenceCode}>{item.referenceCode.length > 16 ? `${item.referenceCode.slice(0, 8)}…${item.referenceCode.slice(-4)}` : item.referenceCode}</span></th><td>{item.guestName}</td><td>{format(item.startAt)}</td><td>{item.table.name}</td><td>{item.partySize} orang</td><td><span className="sela-status-label">{labels[item.status] ?? item.status}</span></td><td><button className="sela-button-outline" disabled={busy} aria-label={`Lihat detail ${item.referenceCode}`} onClick={event => { detailTrigger.current = event.currentTarget; void open(item.id); }}>Lihat detail</button></td></tr>)}</tbody></table></div>
    {!busy && !error && !items.length && <p>Belum ada reservasi sesuai filter.</p>}
    <div className="senja-hero-actions sela-reservation-pagination"><button className="sela-button-outline" disabled={busy || page <= 1} onClick={() => void load(page - 1)}>Sebelumnya</button><span>Halaman {page}</span><button className="sela-button-outline" disabled={busy || page * 20 >= total} onClick={() => void load(page + 1)}>Berikutnya</button><button className="sela-button-outline" disabled={busy} onClick={() => void load(page)}>Muat ulang</button></div>
    {detail && <section className="sela-reservation-detail" aria-labelledby="reservation-detail-heading"><header><div><p className="senja-eyebrow">DETAIL KUNJUNGAN</p><h3 ref={detailHeading} tabIndex={-1} id="reservation-detail-heading">Reservasi {detail.guestName}</h3></div><span className="sela-status-label">{labels[detail.status] ?? detail.status}</span></header><p className="sela-reservation-full-reference"><span>Kode referensi</span><strong>{detail.referenceCode}</strong></p><dl><div><dt>Nama tamu</dt><dd>{detail.guestName}</dd></div><div><dt>Kontak privat</dt><dd>{detail.guestPhone}</dd></div><div><dt>Waktu kunjungan (WIB)</dt><dd>{format(detail.startAt)}<br />sampai {format(detail.endAt)}</dd></div><div><dt>Jumlah tamu</dt><dd>{detail.partySize} orang</dd></div><div><dt>Lokasi restoran</dt><dd>{detail.outlet.name}</dd></div><div><dt>Meja</dt><dd>{detail.table.name}</dd></div></dl><footer><p className="senja-note">Data privat untuk operasional restoran. Tampilan ini hanya baca.</p><button type="button" className="sela-button-outline" onClick={closeDetail}>Tutup detail</button></footer></section>}
  </section>;
}
