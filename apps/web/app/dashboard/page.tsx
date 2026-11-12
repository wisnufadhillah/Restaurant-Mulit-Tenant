import Link from "next/link";
import { redirect } from "next/navigation";
import { staffSession } from "../staff-session";
import LogoutButton from "./LogoutButton";
import MenuManager from "./MenuManager";
import ReservationManager from "./ReservationManager";
import TableManager from "./TableManager";
import HoursManager from "./HoursManager";
import ProfileManager from "./ProfileManager";
import DashboardViews from "./DashboardViews";
import AuditManager from "./AuditManager";
import DashboardShell from "./DashboardShell";
import "./dashboard.css";

const sections = [
  { key: "overview", label: "Ikhtisar", description: "Ringkasan operasional", icon: "overview" },
  { key: "reservations", label: "Reservasi", description: "Kunjungan dan meja tamu", icon: "calendar" },
  { key: "outlets", label: "Lokasi restoran", description: "Lokasi, jam dan meja", icon: "building" },
  { key: "menu", label: "Menu masakan", description: "Ketersediaan dan harga", icon: "menu" },
  { key: "audit", label: "Audit aktivitas", description: "Riwayat perubahan operasional", icon: "audit" },
];
const titles: Record<string, [string, string]> = {
  overview: ["Ikhtisar operasional restoran", "Pantau informasi restoran dan akses pekerjaan harian dari satu tempat."],
  reservations: ["Manajemen reservasi meja", "Daftar kunjungan, jadwal kedatangan dan penempatan meja."],
  outlets: ["Lokasi restoran", "Informasi lokasi, kontak publik, jadwal pelayanan dan konfigurasi meja."],
  menu: ["Katalog menu masakan", "Kelola harga, ketersediaan dan hidangan yang tampil di website."],
  audit: ["Audit dan jejak aktivitas", "Riwayat perubahan data operasional restoran."],
  tables: ["Konfigurasi meja", "Atur nama, kapasitas dan status meja pada lokasi restoran."],
  hours: ["Jam operasional", "Atur jadwal mingguan dan pengecualian tanggal khusus."],
  profile: ["Profil restoran", "Kelola informasi restoran dan kontak yang ditampilkan kepada pengunjung."],
};

function DashboardIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    calendar: "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M7 3v4 M17 3v4 M3 11h18",
    building: "M5 21V5l7-2 7 2v16 M3 21h18 M9 8h1 M14 8h1 M9 12h1 M14 12h1 M10 21v-5h4v5",
    menu: "M12 5v16 M12 5C8 2 4 3 2 4v15c4-1 7 0 10 2 M12 5c4-3 8-2 10-1v15c-4-1-7 0-10 2",
    audit: "M9 4H5v17h14V4h-4 M9 3h6v4H9z M8 11h8 M8 15h8",
  };
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.overview} /></svg>;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const requestedTab = (await searchParams).tab ?? "overview";
  const tab = requestedTab === "categories" ? "menu" : Object.hasOwn(titles, requestedTab) ? requestedTab : "overview";
  const active = ["tables", "hours", "profile"].includes(tab) ? "outlets" : tab;
  let session;
  let unavailable = false;
  try { session = await staffSession(); } catch { unavailable = true; }
  if (!unavailable && !session) redirect("/login");
  const [title, description] = titles[tab];
  return <DashboardShell navigationKey={tab} topbar={<><p>Dapur Sela <span>/</span> Operasional</p><div><span className="sela-admin-timezone">Zona waktu: WIB (UTC+7)</span><Link href="/">Lihat website</Link></div></>} sidebar={<>
      <Link className="sela-admin-brand" href="/"><span className="sela-admin-monogram">DS</span><span><strong>Dapur Sela</strong><small>RUANG OPERASIONAL</small></span></Link>
      <div className="sela-admin-outlet"><span>RESTORAN</span><strong>{session?.slug ?? "Sesi belum terverifikasi"}</strong><small>{session ? "Sesi terverifikasi" : "Layanan belum terhubung"}</small></div>
      <nav aria-label="Navigasi pengelola">{sections.map(section => <Link key={section.key} href={section.key === "overview" ? "/dashboard" : `/dashboard?tab=${section.key}`} aria-current={active === section.key ? "page" : undefined}><DashboardIcon name={section.icon} /><span><strong>{section.label}</strong><small>{section.description}</small></span></Link>)}</nav>
      {session && <div className="sela-admin-account"><span className="sela-admin-avatar" aria-hidden="true">{session.username.slice(0, 1).toUpperCase()}</span><div><strong>{session.username}</strong><p>{session.role === "owner" ? "Pemilik restoran" : "Staff operasional"}</p></div><LogoutButton /></div>}
    </>}>
      <main id="staff-content" className="sela-admin-main" tabIndex={-1}>
        <header className="sela-admin-heading"><div><p className="sela-admin-breadcrumb">Ruang pengelola / {sections.find(section => section.key === active)?.label}</p><h1>{title}</h1><p>{description}</p></div>{tab === "overview" && <Link className="senja-button" href="/dashboard?tab=menu">Kelola menu <span aria-hidden="true">→</span></Link>}</header>
        {active === "outlets" && <nav className="sela-admin-subnav" aria-label="Pengaturan lokasi restoran">{[["outlets", "Lokasi"], ["profile", "Profil"], ["hours", "Jam & hari khusus"], ["tables", "Meja"]].map(([key, label]) => <Link key={key} href={`/dashboard?tab=${key}`} aria-current={tab === key ? "page" : undefined}>{label}</Link>)}</nav>}
        {unavailable ? <div className="senja-service-state"><h2>Sesi belum dapat diperiksa.</h2><p role="alert">Pastikan API berjalan, lalu muat ulang halaman. Data restoran belum ditampilkan.</p><Link className="senja-text-link" href="/dashboard">Periksa sesi lagi</Link></div> : tab === "reservations" ? <ReservationManager /> : tab === "profile" ? <ProfileManager role={session!.role} /> : tab === "hours" ? <HoursManager role={session!.role} /> : tab === "tables" ? <TableManager role={session!.role} /> : tab === "menu" ? <MenuManager role={session!.role} /> : tab === "overview" || tab === "outlets" ? <DashboardViews view={tab} /> : <AuditManager />}
      </main>
  </DashboardShell>;
}
