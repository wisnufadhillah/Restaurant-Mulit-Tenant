"use client";

import { useEffect, useState } from "react";
interface DiningTable { id: string; name: string; capacity: number; isActive: boolean; }
export default function TableManager({ role }: { role: "owner" | "staff" }) {
  const [items, setItems] = useState<DiningTable[]>([]), [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true), [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<DiningTable | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  async function load() {
    setLoading(true); setLoadFailed(false);
    try { const response = await fetch("/staff/tables", { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.message); setItems(result.data); }
    catch (error) { setLoadFailed(true); setMessage(error instanceof Error ? error.message : "Meja gagal dimuat. Coba lagi."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  return <section aria-labelledby="tables-heading"><h2 id="tables-heading">Daftar meja</h2><p className="senja-note">Meja aktif bukan berarti tersedia pada waktu tertentu. Slot reservasi belum dihitung. Hanya pemilik dapat mengubah konfigurasi meja.</p><p role="status">{message}</p>
    {loading ? <p role="status">Memuat meja…</p> : <><div className="sela-admin-table-wrap" role="region" aria-label="Daftar meja, dapat digeser horizontal" tabIndex={0}><table className="sela-admin-table"><thead><tr><th scope="col">Meja</th><th scope="col">Kapasitas</th><th scope="col">Status</th>{role === "owner" && <th scope="col">Tindakan</th>}</tr></thead><tbody>{items.map(item => <tr key={item.id}><th scope="row">{item.name}</th><td>{item.capacity} orang</td><td>{item.isActive ? "Aktif" : "Nonaktif"}</td>{role === "owner" && <td><button className="senja-text-button" onClick={() => setEditing(item)}>Edit {item.name}</button></td>}</tr>)}</tbody></table></div>{!items.length && <p>Belum ada meja. Pemilik dapat menambah meja di bawah.</p>}</>}
    {loadFailed && <button className="senja-text-button" disabled={loading || pending} onClick={() => void load()}>Coba lagi</button>}
    {role === "owner" && <form key={editing?.id ?? "new"} className="senja-form sela-menu-editor" onSubmit={async event => {
      event.preventDefault(); if (pending) return; const form = event.currentTarget, data = new FormData(form); setPending(true); setMessage("");
      try {
        const response = await fetch(`/staff/tables${editing ? `?id=${editing.id}` : ""}`, { method: editing ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: data.get("name"), capacity: Number(data.get("capacity")), isActive: data.get("active") === "on" }) });
        const result = await response.json(); if (!response.ok) throw new Error(result.message); setMessage("Meja tersimpan."); form.reset(); setEditing(null); await load();
      } catch (error) { setMessage(error instanceof Error ? error.message : "Meja gagal disimpan. Coba lagi."); }
      finally { setPending(false); }
    }}><h3>{editing ? "Edit meja" : "Tambah meja"}</h3><div className="senja-field"><label htmlFor="table-name">Nama meja</label><input id="table-name" name="name" maxLength={80} required defaultValue={editing?.name ?? ""} /></div><div className="senja-field"><label htmlFor="table-capacity">Kapasitas (orang)</label><input id="table-capacity" name="capacity" type="number" min={1} max={12} step={1} required defaultValue={editing?.capacity ?? 2} /></div><label><input name="active" type="checkbox" defaultChecked={editing?.isActive ?? true} /> Meja aktif</label><p className="senja-note">Tidak menghapus meja atau riwayat. Pengelolaan reservasi belum tersedia.</p><div className="senja-hero-actions"><button className="senja-button" disabled={pending}>{pending ? "Menyimpan…" : "Simpan meja"}</button>{editing && <button type="button" className="senja-text-button" onClick={() => setEditing(null)}>Batal edit</button>}</div></form>}
  </section>;
}
