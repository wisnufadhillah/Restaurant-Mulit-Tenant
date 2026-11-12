"use client";
import { useEffect, useState } from "react";

interface Activity { id: string; source: "operational" | "reservation"; createdAt: string; action: string; actorType: string; reservationId: string | null; fromStatus: string | null; toStatus: string | null; }
const actions: Record<string, string> = { "menu.created": "Menu ditambahkan", "menu.updated": "Menu diperbarui", "menu.availability_changed": "Ketersediaan menu diubah", "profile.updated": "Profil diperbarui", "table.created": "Meja ditambahkan", "table.updated": "Meja diperbarui", "weekly_hours.saved": "Jam mingguan disimpan", "special_hours.saved": "Hari khusus disimpan", "special_hours.removed": "Hari khusus dihapus", "operational.other": "Perubahan operasional", "reservation.confirmed": "Reservasi dikonfirmasi", "reservation.cancelled": "Reservasi dibatalkan", "reservation.completed": "Reservasi selesai", "reservation.no_show": "Tamu tidak hadir" };
const statuses: Record<string, string> = { confirmed: "Terkonfirmasi", cancelled: "Dibatalkan", completed: "Selesai", no_show: "Tidak hadir" };
const actors: Record<string, string> = { staff: "Staff", customer: "Customer", system: "Sistem" };
const format = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));

export default function AuditManager({ compact = false, refresh = 0, onAuthFailure }: { compact?: boolean; refresh?: number; onAuthFailure?: () => void }) {
  const [items, setItems] = useState<Activity[]>([]), [page, setPage] = useState(1), [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true), [error, setError] = useState(""), [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setItems([]); setTotal(0);
    void (async () => {
      try {
        const response = await fetch(`/staff/audit?page=${page}`, { cache: "no-store", signal: controller.signal });
        if (response.status === 401 || response.status === 403) {
          if (controller.signal.aborted) return;
          setItems([]); setTotal(0); onAuthFailure?.();
          throw new Error("Sesi berakhir. Masuk kembali untuk melihat riwayat.");
        }
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || "Riwayat gagal dimuat.");
        if (!Array.isArray(body.data) || body.page !== page || body.pageSize !== 20 || !Number.isSafeInteger(body.total) || body.total < 0) throw new Error("Riwayat tidak valid.");
        if (!controller.signal.aborted) { setItems(body.data); setTotal(body.total); }
      } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Riwayat gagal dimuat."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [page, retry, refresh, onAuthFailure]);
  const visible = compact ? items.slice(0, 5) : items;
  return <section aria-label={compact ? "Lima aktivitas terbaru" : "Riwayat audit"} aria-busy={loading}>
    {!compact && <p className="senja-note">Riwayat hanya baca. Tanpa kontak tamu, nama akun atau alasan privat. Perubahan operasional tidak menyimpan ID sasaran.</p>}
    {loading && <p role="status">Memuat riwayat…</p>}
    {error && <div className="sela-admin-recovery"><p role="alert">{error}</p><button className="sela-button-outline" onClick={() => setRetry(value => value + 1)}>Coba lagi</button></div>}
    {!loading && !error && !visible.length && <p className="sela-table-empty">Belum ada aktivitas tercatat.</p>}
    {!loading && !error && visible.length > 0 && <div className="sela-admin-table-wrap" role="region" aria-label="Riwayat aktivitas, dapat digeser horizontal" tabIndex={0}><table className="sela-admin-table"><caption className="sela-table-caption">{compact ? "Lima aktivitas terbaru · WIB" : `${total} aktivitas · terbaru dahulu · WIB`}</caption><thead><tr><th scope="col">Waktu (WIB)</th><th scope="col">Aktivitas</th><th scope="col">Pelaku</th>{!compact && <><th scope="col">ID reservasi</th><th scope="col">Status</th></>}</tr></thead><tbody>{visible.map(item => <tr key={`${item.source}:${item.id}`}><td>{format(item.createdAt)}</td><th scope="row">{actions[item.action] ?? "Aktivitas lainnya"}</th><td>{actors[item.actorType] ?? "Tidak diketahui"}</td>{!compact && <><td>{item.reservationId ?? "Tidak disimpan"}</td><td>{item.toStatus ? `${item.fromStatus ? `${statuses[item.fromStatus] ?? "Tidak diketahui"} / ` : ""}${statuses[item.toStatus] ?? "Tidak diketahui"}` : "—"}</td></>}</tr>)}</tbody></table></div>}
    {!compact && <div className="senja-hero-actions sela-reservation-pagination"><button className="sela-button-outline" disabled={loading || page <= 1} onClick={() => setPage(value => value - 1)}>Sebelumnya</button><span>Halaman {page}</span><button className="sela-button-outline" disabled={loading || !!error || page >= 999 || page * 20 >= total} onClick={() => setPage(value => value + 1)}>Berikutnya</button><button className="sela-button-outline" disabled={loading} onClick={() => setRetry(value => value + 1)}>Muat ulang</button></div>}
  </section>;
}
