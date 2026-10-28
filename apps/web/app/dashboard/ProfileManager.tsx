"use client";
import { useEffect, useState } from "react";
interface Profile { name: string; outletName: string; address: string; contactPhone: string; }
export default function ProfileManager({ role }: { role: "owner" | "staff" }) {
  const [profile, setProfile] = useState<Profile | null>(null), [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  async function load() {
    setLoadFailed(false);
    try { const response = await fetch("/staff/profile", { cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.message); setProfile(result.data); }
    catch (error) { setLoadFailed(true); setMessage(error instanceof Error ? error.message : "Profil gagal dimuat. Coba lagi."); }
  }
  useEffect(() => { void load(); }, []);
  return <section><h2>Profil restoran</h2><p className="senja-note">Informasi ini dipublikasikan. Jangan masukkan nomor kontak pribadi customer. Hanya pemilik dapat mengubah profil.</p><p role="status">{message}</p>{profile ? <form className="senja-form sela-menu-editor" onSubmit={async event => {
    event.preventDefault(); if (pending || role !== "owner") return; const data = new FormData(event.currentTarget); setPending(true); setMessage("");
    try { const response = await fetch("/staff/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.fromEntries(data)) }); const result = await response.json(); if (!response.ok) throw new Error(result.message); setMessage("Profil restoran tersimpan."); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Profil gagal disimpan. Coba lagi."); } finally { setPending(false); }
  }}>{([["name", "Nama restoran", 120], ["outletName", "Nama outlet", 120], ["address", "Alamat publik", 500], ["contactPhone", "Kontak publik (opsional)", 40]] as const).map(([name, label, max]) => <div className="senja-field" key={name}><label htmlFor={`profile-${name}`}>{label}</label><input id={`profile-${name}`} name={name} defaultValue={profile[name]} maxLength={max} required={name !== "contactPhone"} readOnly={role !== "owner"} /></div>)}{role === "owner" && <button className="senja-button" disabled={pending}>{pending ? "Menyimpan…" : "Simpan profil"}</button>}</form> : <p>Profil belum dimuat.</p>}{loadFailed && <button className="senja-text-button" disabled={pending} onClick={() => void load()}>Coba lagi</button>}</section>;
}
