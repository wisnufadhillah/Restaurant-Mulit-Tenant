"use client";

import { useState } from "react";
import Link from "next/link";
import { RESTAURANT_INFO } from "../data/restaurant-data";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="navbar">
      <div className="container nav-container">
        {/* Brand Logo with Gonjong roof accent */}
        <Link href="/" className="brand-logo" id="nav-brand-logo">
          <div className="brand-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6" />
            </svg>
          </div>
          <div>
            <div className="brand-title">{RESTAURANT_INFO.name}</div>
            <div className="brand-subtitle">Masakan Padang Autentik</div>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="nav-links">
          <a href="#beranda" className="nav-link" id="nav-link-beranda">Beranda</a>
          <a href="#tentang" className="nav-link" id="nav-link-tentang">Tentang</a>
          <a href="#menu" className="nav-link" id="nav-link-menu">Buku Menu</a>
          <a href="#reservasi" className="nav-link" id="nav-link-reservasi">Cek Meja & Reservasi</a>
          <a href="#lokasi" className="nav-link" id="nav-link-lokasi">Lokasi & Jam Buka</a>
        </nav>

        {/* Nav Actions */}
        <div className="nav-actions">
          <Link href="/dashboard" className="btn btn-secondary" style={{ padding: "8px 18px", fontSize: "0.85rem" }} id="nav-btn-dashboard">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
            Staff Portal
          </Link>
          <a href="#reservasi" className="btn btn-primary" id="nav-btn-reservasi">
            Pesan Meja
          </a>
          <button 
            className="mobile-menu-btn" 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            id="nav-mobile-toggle"
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div id="mobile-navigation" style={{
          background: "#ffffff",
          padding: "20px 24px",
          borderBottom: "1px solid rgba(155, 27, 27, 0.12)",
          display: "flex",
          flexDirection: "column",
          gap: "16px"
        }}>
          <a href="#beranda" onClick={() => setMobileMenuOpen(false)} style={{ fontWeight: 600, color: "var(--color-gray-800)" }}>Beranda</a>
          <a href="#tentang" onClick={() => setMobileMenuOpen(false)} style={{ fontWeight: 600, color: "var(--color-gray-800)" }}>Tentang Kami</a>
          <a href="#menu" onClick={() => setMobileMenuOpen(false)} style={{ fontWeight: 600, color: "var(--color-gray-800)" }}>Buku Menu</a>
          <a href="#reservasi" onClick={() => setMobileMenuOpen(false)} style={{ fontWeight: 600, color: "var(--color-gray-800)" }}>Reservasi Meja</a>
          <a href="#lokasi" onClick={() => setMobileMenuOpen(false)} style={{ fontWeight: 600, color: "var(--color-gray-800)" }}>Lokasi & Jam Buka</a>
          <div style={{ paddingTop: "12px", borderTop: "1px solid #e5e7eb", display: "flex", gap: "10px" }}>
            <Link href="/dashboard" className="btn btn-secondary" style={{ flex: 1, padding: "10px" }}>
              Staff Portal
            </Link>
            <a href="#reservasi" onClick={() => setMobileMenuOpen(false)} className="btn btn-primary" style={{ flex: 1, padding: "10px" }}>
              Pesan Meja
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
