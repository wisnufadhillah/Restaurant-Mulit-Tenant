"use client";

import { useEffect, useRef, useState } from "react";
interface MenuItem { id: string; name: string; description: string; price: number; isActive: boolean; isAvailable: boolean; }

export default function MenuManager({ role }: { role: "owner" | "staff" }) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true), [pending, setPending] = useState(false), [message, setMessage] = useState("");
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const editor = useRef<HTMLFormElement>(null);
  useEffect(() => { if (editorOpen) editor.current?.querySelector<HTMLInputElement>("input")?.focus(); }, [editorOpen, editing]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const visible = items.filter(item => item.name.toLocaleLowerCase("id-ID").includes(query.toLocaleLowerCase("id-ID")) && (filter === "all" || (filter === "available" ? item.isAvailable && item.isActive : filter === "sold-out" ? !item.isAvailable && item.isActive : !item.isActive)));
  async function load() {
    setLoading(true); setLoadFailed(false);
    try { const response = await fetch("/staff/menu", { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.message); setItems(result.data); }
    catch (error) { setLoadFailed(true); setMessage(error instanceof Error ? error.message : "Menu gagal dimuat. Coba lagi."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function save(path: string, method: string, body: unknown) {
    setPending(true); setMessage("");
    try { const response = await fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json(); if (!response.ok) throw new Error(result.message); setMessage("Perubahan menu tersimpan."); await load(); return true; }
    catch (error) { setMessage(error instanceof Error ? error.message : "Menu gagal disimpan. Coba lagi."); return false; }
    finally { setPending(false); }
  }
  return <section className="sela-menu-manager" aria-labelledby="manage-menu-heading">
    <div className="sela-menu-toolbar"><div className="senja-field"><label htmlFor="menu-search">Cari menu</label><input id="menu-search" type="search" placeholder="Nama lauk" value={query} onChange={event => setQuery(event.target.value)} /></div><div className="senja-field"><label htmlFor="menu-filter">Status menu</label><select id="menu-filter" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Semua menu</option><option value="available">Tersedia</option><option value="sold-out">Habis</option><option value="inactive">Tidak ditampilkan</option></select></div>{role === "owner" && <button className="senja-button" disabled={pending} onClick={() => { setEditing(null); setEditorOpen(true); }}>Tambah menu baru</button>}</div>
    <h2 id="manage-menu-heading" className="sela-list-heading">Daftar menu</h2><p className="senja-note">{role === "owner" ? "Pilih Tambah menu baru untuk menambah lauk. Edit untuk mengubah harga atau visibilitas." : "Staff dapat mengubah tersedia/habis. Perubahan harga dan visibilitas memerlukan pemilik."}</p>
    <p role="status">{message}</p>
    {loading ? <p role="status">Memuat menu…</p> : <><div className="sela-admin-table-wrap" role="region" aria-label="Daftar menu restoran, geser horizontal jika diperlukan" tabIndex={0}><table className="sela-admin-table"><caption className="sela-table-caption">Menu dan harga dari katalog restoran</caption><thead><tr><th scope="col">Nama menu</th><th scope="col">Harga</th><th scope="col">Ketersediaan</th><th scope="col">Di website</th><th scope="col">Tindakan</th></tr></thead><tbody>{visible.map(item => <tr key={item.id}><th scope="row"><strong>{item.name}</strong><p>{item.description}</p></th><td className="sela-price-cell">{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(item.price)}</td><td><span className="sela-status-label">{item.isAvailable ? "Tersedia" : "Habis"}</span></td><td>{item.isActive ? "Ditampilkan" : "Disembunyikan"}</td><td><div className="sela-row-actions"><button className="senja-text-button" disabled={pending} aria-label={`${item.isAvailable ? "Tandai habis" : "Tandai tersedia"}: ${item.name}`} onClick={() => void save(`/staff/menu?id=${item.id}&availability=true`, "PATCH", { isAvailable: !item.isAvailable })}>{item.isAvailable ? "Tandai habis" : "Tandai tersedia"}</button>{role === "owner" && <button className="senja-text-button" disabled={pending} aria-label={`Edit ${item.name}`} onClick={() => { setEditing(item); setEditorOpen(true); }}>Edit</button>}</div></td></tr>)}</tbody></table></div>{visible.length === 0 && <p className="sela-table-empty">{items.length ? "Tidak ada menu yang cocok. Hapus pencarian atau pilih Semua menu." : "Belum ada menu. Pemilik dapat memilih Tambah menu untuk memulai."}</p>}<p className="senja-note">Menampilkan {visible.length} dari {items.length} menu · Tabel dapat digeser pada layar kecil.</p></>}
    {loadFailed && <button className="senja-text-button" disabled={loading || pending} onClick={() => void load()}>Coba lagi</button>}
    {role === "owner" && editorOpen && <form ref={editor} key={editing?.id ?? "new"} className="senja-form sela-menu-editor" onSubmit={async event => {
      event.preventDefault(); if (pending) return; const form = event.currentTarget, data = new FormData(form);
      const ok = await save(editing ? `/staff/menu?id=${editing.id}` : "/staff/menu", editing ? "PATCH" : "POST", { name: data.get("name"), description: data.get("description"), price: Number(data.get("price")), isActive: data.get("active") === "on", isAvailable: data.get("available") === "on" });
      if (ok) { form.reset(); setEditing(null); setEditorOpen(false); }
    }}><h3>{editing ? "Edit menu" : "Tambah menu"}</h3><div className="senja-field"><label htmlFor="menu-name">Nama menu</label><input id="menu-name" name="name" required maxLength={120} defaultValue={editing?.name ?? ""} /></div><div className="senja-field"><label htmlFor="menu-description">Deskripsi</label><textarea id="menu-description" name="description" maxLength={1000} defaultValue={editing?.description ?? ""} /></div><div className="senja-field"><label htmlFor="menu-price">Harga (Rupiah)</label><input id="menu-price" name="price" type="number" min={0} max={100000000} step={1} required defaultValue={editing?.price ?? ""} /></div><label><input name="active" type="checkbox" defaultChecked={editing?.isActive ?? true} /> Tampilkan di situs</label><label><input name="available" type="checkbox" defaultChecked={editing?.isAvailable ?? true} /> Tersedia</label><div className="senja-hero-actions"><button className="senja-button" disabled={pending}>{pending ? "Menyimpan…" : "Simpan menu"}</button><button type="button" className="senja-text-button" disabled={pending} onClick={() => { setEditing(null); setEditorOpen(false); }}>Batal</button></div></form>}
  </section>;
}
