import Link from "next/link";
import LoginForm from "./LoginForm";

export default function LoginPage() {
  return <div className="senja-site">
    <div className="sela-header-wrap"><header className="senja-shell senja-header"><Link className="senja-wordmark" href="/">Dapur Sela<small>MASAKAN PADANG · CIKINI</small></Link><Link className="senja-text-link" href="/">Kembali ke website</Link></header></div>
    <main className="senja-shell sela-login-layout">
      <section className="sela-login-story" aria-labelledby="login-story-heading"><img src="/images/padang-table.webp" width="1376" height="768" alt="Hidangan nasi Padang tersaji di meja Dapur Sela" /><div><p className="senja-eyebrow">DARI DAPUR, UNTUK SEMEJA.</p><h2 id="login-story-heading">Di balik hidangan,<br />ada kerja bersama.</h2><p>Ruang kerja untuk tim rumah makan Padang Dapur Sela.</p></div></section>
      <section className="sela-login-form" aria-labelledby="login-heading"><p className="senja-eyebrow">AREA STAFF</p><h1 id="login-heading">Selamat datang kembali.</h1><p>Masuk dengan akun restoran untuk melanjutkan pekerjaan.</p><LoginForm /></section>
    </main>
  </div>;
}
