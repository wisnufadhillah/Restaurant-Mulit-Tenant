import Navbar from "./components/Navbar";
import MenuSection from "./components/MenuSection";
import ReservationSection from "./components/ReservationSection";
import ChatbotWidget from "./components/ChatbotWidget";
import OpeningHours from "./components/OpeningHours";

export default async function HomePage() {
  let name = "Rumah makan", address = "Alamat belum dapat dimuat.", contact = "", profileUnavailable = false;
  try {
    const response = await fetch("http://127.0.0.1:3001/api/v1/public/tenants/demo-padang/restaurant", { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("Profile unavailable");
    const { data } = await response.json();
    if (typeof data.name !== "string" || !Array.isArray(data.outlets) || data.outlets.length !== 1) throw new Error("Profile invalid");
    name = data.name; address = data.outlets[0].address; contact = data.outlets[0].contactPhone;
  } catch { profileUnavailable = true; }
  return <div className="senja-site">
    <a className="senja-skip" href="#main-content">Lewati ke konten</a>
    <div className="sela-header-wrap"><div className="senja-shell"><Navbar name={name} /></div></div>
    <main id="main-content">
      <section className="senja-shell senja-hero" id="beranda" aria-labelledby="hero-heading">
        <div className="senja-hero-copy">
          <p className="senja-eyebrow">MASAKAN PADANG, UNTUK SEMEJA.</p>
          <h1 id="hero-heading">Ada sela,<br />ada cerita,<br />ada makan.</h1>
          <p>Nasi hangat, lauk berbumbu Minang, dan sambal yang melengkapi. Singgah untuk sepiring nasi Padang bersama orang terdekat.</p>
          <div className="senja-hero-actions"><a href="#reservasi" className="senja-button">Reservasi meja <span aria-hidden="true">↗</span></a><a href="#menu" className="sela-button-outline">Lihat menu</a></div>
          <p className="senja-note sela-hero-note">Tanpa akun · Durasi makan 90 menit</p>
        </div>
        <img className="senja-hero-image" src="/images/padang-table.webp" alt="Nasi hangat, rendang, gulai ayam dan sambal di meja rumah makan Padang" width="1376" height="768" fetchPriority="high" />
      </section>
      <div className="sela-info-strip"><div className="senja-shell sela-info-grid"><div><p className="senja-eyebrow">TEMUI KAMI</p><p>{address}</p></div><div><p className="senja-eyebrow">JAM OPERASIONAL</p><a href="#lokasi" className="senja-text-link">Lihat jadwal mingguan</a></div><div><p className="senja-eyebrow">MAKAN BERSAMA</p><p>1–12 tamu · sesuai kapasitas meja</p></div><ChatbotWidget /></div></div>
      <div className="senja-shell">
        <section className="senja-section senja-about" id="tentang" aria-labelledby="about-heading">
          <img src="/images/padang-service.webp" width="1376" height="768" alt="Gulai ayam diantar ke meja bersama nasi dan lauk Padang" loading="lazy" />
          <div><p className="senja-eyebrow">TENTANG RESTORAN</p><h2 id="about-heading">Yang akrab di lidah,<br />yang dekat di meja.</h2><p>{name} menghadirkan masakan Padang untuk dinikmati bersama. Pilih rendang, gulai ayam, atau dendeng balado sebagai teman nasi hangat. Makan siang maupun makan malam, selalu ada waktu untuk duduk semeja.</p><a className="senja-text-link" href="#catatan-dapur">Kenali dapur kami <span aria-hidden="true">↗</span></a></div>
        </section>
        <MenuSection />
      </div>
      <section className="sela-kitchen" id="catatan-dapur" aria-labelledby="kitchen-heading"><img src="/images/padang-display.webp" width="1424" height="752" alt="Etalase rumah makan Padang dengan piring rendang, gulai dan sayuran" loading="lazy" /><div><p className="senja-eyebrow">CATATAN DARI DAPUR</p><h2 id="kitchen-heading">Sedikit pedas.<br />Banyak cerita.</h2><p>Cabai, santan, dan rempah menjadi bagian dari cita rasa Minang. Dari lauk bersantan sampai sambal, setiap pilihan melengkapi sepiring nasi Padang.</p></div></section>
      <div className="senja-shell">
        <ReservationSection />
        <section className="senja-section sela-location" id="lokasi" aria-labelledby="location-heading">
          <div><p className="senja-eyebrow">RENCANAKAN KUNJUNGAN</p><h2 id="location-heading">Ketemu di {name}.</h2><p>{address}</p>{contact && <p>Kontak restoran: {contact}</p>}{profileUnavailable && <p role="status">Profil restoran belum tersedia. Muat ulang halaman untuk mencoba lagi.</p>}</div>
          <OpeningHours />
        </section>
      </div>
      <section className="sela-faq"><div className="senja-shell sela-faq-grid"><div><p className="senja-eyebrow">SEBELUM MAMPIR</p><h2>Ada yang ingin<br />ditanyakan?</h2><p>Informasi dasar untuk merencanakan kunjungan.</p></div><div>{[["Perlu akun untuk reservasi?", "Tidak. Customer dapat membuat reservasi tanpa akun. Kontak diisi melalui form privat, lalu detail diperiksa sebelum konfirmasi. Layanan reservasi situs ini belum aktif."], ["Berapa lama waktu makan?", "Durasi reservasi 90 menit. Pemesanan paling lambat 60 menit sebelum kedatangan, hingga 30 hari ke depan. Satu reservasi memakai satu meja yang cukup untuk 1–12 tamu."], ["Bagaimana jika ingin membatalkan?", "Pembatalan mandiri paling lambat dua jam sebelum mulai dan memerlukan bukti akses privat. Kode referensi saja tidak memberi akses. Pengelolaan booking belum tersedia pada situs ini."]].map(([question, answer], index) => <details key={question} open={index === 0}><summary>{question}</summary><p>{answer}</p></details>)}</div></div></section>
    </main>
    <footer className="senja-footer"><div className="senja-shell"><div className="sela-footer-top"><div><p className="senja-footer-title">{name}</p><p>Masakan Padang. Waktu yang lapang.</p></div><div><p className="senja-eyebrow">ALAMAT RESTORAN</p><p>{address}</p></div></div><div className="sela-footer-bottom"><span>© 2026 {name} · Masakan Padang</span><span>Konsep demo · Menu, harga, alamat dan jadwal contoh</span><span>WIB · Asia/Jakarta</span></div></div></footer>
  </div>;
}
