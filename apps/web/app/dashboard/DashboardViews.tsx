"use client";

import Link from "next/link";
import AuditManager from "./AuditManager";
import { useCallback, useEffect, useRef, useState } from "react";

interface Profile { name: string; outletName: string; address: string; contactPhone: string; }
interface MenuItem { id: string; isActive: boolean; isAvailable: boolean; }
interface DiningTable { id: string; isActive: boolean; }
interface Reservation { id: string; referenceCode: string; guestName: string; startAt: string; partySize: number; status: string; table: { name: string }; }
interface ReservationPage { data: Reservation[]; total: number; }
interface Snapshot { profile: Profile | null; menu: MenuItem[] | null; tables: DiningTable[] | null; reservations: ReservationPage | null; }
const empty: Snapshot = { profile: null, menu: null, tables: null, reservations: null };
const visitTime = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));

export default function DashboardViews({ view }: { view: "overview" | "outlets" }) {
  const [data, setData] = useState<Snapshot>(empty);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [sessionExpired, setSessionExpired] = useState(false);
  const revoked = useRef(false);
  const activeRequest = useRef<AbortController | null>(null);
  const clearSession = useCallback(() => {
    revoked.current = true;
    activeRequest.current?.abort();
    setData(empty); setLoading(false); setSessionExpired(true);
  }, []);
  useEffect(() => {
    if (revoked.current) return;
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true); setFailed(false);
    async function read(resource: string) {
      const response = await fetch(`/staff/${resource}`, { cache: "no-store", signal: controller.signal });
      if (response.status === 401 || response.status === 403) { clearSession(); throw new Error("Session expired"); }
      if (!response.ok) throw new Error("Data unavailable");
      const body = await response.json();
      if (resource.startsWith("reservations")) {
        if (!Array.isArray(body.data) || !Number.isSafeInteger(body.total) || body.total < 0) throw new Error("Invalid reservation summary");
        return body;
      }
      return body.data;
    }
    void (async () => {
      const results = await Promise.allSettled(view === "outlets" ? [read("profile")] : [read("profile"), read("menu"), read("tables"), read("reservations?page=1")]);
      if (controller.signal.aborted || revoked.current) return;
      setData({ profile: results[0].status === "fulfilled" ? results[0].value : null, menu: results[1]?.status === "fulfilled" ? results[1].value : null, tables: results[2]?.status === "fulfilled" ? results[2].value : null, reservations: results[3]?.status === "fulfilled" ? results[3].value : null });
      setFailed(results.some(result => result.status === "rejected"));
      setLoading(false);
    })();
    return () => controller.abort();
  }, [view, refresh, clearSession]);
  const count = (value: number | undefined) => loading ? "…" : value === undefined ? "Belum dimuat" : value;
  const activeMenu = data.menu?.filter(item => item.isActive);
  if (sessionExpired) return <section aria-label="Sesi berakhir"><p role="alert">Sesi berakhir. Masuk kembali untuk melihat data restoran.</p><Link className="senja-button" href="/login">Masuk kembali</Link></section>;
  return <section aria-label={view === "overview" ? "Ringkasan restoran" : "Lokasi restoran"} aria-busy={loading}>
    <div className="sela-admin-section-toolbar"><p role="status">{loading ? "Memuat data restoran…" : failed ? "Sebagian data gagal dimuat, bukan berarti jumlahnya nol. Pilih Segarkan data untuk mencoba lagi." : "Informasi katalog dan reservasi restoran. Gunakan Segarkan data untuk memuat perubahan terbaru."}</p><button className="sela-button-outline" disabled={loading} onClick={() => setRefresh(value => value + 1)}><span aria-hidden="true">↻</span> {loading ? "Memuat…" : "Segarkan data"}</button></div>
    {view === "outlets" ? <div className="sela-admin-outlet-grid">{data.profile ? <article className="sela-admin-location-card"><div className="sela-admin-location-body"><div className="sela-admin-card-title"><h2>{data.profile.outletName}</h2><span className="sela-status-label">Lokasi restoran</span></div><p className="sela-admin-location-name">{data.profile.name}</p><dl><div><dt>Alamat</dt><dd>{data.profile.address || "Alamat belum tercantum."}</dd></div><div><dt>Kontak publik</dt><dd>{data.profile.contactPhone || "Kontak belum tercantum."}</dd></div></dl></div><div className="sela-admin-location-actions"><Link href="/dashboard?tab=hours">Atur jam & hari khusus <span aria-hidden="true">→</span></Link><Link href="/dashboard?tab=tables">Kelola meja <span aria-hidden="true">→</span></Link></div></article> : !loading && <div className="sela-admin-empty"><h2>Lokasi belum dapat dimuat</h2><p>Segarkan data untuk mencoba kembali.</p></div>}</div> : <>
      <div className="sela-admin-stats">
        <article><p>Menu aktif</p><strong>{count(activeMenu?.length)}</strong><span>Ditampilkan di website</span></article>
        <article><p>Siap disajikan</p><strong>{count(activeMenu?.filter(item => item.isAvailable).length)}</strong><span>Menu aktif berstatus tersedia</span></article>
        <article><p>Meja aktif</p><strong>{count(data.tables?.filter(item => item.isActive).length)}</strong><span>Bukan jumlah slot tersedia</span></article>
        <article><p>Reservasi</p><strong>{count(data.reservations?.total)}</strong><span>Semua tanggal dan status</span></article>
      </div>
      <div className="sela-admin-overview-grid">
        <article className="sela-admin-surface"><header><div><h2>Ringkasan reservasi</h2><p>Lima kunjungan pertama menurut waktu kedatangan · WIB · semua status</p></div><Link href="/dashboard?tab=reservations">Lihat daftar <span aria-hidden="true">→</span></Link></header>{loading ? <p className="sela-table-empty" role="status">Memuat reservasi…</p> : data.reservations ? data.reservations.data.length ? <ul className="sela-reservation-summary">{data.reservations.data.slice(0, 5).map(item => <li key={item.id}><div><strong>{item.guestName}</strong><p>{visitTime(item.startAt)} WIB · {item.partySize} tamu</p></div><div><span>{item.table.name}</span><p>{({ confirmed: "Terkonfirmasi", cancelled: "Dibatalkan", completed: "Selesai", no_show: "Tidak hadir" } as Record<string, string>)[item.status] ?? item.status}</p></div></li>)}</ul> : <div className="sela-admin-empty"><h3>Belum ada reservasi</h3><p>Booking yang tersimpan akan muncul setelah data disegarkan.</p></div> : <div className="sela-admin-empty"><h3>Reservasi belum dapat dimuat</h3><p>Segarkan data untuk mencoba kembali. Ini bukan berarti tidak ada booking.</p></div>}</article>
        <article className="sela-admin-surface"><header><div><h2>Aktivitas terakhir</h2><p>Jejak perubahan operasional</p></div><Link href="/dashboard?tab=audit">Lihat audit <span aria-hidden="true">→</span></Link></header><AuditManager compact refresh={refresh} onAuthFailure={clearSession} /></article>
      </div>
      <section className="sela-admin-quick-actions" aria-labelledby="quick-actions-heading"><h2 id="quick-actions-heading">Akses cepat operasional</h2><div>{[["menu", "Atur ketersediaan menu", "Perbarui harga dan tandai menu tersedia atau habis."], ["tables", "Konfigurasi meja", "Kelola nama, kapasitas dan status meja."], ["hours", "Atur jam pelayanan", "Jadwal mingguan dan pengecualian hari khusus."], ["profile", "Perbarui profil restoran", "Pastikan nama, alamat dan kontak tetap sesuai."]].map(([tab, title, description]) => <Link key={tab} href={`/dashboard?tab=${tab}`}><strong>{title} <span aria-hidden="true">→</span></strong><span>{description}</span></Link>)}</div></section>
    </>}
  </section>;
}
