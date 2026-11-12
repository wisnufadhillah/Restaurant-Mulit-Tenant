"use client";

import { useEffect, useRef, useState } from "react";

export default function Navbar({ name = "Rumah makan" }: { name?: string }) {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 56rem)");
    const resized = () => { if (!query.matches) setOpen(false); };
    query.addEventListener("change", resized);
    return () => query.removeEventListener("change", resized);
  }, []);
  return (
    <header className="senja-header" onKeyDown={event => { if (event.key === "Escape" && open) { setOpen(false); toggle.current?.focus(); } }}>
      <a className="senja-wordmark" href="#beranda" aria-label={`${name} — beranda`}>{name}<small>MASAKAN PADANG</small></a>
      <button ref={toggle} className="senja-mobile-toggle senja-text-button" type="button" aria-label={open ? "Tutup navigasi" : "Buka navigasi"} aria-expanded={open} aria-controls="senja-navigation" onClick={() => setOpen(!open)}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d={open ? "M6 6l12 12M18 6L6 18" : "M4 6h16M4 12h16M4 18h16"} /></svg><span>{open ? "Tutup" : "Menu"}</span></button>
      <nav id="senja-navigation" className={open ? "senja-nav is-open" : "senja-nav"} aria-label="Navigasi utama">
        {[["beranda", "Beranda"], ["tentang", "Tentang"], ["menu", "Menu"], ["lokasi", "Lokasi & Jam Buka"], ["reservasi", "Reservasi"]].map(([id, label]) => <a key={id} className={id === "reservasi" ? "senja-button" : undefined} href={`#${id}`} onClick={() => setOpen(false)}>{label}{id === "reservasi" && <span aria-hidden="true">↗</span>}</a>)}
      </nav>
    </header>
  );
}
