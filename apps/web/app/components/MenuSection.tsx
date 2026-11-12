import { menuImage, menuImageSource } from "../../../api/src/menu/menu-images";
import { API_ORIGIN } from "../staff-session";

interface PublicMenu { id: string; name: string; description: string; price: number; isAvailable: boolean; imageKey?: string | null; }

export default async function MenuSection() {
  let items: PublicMenu[] = [], unavailable = false;
  try {
    const response = await fetch(`${API_ORIGIN}/api/v1/public/tenants/demo-padang/menu/catalogue`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("Menu unavailable");
    items = (await response.json()).data;
  } catch { unavailable = true; }
  return <section className="senja-section sela-menu" id="menu" aria-labelledby="menu-heading">
    <p className="senja-eyebrow">DARI MEJA KAMI</p><h2 id="menu-heading">Sepiring nasi, pilihan lauk Padang.</h2>
    <p className="senja-note">Pilih lauk favorit untuk menemani nasi hangat. Harga per porsi dalam rupiah; foto merupakan ilustrasi penyajian.</p>
    {unavailable ? <p role="status">Menu belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.</p> : items.length === 0 ? <p>Menu sedang disiapkan. Silakan periksa kembali nanti.</p> : <div className="senja-dishes">{items.map(dish => { const image = menuImage(dish.imageKey), source = menuImageSource(dish.imageKey); return <article key={dish.id}>
      {source ? <img src={source} alt={image?.alt ?? `Foto ${dish.name}`} width="1376" height="768" loading="lazy" /> : <div className="sela-menu-photo-placeholder"><span>{dish.name}</span><small>Foto hidangan belum tersedia</small></div>}
      <div className="sela-dish-heading"><h3>{dish.name}</h3><span>{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(dish.price)}</span></div>
      <p>{dish.description}</p><span className="sela-sample-label">{dish.isAvailable ? "Tersedia" : "Habis"}</span>
    </article>; })}</div>}
  </section>;
}
