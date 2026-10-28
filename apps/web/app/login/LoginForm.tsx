"use client";

import { useState } from "react";

export default function LoginForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <form className="senja-form" onSubmit={async event => {
    event.preventDefault();
    if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setPending(true); setError("");
    try {
      const response = await fetch("/staff/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tenantSlug: data.get("tenantSlug"), username: data.get("username"), password: data.get("password") }) });
      const result = await response.json();
      if (!response.ok) { setError(result.message ?? "Login gagal. Coba lagi."); return; }
      form.reset();
      window.location.replace("/dashboard");
    } catch { setError("Tidak dapat menghubungi layanan. Periksa koneksi dan coba lagi."); }
    finally { setPending(false); }
  }}>
    <div className="senja-field"><label htmlFor="staff-tenant">Kode restoran</label>
    <input id="staff-tenant" name="tenantSlug" placeholder="Contoh: demo-padang" required maxLength={80} autoCapitalize="none" spellCheck={false} aria-describedby="login-help" /></div>
    <div className="senja-field"><label htmlFor="staff-username">Nama pengguna</label>
    <input id="staff-username" name="username" required minLength={3} maxLength={64} autoComplete="username" autoCapitalize="none" spellCheck={false} /></div>
    <div className="senja-field"><label htmlFor="staff-password">Password</label>
    <input id="staff-password" name="password" type="password" required minLength={12} maxLength={1024} autoComplete="current-password" /></div>
    <p id="login-help" className="senja-note">Gunakan akun yang diberikan pengelola. Tidak ada akun bawaan atau pendaftaran publik.</p>
    <button type="submit" className="senja-button" disabled={pending}>{pending ? "Sedang masuk…" : "Masuk ke ruang kerja"}</button>
    <p role="alert">{error}</p>
  </form>;
}
