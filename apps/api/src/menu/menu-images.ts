export const menuImages = [
  { key: "padang-rendang.webp", label: "Rendang sapi", alt: "Rendang sapi berbumbu gelap di atas daun pisang" },
  { key: "padang-gulai.webp", label: "Gulai ayam", alt: "Gulai ayam berkuah kuning disajikan dalam mangkuk" },
  { key: "padang-dendeng.webp", label: "Dendeng balado", alt: "Dendeng sapi dengan sambal balado merah" },
  { key: "ayam-pop.jpg", label: "Ayam pop", alt: "Ayam pop dengan irisan mentimun dan sambal merah" },
  { key: "es-jeruk.jpg", label: "Es jeruk", alt: "Es jeruk dalam gelas dengan potongan jeruk" },
  { key: "es-teh.jpg", label: "Es teh tawar", alt: "Segelas es teh dengan es batu" },
  { key: "gulai-kepala-ikan.jpg", label: "Gulai kepala ikan", alt: "Gulai kepala ikan dalam kuah kuning berbumbu" },
  { key: "nasi.jpg", label: "Nasi putih", alt: "Seporsi nasi putih di atas daun pisang" },
  { key: "telur-balado.jpg", label: "Telur balado", alt: "Telur rebus dengan sambal balado merah" },
] as const;

export function menuImage(key: unknown) {
  return menuImages.find(image => image.key === key);
}

export function uploadedMenuImage(key: unknown): key is string {
  return typeof key === "string" && /^upload-[a-f0-9]{48}\.webp$/.test(key);
}

export function menuImageSource(key: unknown, privateImage = false): string | undefined {
  const image = menuImage(key);
  if (image) return `/images/${image.key}`;
  if (uploadedMenuImage(key)) return privateImage ? `/staff/menu/images?key=${key}` : `/menu-images/${key}`;
}
