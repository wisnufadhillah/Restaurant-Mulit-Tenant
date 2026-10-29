import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_ORIGIN, trustedOrigin } from "../../staff-session";
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!trustedOrigin(request)) return NextResponse.json({ message: "Permintaan ditolak." }, { status: 403, headers });
  const values = (await cookies()).getAll("restaurant_chat");
  if (values.length !== 1 || !/^[A-Za-z0-9_-]{43}$/.test(values[0].value)) return NextResponse.json({ message: "Sesi chat berakhir. Mulai sesi baru." }, { status: 403, headers });
  try {
    if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return NextResponse.json({ message: "Pesan tidak valid." }, { status: 400, headers });
    const text = await request.text();
    if (Buffer.byteLength(text) > 8192) return NextResponse.json({ message: "Pesan terlalu panjang." }, { status: 400, headers });
    const response = await fetch(`${API_ORIGIN}/api/v1/chat/messages`, { method: "POST", headers: { origin: request.headers.get("origin")!, cookie: `restaurant_chat=${values[0].value}`, "content-type": "application/json" }, body: text, cache: "no-store", signal: AbortSignal.timeout(31000), redirect: "error" });
    if (!response.ok) return NextResponse.json({ message: response.status === 429 ? "Terlalu banyak pesan. Tunggu sebentar lalu coba lagi." : response.status === 403 ? "Sesi chat berakhir. Mulai sesi baru." : "Pesan belum dapat diproses. Gunakan halaman restoran atau coba lagi." }, { status: [400, 403, 429].includes(response.status) ? response.status : 503, headers });
    return NextResponse.json(await response.json(), { headers });
  } catch { return NextResponse.json({ message: "Asisten belum tersedia. Gunakan halaman restoran atau coba lagi nanti." }, { status: 503, headers }); }
}
