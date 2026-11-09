"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Details = { date: string; time: string; partySize: number; guestName: string; guestPhone: string };
type Receipt = { referenceCode: string; startAt: string; endAt: string; timezone: string; partySize: number; status: string };
type Attempt = { key: string; nonce: string; reservation: Details };
const display = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));

async function request(action: string, body: unknown = {}, key?: string) {
  const response = await fetch(`/reservation/${action}`, { method: "POST", headers: { "content-type": "application/json", ...(key ? { "idempotency-key": key } : {}) }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(20000) });
  const result = response.status === 204 ? {} : await response.json();
  if (!response.ok) throw Object.assign(new Error(result.message ?? "Permintaan gagal. Coba lagi tanpa mengganti percobaan."), { status: response.status });
  return result.data;
}

export default function ReservationSection() {
  const [details, setDetails] = useState<Details>({ date: "", time: "12:00", partySize: 2, guestName: "", guestPhone: "" });
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [summary, setSummary] = useState<(Details & { startAt: string; endAt: string }) | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const lock = useRef(false);
  const managementReady = useRef(false);

  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Layanan belum tersedia."); }
    finally { lock.current = false; setBusy(false); }
  }
  useEffect(() => {
    lock.current = true;
    const finish = () => { lock.current = false; setBootstrapping(false); };
    let key: string | null;
    try { key = sessionStorage.getItem("reservation_attempt") ?? sessionStorage.getItem("reservation_lookup"); }
    catch { setUncertain(true); setError("Penyimpanan browser tidak tersedia. Aktifkan penyimpanan untuk memakai reservasi dengan pemulihan aman."); finish(); return; }
    if (key && /^[A-Za-z0-9_-]{16,128}$/.test(key)) {
      setUncertain(true);
      setMessage("Memulihkan percobaan sebelumnya. Jangan membuat booking baru.");
      request("management", {}, key).then(() => request("receipt")).then((data: Receipt) => { setReceipt(data); managementReady.current = true; setUncertain(false); sessionStorage.setItem("reservation_lookup", key!); if (sessionStorage.getItem("reservation_attempt") === key) sessionStorage.removeItem("reservation_attempt"); }).catch(() => {
        setError("Percobaan sebelumnya belum dapat dipastikan. Periksa status lagi atau hubungi restoran sebelum membuat booking baru.");
      }).finally(finish);
    } else request("receipt").then((data: Receipt) => { setReceipt(data); managementReady.current = true; }).catch((error: unknown) => {
      if (!(error instanceof Error) || !("status" in error) || error.status !== 403) { setUncertain(true); setError("Status reservasi belum dapat diperiksa. Muat ulang untuk memulihkan; jangan buat booking baru."); }
    }).finally(finish);
  }, []);

  async function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await run(async () => {
      await request("session");
      const proposal = await request("confirmations", details);
      setSummary(proposal.summary);
      setAttempt({ key: crypto.randomUUID(), nonce: proposal.nonce, reservation: { ...details } });
      setMessage("Meja belum ditahan. Periksa ringkasan sebelum mengonfirmasi.");
    });
  }
  async function confirm() {
    if (!attempt) return;
    await run(async () => {
      sessionStorage.setItem("reservation_attempt", attempt.key);
      const wasUncertain = uncertain;
      setUncertain(true);
      let saved: Receipt;
      try { saved = await request("create", { reservation: attempt.reservation, nonce: attempt.nonce }, attempt.key); }
      catch (error) {
        if (!wasUncertain && error instanceof Error && "status" in error && [400, 403, 409].includes(Number(error.status))) {
          sessionStorage.removeItem("reservation_attempt"); setUncertain(false); setAttempt(null); setSummary(null);
        }
        throw error;
      }
      setReceipt(saved); setSummary(null);
      setDetails(current => ({ ...current, guestName: "", guestPhone: "" }));
      setMessage("Reservasi tersimpan. Menyiapkan akses privat…");
      await request("management", {}, attempt.key);
      managementReady.current = true;
      sessionStorage.setItem("reservation_lookup", attempt.key);
      sessionStorage.removeItem("reservation_attempt");
      setAttempt(null);
      setUncertain(false);
      setMessage("Reservasi tersimpan. Akses privat tersedia pada browser ini.");
    });
  }
  async function refresh() {
    await run(async () => {
      const key = attempt?.key ?? sessionStorage.getItem("reservation_attempt") ?? sessionStorage.getItem("reservation_lookup");
      if (key) { await request("management", {}, key); managementReady.current = true; }
      const current: Receipt = await request("receipt");
      if (key) sessionStorage.setItem("reservation_lookup", key);
      setReceipt(current); setAttempt(null); setUncertain(false); sessionStorage.removeItem("reservation_attempt"); setMessage("Status terbaru dimuat.");
    });
  }
  async function settle() {
    await run(async () => {
      const key = attempt?.key ?? sessionStorage.getItem("reservation_attempt");
      if (!key) throw new Error("Percobaan tidak ditemukan. Hubungi restoran untuk memeriksa status.");
      const result = await request("recovery", {}, key);
      if (result?.outcome === "reservation_exists") {
        await request("management", {}, key);
        const current: Receipt = await request("receipt");
        sessionStorage.setItem("reservation_lookup", key);
        managementReady.current = true;
        setReceipt(current);
        setMessage("Reservasi ditemukan. Akses privat dipulihkan.");
      } else if (result?.outcome === "not_created") {
        setReceipt(null);
        setMessage("Percobaan ditutup tanpa reservasi. Periksa ulang detail untuk memulai lagi.");
      } else throw new Error("Hasil belum dapat dipastikan. Jangan membuat booking baru.");
      if (sessionStorage.getItem("reservation_attempt") === key) sessionStorage.removeItem("reservation_attempt");
      setAttempt(null); setSummary(null); setUncertain(false); setCancelConfirm(false);
    });
  }
  const recovery = uncertain ? <div><p>Selesaikan percobaan untuk memastikan hasil. Jika belum tersimpan, seluruh ringkasan yang belum dikonfirmasi pada sesi browser ini, termasuk tab lain, tidak berlaku lagi. Booking tersimpan tidak dibatalkan.</p><button disabled={busy} onClick={settle}>Selesaikan percobaan</button></div> : null;
  return <section className="senja-section senja-reservation" id="reservasi" aria-labelledby="reservation-heading">
    <div><p className="senja-eyebrow">SISIHKAN WAKTUNYA</p><h2 id="reservation-heading">Meja untuk cerita berikutnya.</h2><p className="senja-note">Tanpa akun · Durasi 90 menit · Pesan minimal 60 menit sebelumnya, maksimal 30 hari ke depan.</p><p>Kontak hanya dikirim melalui form privat, bukan chatbot. Simpan akses pada browser ini; kode referensi bukan bukti akses.</p></div>
    <div className="senja-service-state">
      <p role="status" aria-live="polite">{busy ? "Memproses…" : message}</p>
      {error ? <p role="alert">{error}</p> : null}
      {bootstrapping ? null : recovery}
      {bootstrapping ? <p role="status">Memeriksa akses reservasi sebelumnya…</p> : receipt ? <div><h3>Reservasi {receipt.status === "cancelled" ? "dibatalkan" : receipt.status === "confirmed" ? "terkonfirmasi" : receipt.status}</h3><p>Kode: <strong>{receipt.referenceCode}</strong></p><p>{display(receipt.startAt)} WIB – {display(receipt.endAt)} WIB · {receipt.partySize} tamu</p>
        <button className="senja-button" disabled={busy} onClick={refresh}>Muat status / pulihkan akses</button>
        {receipt.status === "confirmed" ? <div>{cancelConfirm ? <><p>Batalkan reservasi ini? Pembatalan paling lambat dua jam sebelum mulai.</p><button disabled={busy} onClick={() => run(async () => { if (!managementReady.current) throw new Error("Pulihkan akses privat terlebih dahulu."); setReceipt(await request("cancel", { referenceCode: receipt.referenceCode })); setCancelConfirm(false); setMessage("Reservasi dibatalkan."); })}>Ya, batalkan reservasi</button><button disabled={busy} onClick={() => setCancelConfirm(false)}>Tetap simpan reservasi</button></> : <button disabled={busy} onClick={() => setCancelConfirm(true)}>Batalkan reservasi</button>}</div> : null}
        <button disabled={busy || uncertain || !!attempt} onClick={() => run(async () => { await request("logout"); sessionStorage.removeItem("reservation_lookup"); managementReady.current = false; setReceipt(null); setAttempt(null); setMessage("Akses privat ditutup. Sesi pembuat tetap tersimpan; jangan gunakan perangkat bersama."); })}>Tutup akses privat</button>
      </div> : summary && attempt ? <div><h3>Periksa reservasi</h3><p>{display(summary.startAt)} WIB · {summary.partySize} tamu · 90 menit</p><p>{summary.guestName} · {summary.guestPhone}</p><p>Meja belum ditahan. Konfirmasi akan memeriksa ketersediaan lagi.</p><button className="senja-button" disabled={busy} onClick={confirm}>{uncertain ? "Coba ulang percobaan yang sama" : "Konfirmasi reservasi"}</button><button disabled={busy || uncertain} onClick={() => { setSummary(null); setAttempt(null); setMessage(""); }}>Koreksi detail</button>{uncertain ? <p>Hasil belum pasti. Jangan mengganti detail atau membuat booking baru. Jangan tutup halaman sebelum status dipulihkan.</p> : null}</div> : uncertain ? <div><p>Hasil percobaan sebelumnya belum pasti. Jangan buat reservasi baru. Periksa status lagi atau hubungi restoran.</p><button className="senja-button" disabled={busy} onClick={refresh}>Periksa status percobaan</button></div> : <form onSubmit={prepare}><fieldset disabled={busy}><legend>Detail kunjungan</legend><label>Tanggal (WIB)<input name="date" type="date" required value={details.date} onChange={e => setDetails({ ...details, date: e.target.value })} /></label><label>Jam (WIB)<input name="time" type="time" required value={details.time} onChange={e => setDetails({ ...details, time: e.target.value })} /></label><label>Jumlah tamu<input name="partySize" type="number" min="1" max="12" required value={details.partySize} onChange={e => setDetails({ ...details, partySize: Number(e.target.value) })} /></label><label>Nama<input name="guestName" autoComplete="name" maxLength={120} required value={details.guestName} onChange={e => setDetails({ ...details, guestName: e.target.value })} /></label><label>Nomor telepon<input name="guestPhone" type="tel" autoComplete="tel" maxLength={40} required value={details.guestPhone} onChange={e => setDetails({ ...details, guestPhone: e.target.value })} /></label><button className="senja-button" type="submit">Periksa meja dan ringkasan</button></fieldset></form>}
    </div>
  </section>;
}
