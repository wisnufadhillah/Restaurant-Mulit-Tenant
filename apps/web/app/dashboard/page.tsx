import Link from "next/link";
import { redirect } from "next/navigation";
import { staffSession } from "../staff-session";
import LogoutButton from "./LogoutButton";
import MenuManager from "./MenuManager";
import TableManager from "./TableManager";
import HoursManager from "./HoursManager";
import ProfileManager from "./ProfileManager";
import DashboardViews from "./DashboardViews";
import "./dashboard.css";

const sections = [
  { key: "overview", label: "Ikhtisar", description: "Ringkasan operasional", icon: "overview" },
  { key: "reservations", label: "Reservasi", description: "Kunjungan dan meja tamu", icon: "calendar" },
  { key: "outlets", label: "Cabang restoran", description: "Lokasi, jam dan meja", icon: "building" },
  { key: "menu", label: "Menu masakan", description: "Ketersediaan dan harga", icon: "menu" },
  { key: "categories", label: "Kategori menu", description: "Pengelompokan hidangan", icon: "tag" },
  { key: "audit", label: "Audit aktivitas", description: "Riwayat perubahan operasional", icon: "audit" },
];
const titles: Record<string, [string, string]> = {
  overview: ["Ikhtisar operasional restoran", "Pantau informasi restoran dan akses pekerjaan harian dari satu tempat."],
  reservations: ["Manajemen reservasi meja", "Daftar kunjungan, jadwal kedatangan dan penempatan meja."],
  outlets: ["Cabang restoran", "Informasi lokasi, kontak publik, jadwal pelayanan dan konfigurasi meja."],
  menu: ["Katalog menu masakan", "Kelola harga, ketersediaan dan hidangan yang tampil di website."],
  categories: ["Kategori menu masakan", "Pengelompokan hidangan agar katalog lebih mudah dijelajahi."],
  audit: ["Audit dan jejak aktivitas", "Riwayat perubahan data operasional restoran."],
  tables: ["Konfigurasi meja", "Atur nama, kapasitas dan status meja pada outlet restoran."],
  hours: ["Jam operasional", "Atur jadwal mingguan dan pengecualian tanggal khusus."],
  profile: ["Profil restoran", "Kelola informasi restoran dan kontak yang ditampilkan kepada pengunjung."],
};

function DashboardIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    overview: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
    calendar: "M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M7 3v4 M17 3v4 M3 11h18",
    building: "M5 21V5l7-2 7 2v16 M3 21h18 M9 8h1 M14 8h1 M9 12h1 M14 12h1 M10 21v-5h4v5",
    menu: "M12 5v16 M12 5C8 2 4 3 2 4v15c4-1 7 0 10 2 M12 5c4-3 8-2 10-1v15c-4-1-7 0-10 2",
    tag: "M3 3h8l10 10-8 8L3 11z M7 7h.01",
    audit: "M9 4H5v17h14V4h-4 M9 3h6v4H9z M8 11h8 M8 15h8",
  };
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] ?? paths.overview} /></svg>;
}

function UnconnectedView({ tab }: { tab: string }) {
  const columns = tab === "reservations" ? ["Kode booking", "Tamu", "Jadwal kedatangan", "Lokasi / meja", "Kapasitas", "Status"] : tab === "categories" ? ["Urutan", "Nama kategori", "Status", "Tindakan"] : ["Waktu (WIB)", "Aktivitas", "Entitas", "Pelaku", "Rincian"];
  return <section aria-label={titles[tab][0]}>
    <div className="sela-admin-notice"><span className="sela-status-label">Belum terhubung</span><p>{tab === "reservations" ? "Pengelolaan reservasi belum tersedia. Belum ada daftar booking yang dapat ditampilkan atau diproses di sini." : tab === "categories" ? "Pengelolaan kategori belum tersedia. Menu yang sudah ada tetap dapat dikelola melalui Menu masakan." : "Pencatatan audit tersedia di layanan bisnis, tetapi pembacaan riwayat belum terhubung ke dashboard ini."}</p></div>
    <div className="sela-admin-table-wrap" role="region" aria-label="Struktur daftar, dapat digeser horizontal" tabIndex={0}><table className="sela-admin-table"><thead><tr>{columns.map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead><tbody><tr><td colSpan={columns.length}><div className="sela-admin-empty"><DashboardIcon name={tab === "categories" ? "tag" : tab === "audit" ? "audit" : "calendar"} /><h2>{tab === "categories" ? "Kategori belum dapat dikelola" : tab === "audit" ? "Riwayat belum dapat ditampilkan" : "Reservasi belum dapat dikelola"}</h2><p>Data tidak ditampilkan sampai layanan ini terhubung.</p><Link className="sela-button-outline" href={tab === "categories" ? "/dashboard?tab=menu" : "/dashboard"}>{tab === "categories" ? "Buka menu masakan" : "Kembali ke ikhtisar"}</Link></div></td></tr></tbody></table></div>
  </section>;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const requestedTab = (await searchParams).tab ?? "overview";
  const tab = Object.hasOwn(titles, requestedTab) ? requestedTab : "overview";
  const active = ["tables", "hours", "profile"].includes(tab) ? "outlets" : tab;
  let session;
  let unavailable = false;
  try { session = await staffSession(); } catch { unavailable = true; }
  if (!unavailable && !session) redirect("/login");
  const [title, description] = titles[tab];
  return <div className="senja-site sela-admin">
    <a className="senja-skip" href="#staff-content">Lewati ke konten</a>
    <aside className="sela-admin-sidebar">
      <Link className="sela-admin-brand" href="/"><span className="sela-admin-monogram">DS</span><span><strong>Dapur Sela</strong><small>RUANG OPERASIONAL</small></span></Link>
      <div className="sela-admin-outlet"><span>RESTORAN</span><strong>{session?.slug ?? "Sesi belum terverifikasi"}</strong><small>{session ? "Sesi terverifikasi" : "Layanan belum terhubung"}</small></div>
      <nav aria-label="Navigasi pengelola">{sections.map(section => <Link key={section.key} href={section.key === "overview" ? "/dashboard" : `/dashboard?tab=${section.key}`} aria-current={active === section.key ? "page" : undefined}><DashboardIcon name={section.icon} /><span><strong>{section.label}</strong><small>{section.description}</small></span></Link>)}</nav>
      {session && <div className="sela-admin-account"><span className="sela-admin-avatar" aria-hidden="true">{session.username.slice(0, 1).toUpperCase()}</span><div><strong>{session.username}</strong><p>{session.role === "owner" ? "Pemilik restoran" : "Staff operasional"}</p></div><LogoutButton /></div>}
    </aside>
    <div className="sela-admin-workspace">
      <div className="sela-admin-topline"><p>DAPUR SELA <span>/</span> OPERASIONAL</p><div><span className="sela-admin-timezone">Zona waktu: WIB (UTC+7)</span><Link href="/">Lihat website <span aria-hidden="true">↗</span></Link></div></div>
      <main id="staff-content" className="sela-admin-main">
        <header className="sela-admin-heading"><div><p className="sela-admin-breadcrumb">Ruang pengelola / {sections.find(section => section.key === active)?.label}</p><h1>{title}</h1><p>{description}</p></div>{tab === "overview" && <Link className="senja-button" href="/dashboard?tab=menu">Kelola menu <span aria-hidden="true">→</span></Link>}</header>
        {active === "outlets" && <nav className="sela-admin-subnav" aria-label="Pengaturan outlet">{[["outlets", "Lokasi"], ["profile", "Profil"], ["hours", "Jam & hari khusus"], ["tables", "Meja"]].map(([key, label]) => <Link key={key} href={`/dashboard?tab=${key}`} aria-current={tab === key ? "page" : undefined}>{label}</Link>)}</nav>}
        {unavailable ? <div className="senja-service-state"><h2>Sesi belum dapat diperiksa.</h2><p role="alert">Pastikan API berjalan, lalu muat ulang halaman. Data restoran belum ditampilkan.</p><Link className="senja-text-link" href="/dashboard">Periksa sesi lagi</Link></div> : tab === "profile" ? <ProfileManager role={session!.role} /> : tab === "hours" ? <HoursManager role={session!.role} /> : tab === "tables" ? <TableManager role={session!.role} /> : tab === "menu" ? <MenuManager role={session!.role} /> : tab === "overview" || tab === "outlets" ? <DashboardViews view={tab} /> : <UnconnectedView tab={tab} />}
      </main>
    </div>
  </div>;
}
