"use client";

import { useEffect, useRef, useState } from "react";
import { menuImageSource } from "../../../api/src/menu/menu-images";
interface MenuItem { id: string; name: string; description: string; price: number; isActive: boolean; isAvailable: boolean; imageKey?: string | null; }

export default function MenuManager({ role }: { role: "owner" | "staff" }) {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true), [pending, setPending] = useState(false), [message, setMessage] = useState("");
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [imageKey, setImageKey] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!photo) { setPreview(""); return; }
    const url = URL.createObjectURL(photo); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);
  const imageSource = preview || menuImageSource(imageKey, true);
  const [loadFailed, setLoadFailed] = useState(false);
  const editor = useRef<HTMLFormElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const returnItemId = useRef<string | null>(null);
  const manager = useRef<HTMLElement>(null);
  function openEditor(item: MenuItem | null) {
    returnItemId.current = item?.id ?? null;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMessage(""); setEditing(item); setImageKey(menuImageSource(item?.imageKey) ? item!.imageKey! : ""); setPhoto(null); setEditorOpen(true);
  }
  useEffect(() => {
    if (!editorOpen) return;
    dialog.current?.showModal();
    editor.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => {
      const currentEdit = Array.from(manager.current?.querySelectorAll<HTMLButtonElement>("button[data-menu-edit]") ?? []).find(button => button.dataset.menuEdit === returnItemId.current);
      const fallback = manager.current?.querySelector<HTMLButtonElement>("button[data-menu-add]");
      (currentEdit ?? (returnFocus.current?.isConnected ? returnFocus.current : fallback))?.focus();
    };
  }, [editorOpen]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const visible = items.filter(item => item.name.toLocaleLowerCase("id-ID").includes(query.toLocaleLowerCase("id-ID")) && (filter === "all" || (filter === "available" ? item.isAvailable && item.isActive : filter === "sold-out" ? !item.isAvailable && item.isActive : !item.isActive)));
  async function load() {
    setLoading(true); setLoadFailed(false);
    try { const response = await fetch("/staff/menu", { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.message); setItems(result.data); }
    catch { setLoadFailed(true); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  async function save(path: string, method: string, body: unknown) {
    setPending(true); setMessage("");
    try {
      if (photo && body && typeof body === "object" && "imageKey" in body) {
        const upload = await fetch("/staff/menu/images", { method: "POST", headers: { "content-type": photo.type }, body: photo });
        const result = await upload.json(); if (!upload.ok) throw new Error(result.message);
        body = { ...body, imageKey: result.data.imageKey };
        setImageKey(result.data.imageKey); setPhoto(null);
      }
      const response = await fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json(); if (!response.ok) throw new Error(result.message); setMessage("Perubahan menu tersimpan."); await load(); return true; }
    catch (error) { setMessage(error instanceof Error ? error.message : "Menu gagal disimpan. Coba lagi."); return false; }
    finally { setPending(false); }
  }
  return <section ref={manager} className="sela-menu-manager" aria-labelledby="manage-menu-heading">
    <div className="sela-menu-toolbar"><div className="senja-field"><label htmlFor="menu-search">Cari menu</label><input id="menu-search" type="search" placeholder="Nama lauk" value={query} onChange={event => setQuery(event.target.value)} /></div><div className="senja-field"><label htmlFor="menu-filter">Status menu</label><select id="menu-filter" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">Semua menu</option><option value="available">Tersedia</option><option value="sold-out">Habis</option><option value="inactive">Tidak ditampilkan</option></select></div>{role === "owner" && <button data-menu-add className="senja-button" disabled={pending} onClick={() => openEditor(null)}>Tambah menu baru</button>}</div>
    <h2 id="manage-menu-heading" className="sela-list-heading">Daftar menu</h2><p className="senja-note">{role === "owner" ? "Pilih Tambah menu baru untuk menambah lauk. Edit untuk mengubah foto, harga atau visibilitas." : "Staff dapat mengubah tersedia/habis. Perubahan foto, harga dan visibilitas memerlukan pemilik."}</p>
    {!editorOpen && <p role="status">{message}</p>}
    {loading ? <p role="status">Memuat menu…</p> : <><div className="sela-admin-table-wrap" role="region" aria-label="Daftar menu restoran, geser horizontal jika diperlukan" tabIndex={0}><table className="sela-admin-table"><caption className="sela-table-caption">Menu dan harga dari katalog restoran</caption><thead><tr><th scope="col">Gambar</th><th scope="col">Nama menu</th><th scope="col">Harga</th><th scope="col">Ketersediaan</th><th scope="col">Di website</th><th scope="col">Tindakan</th></tr></thead><tbody>{visible.map(item => <tr key={item.id}><td className="sela-menu-photo-cell">{menuImageSource(item.imageKey, true) ? <img src={menuImageSource(item.imageKey, true)} alt={`Foto ${item.name}`} width="88" height="64" loading="lazy" /> : <span className="sela-menu-no-photo">Tanpa foto</span>}</td><th scope="row"><strong>{item.name}</strong><p>{item.description}</p></th><td className="sela-price-cell">{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(item.price)}</td><td><span className="sela-status-label">{item.isAvailable ? "Tersedia" : "Habis"}</span></td><td>{item.isActive ? "Ditampilkan" : "Disembunyikan"}</td><td><div className="sela-row-actions"><button className="senja-text-button" disabled={pending} aria-label={`${item.isAvailable ? "Tandai habis" : "Tandai tersedia"}: ${item.name}`} onClick={() => void save(`/staff/menu?id=${item.id}&availability=true`, "PATCH", { isAvailable: !item.isAvailable })}>{item.isAvailable ? "Tandai habis" : "Tandai tersedia"}</button>{role === "owner" && <button className="senja-text-button" disabled={pending} data-menu-edit={item.id} aria-label={`Edit ${item.name}`} onClick={() => openEditor(item)}>Edit</button>}</div></td></tr>)}</tbody></table></div>{visible.length === 0 && !loadFailed && <p className="sela-table-empty">{items.length ? "Tidak ada menu yang cocok. Hapus pencarian atau pilih Semua menu." : "Belum ada menu. Pemilik dapat memilih Tambah menu untuk memulai."}</p>}<p className="senja-note">Menampilkan {visible.length} dari {items.length} menu · Tabel dapat digeser pada layar kecil.</p></>}
    {loadFailed && <div className="sela-admin-recovery"><p role="alert">Menu gagal dimuat. Data terakhir tetap ditampilkan jika tersedia. Periksa koneksi lalu coba lagi.</p><button className="sela-button-outline" disabled={loading || pending} onClick={() => void load()}>Coba lagi</button></div>}
    {role === "owner" && editorOpen && <dialog ref={dialog} className="sela-menu-dialog" aria-labelledby="menu-editor-heading" onCancel={event => { if (pending) event.preventDefault(); }} onClose={() => { setEditorOpen(false); setEditing(null); setPhoto(null); }}><form ref={editor} key={editing?.id ?? "new"} className="senja-form sela-menu-editor" onSubmit={async event => {
      event.preventDefault(); if (pending) return; const form = event.currentTarget, data = new FormData(form);
      const ok = await save(editing ? `/staff/menu?id=${editing.id}` : "/staff/menu", editing ? "PATCH" : "POST", { name: data.get("name"), description: data.get("description"), price: Number(data.get("price")), isActive: data.get("active") === "on", isAvailable: data.get("available") === "on", imageKey: imageKey || null });
      if (ok) { form.reset(); setEditing(null); setEditorOpen(false); }
    }}><h3 id="menu-editor-heading">{editing ? "Edit menu" : "Tambah menu"}</h3><p role="status">{message}</p><div className="senja-field"><label htmlFor="menu-name">Nama menu</label><input id="menu-name" name="name" required maxLength={120} defaultValue={editing?.name ?? ""} /></div><div className="senja-field"><label htmlFor="menu-description">Deskripsi</label><textarea id="menu-description" name="description" maxLength={1000} defaultValue={editing?.description ?? ""} /></div><div className="senja-field"><label htmlFor="menu-price">Harga (Rupiah)</label><input id="menu-price" name="price" type="number" min={0} max={100000000} step={1} required defaultValue={editing?.price ?? ""} /></div><div className="senja-field"><label htmlFor="menu-upload">Unggah foto menu</label><input id="menu-upload" type="file" accept="image/jpeg,image/png,image/webp" disabled={pending} onChange={event => {
      const file = event.target.files?.[0]; if (!file) return;
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 4_000_000 || !file.size) { setMessage("Gunakan JPEG, PNG atau WebP maksimal 4 MB."); event.target.value = ""; return; }
      setMessage(""); setPhoto(file);
    }} />{(photo || imageKey) && <button type="button" className="senja-text-button" disabled={pending} onClick={() => { setPhoto(null); setImageKey(""); const input = editor.current?.querySelector<HTMLInputElement>("#menu-upload"); if (input) input.value = ""; }}>Hapus foto</button>}<p className="senja-note">JPEG, PNG atau WebP maksimal 4 MB. Foto diunggah saat menu disimpan.</p>{imageSource ? <img className="sela-menu-image-preview" src={imageSource} alt="Pratinjau foto menu" width="320" height="180" /> : <p className="senja-note">Foto hidangan belum tersedia.</p>}</div><label><input name="active" type="checkbox" defaultChecked={editing?.isActive ?? true} /> Tampilkan di situs</label><label><input name="available" type="checkbox" defaultChecked={editing?.isAvailable ?? true} /> Tersedia</label><div className="senja-hero-actions"><button className="senja-button" disabled={pending}>{pending ? "Menyimpan…" : "Simpan menu"}</button><button type="button" className="senja-text-button" disabled={pending} onClick={() => { setEditing(null); setEditorOpen(false); setPhoto(null); }}>Batal</button></div></form></dialog>}
  </section>;
}
