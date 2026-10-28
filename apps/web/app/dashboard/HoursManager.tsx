"use client";
import { useEffect, useState } from "react";
import SpecialHoursManager from "./SpecialHoursManager";
const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
interface Hours { weekday: number; openMinute: number | null; closeMinute: number | null; }
const time = (minute: number | null) => minute === null ? "" : `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
const minute = (text: string) => { const [h, m] = text.split(":").map(Number); return h * 60 + m; };
export default function HoursManager({ role }: { role: "owner" | "staff" }) {
  const [rows, setRows] = useState<Hours[]>([]), [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true), [pending, setPending] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  async function load() {
    setLoading(true); setLoadFailed(false);
    try { const response = await fetch("/staff/hours", { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.message); setRows(result.data); }
    catch (error) { setLoadFailed(true); setMessage(error instanceof Error ? error.message : "Jadwal gagal dimuat. Coba lagi."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  return <section><h2>Jadwal mingguan</h2><p className="senja-note">Waktu lokal outlet. Satu interval per hari, tidak melewati tengah malam. Hari belum diatur tidak dianggap buka. Pengecualian tanggal diatur pada bagian Hari khusus di bawah.</p><p role="status">{message}</p>
    {loading ? <p>Memuat jadwal…</p> : <div className="sela-hours-editor">{[1, 2, 3, 4, 5, 6, 0].map(day => {
      const row = rows.find(value => value.weekday === day);
      return <form key={`${day}-${row?.openMinute}-${row?.closeMinute}`} className="sela-hours-row" onSubmit={async event => {
        event.preventDefault(); if (pending) return; const data = new FormData(event.currentTarget), closed = data.get("closed") === "on"; setPending(true); setMessage("");
        try { const response = await fetch("/staff/hours", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ weekday: day, openMinute: closed ? null : minute(String(data.get("open"))), closeMinute: closed ? null : minute(String(data.get("close"))) }) }); const result = await response.json(); if (!response.ok) throw new Error(result.message); setMessage(`Jadwal ${days[day]} tersimpan.`); await load(); }
        catch (error) { setMessage(error instanceof Error ? error.message : "Jadwal gagal disimpan. Coba lagi."); } finally { setPending(false); }
      }}><strong>{days[day]}</strong><span className="senja-note">{!row ? "Belum diatur" : row.openMinute === null ? "Tutup" : `${time(row.openMinute)}–${time(row.closeMinute)}`}</span>{role === "owner" && <><label>Buka<input name="open" type="time" defaultValue={time(row?.openMinute ?? 660)} /></label><label>Tutup (24:00 untuk akhir hari)<input name="close" type="text" pattern="([01][0-9]|2[0-3]):[0-5][0-9]|24:00" placeholder="21:00" defaultValue={time(row?.closeMinute ?? 1260)} /></label><label><input name="closed" type="checkbox" defaultChecked={!!row && row.openMinute === null} /> Hari tutup</label><button className="sela-button-outline" disabled={pending}>Simpan {days[day]}</button></>}</form>;
    })}</div>}
    {loadFailed && <button className="senja-text-button" disabled={pending || loading} onClick={() => void load()}>Coba lagi</button>}
    <SpecialHoursManager role={role} />
  </section>;
}
