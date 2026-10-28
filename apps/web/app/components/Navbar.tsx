"use client";

import { useState } from "react";

export default function Navbar({ name = "Rumah makan" }: { name?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="senja-header">
      <a className="senja-wordmark" href="#beranda" aria-label={`${name} — beranda`}>{name}<small>MASAKAN PADANG</small></a>
      <button className="senja-mobile-toggle senja-text-button" type="button" aria-expanded={open} aria-controls="senja-navigation" onClick={() => setOpen(!open)}>{open ? "Tutup navigasi" : "Navigasi"}</button>
      <nav id="senja-navigation" className={open ? "senja-nav is-open" : "senja-nav"} aria-label="Navigasi utama">
        {[["beranda", "Beranda"], ["tentang", "Tentang"], ["menu", "Menu"], ["lokasi", "Lokasi & Jam Buka"], ["reservasi", "Reservasi"]].map(([id, label]) => <a key={id} className={id === "reservasi" ? "senja-button" : undefined} href={`#${id}`} onClick={() => setOpen(false)}>{label}{id === "reservasi" && <span aria-hidden="true">↗</span>}</a>)}
      </nav>
    </header>
  );
}
