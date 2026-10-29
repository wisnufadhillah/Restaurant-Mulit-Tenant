import Link from "next/link";
import { redirect } from "next/navigation";
import { staffSession } from "../staff-session";
import LogoutButton from "./LogoutButton";
import MenuManager from "./MenuManager";
import TableManager from "./TableManager";
import HoursManager from "./HoursManager";
import ProfileManager from "./ProfileManager";
import "./dashboard.css";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await searchParams).tab;
  const tables = tab === "tables", hours = tab === "hours", profile = tab === "profile";
  let session;
  let unavailable = false;
  try { session = await staffSession(); } catch { unavailable = true; }
  if (!unavailable && !session) redirect("/login");
  return <div className="senja-site sela-admin">
    <a className="senja-skip" href="#staff-content">Lewati ke konten</a>
    <aside className="sela-admin-sidebar">
      <Link className="senja-wordmark" href="/">Dapur Sela</Link><p className="sela-admin-caption">RUANG PENGELOLA</p>
      <div className="sela-admin-outlet"><p>RESTORAN</p><strong>{session?.slug ?? "Sesi belum terverifikasi"}</strong></div>
      <nav aria-label="Navigasi pengelola"><Link href="/dashboard" aria-current={!tables && !hours && !profile ? "page" : undefined}>Menu</Link><Link href="/dashboard?tab=tables" aria-current={tables ? "page" : undefined}>Meja</Link><Link href="/dashboard?tab=hours" aria-current={hours ? "page" : undefined}>Jam operasional</Link><Link href="/dashboard?tab=profile" aria-current={profile ? "page" : undefined}>Profil</Link></nav>
      <p className="sela-admin-upcoming">Reservasi, hari khusus dan pengetahuan belum tersedia.</p>
      {session && <div className="sela-admin-account"><strong>{session.username}</strong><p>{session.role === "owner" ? "Pemilik" : "Staff operasional"}</p><LogoutButton /></div>}
    </aside>
    <main id="staff-content" className="sela-admin-main">
      <div className="sela-admin-topline"><p>DAPUR SELA / {profile ? "PROFIL" : hours ? "JAM OPERASIONAL" : tables ? "MEJA" : "MENU"}</p><Link className="sela-button-outline" href="/">Lihat website</Link></div>
      <header className="sela-admin-heading"><h1>{profile ? "Profil restoran" : hours ? "Jam operasional" : tables ? "Meja restoran" : "Menu restoran"}</h1><p>{profile ? "Kelola informasi publik restoran dan outlet." : hours ? "Atur hari buka dan jam pelayanan mingguan." : tables ? "Atur kapasitas dan status meja pada outlet restoran." : "Kelola lauk Padang, harga, dan ketersediaan di satu tempat."}</p></header>
      {unavailable ? <div className="senja-service-state"><h2>Sesi belum dapat diperiksa.</h2><p role="alert">Pastikan API berjalan, lalu muat ulang halaman. Data restoran belum ditampilkan.</p><Link className="senja-text-link" href="/dashboard">Periksa sesi lagi</Link></div> : profile ? <ProfileManager role={session!.role} /> : hours ? <HoursManager role={session!.role} /> : tables ? <TableManager role={session!.role} /> : <MenuManager role={session!.role} />}
    </main>
  </div>;
}
