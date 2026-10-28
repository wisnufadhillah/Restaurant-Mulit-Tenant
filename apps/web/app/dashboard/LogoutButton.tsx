"use client";

import { useState } from "react";

export default function LogoutButton() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  return <div><button type="button" className="senja-button" disabled={pending} onClick={async () => {
    setPending(true); setMessage("");
    try {
      const response = await fetch("/staff/logout", { method: "POST" });
      if (!response.ok) { setMessage("Logout belum berhasil. Coba lagi; sesi belum dicabut."); return; }
      window.location.replace("/login");
    } catch { setMessage("Tidak dapat menghubungi layanan. Coba logout lagi."); }
    finally { setPending(false); }
  }}>{pending ? "Sedang keluar…" : "Keluar"}</button><p role="alert">{message}</p></div>;
}
