import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_ORIGIN } from "../../../staff-session";

export async function GET(_request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  const headers = { "Cache-Control": "no-store" };
  if (!["menu", "restaurant", "hours"].includes(resource)) return NextResponse.json({ message: "Informasi tidak tersedia." }, { status: 404, headers });
  const values = (await cookies()).getAll("restaurant_chat");
  if (values.length !== 1 || !/^[A-Za-z0-9_-]{43}$/.test(values[0].value)) return NextResponse.json({ message: "Sesi chat belum tersedia. Tutup lalu buka kembali panel." }, { status: 403, headers });
  try {
    const response = await fetch(`${API_ORIGIN}/api/v1/chat/catalogue/${resource}`, { headers: { cookie: `restaurant_chat=${values[0].value}` }, cache: "no-store", signal: AbortSignal.timeout(5000), redirect: "error" });
    if (!response.ok) return NextResponse.json({ message: response.status === 403 ? "Sesi chat berakhir. Mulai sesi baru." : "Informasi restoran belum dapat dimuat. Coba lagi atau gunakan halaman web." }, { status: response.status === 403 ? 403 : 503, headers });
    return NextResponse.json(await response.json(), { headers });
  } catch { return NextResponse.json({ message: "Informasi restoran belum dapat dimuat. Coba lagi atau gunakan halaman web." }, { status: 503, headers }); }
}
