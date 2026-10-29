interface PublicMenu { id: string; name: string; description: string; price: number; isAvailable: boolean; }
const images: Record<string, [string, string]> = {
  "Rendang sapi": ["padang-rendang", "Rendang sapi berbumbu gelap di atas daun pisang"],
  "Gulai ayam": ["padang-gulai", "Gulai ayam berkuah kuning disajikan dalam mangkuk"],
  "Dendeng balado": ["padang-dendeng", "Dendeng sapi dengan sambal balado merah"],
};

export default async function MenuSection() {
  let items: PublicMenu[] = [], unavailable = false;
  try {
    const response = await fetch("http://127.0.0.1:3001/api/v1/public/tenants/demo-padang/menu", { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error("Menu unavailable");
    items = (await response.json()).data;
  } catch { unavailable = true; }
  return <section className="senja-section sela-menu" id="menu" aria-labelledby="menu-heading">
    <p className="senja-eyebrow">DARI MEJA KAMI</p><h2 id="menu-heading">Sepiring nasi, pilihan lauk Padang.</h2>
    <p className="senja-note">Harga dan ketersediaan dari katalog restoran. Data sintetis untuk demo; gambar merupakan ilustrasi.</p>
    {unavailable ? <p role="status">Menu belum dapat dimuat. Muat ulang halaman untuk mencoba lagi.</p> : items.length === 0 ? <p>Belum ada menu yang dipublikasikan.</p> : <div className="senja-dishes">{items.map(dish => <article key={dish.id}>
      {images[dish.name] ? <img src={`/images/${images[dish.name][0]}.webp`} alt={images[dish.name][1]} width="1376" height="768" loading="lazy" /> : <div className="sela-menu-photo-placeholder"><span>{dish.name}</span><small>Foto hidangan belum tersedia</small></div>}
      <div className="sela-dish-heading"><h3>{dish.name}</h3><span>{new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(dish.price)}</span></div>
      <p>{dish.description}</p><span className="sela-sample-label">{dish.isAvailable ? "Tersedia" : "Habis"}</span>
    </article>)}</div>}
  </section>;
}
