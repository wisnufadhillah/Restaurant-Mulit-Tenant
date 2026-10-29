import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_ORIGIN, trustedOrigin } from "../../staff-session";

async function forward(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (request.method !== "GET" && !trustedOrigin(request)) return NextResponse.json({ message: "Permintaan ditolak." }, { status: 403, headers });
  const values = (await cookies()).getAll("restaurant_chat");
  const token = values.length === 1 && /^[A-Za-z0-9_-]{43}$/.test(values[0].value) ? values[0].value : "";
  if (values.length && !token && request.method !== "DELETE") return NextResponse.json({ message: "Sesi tidak valid. Pilih Mulai sesi baru untuk melanjutkan." }, { status: 403, headers });
  try {
    const response = await fetch(`${API_ORIGIN}/api/v1/chat/session`, { method: request.method, headers: { ...(token ? { cookie: `restaurant_chat=${token}` } : {}), ...(request.method !== "GET" ? { origin: request.headers.get("origin")! } : {}) }, cache: "no-store", signal: AbortSignal.timeout(5000), redirect: "error" });
    if (!response.ok) return NextResponse.json({ message: response.status === 403 ? "Sesi chat berakhir atau tidak valid." : "Chat belum tersedia. Gunakan halaman restoran dan coba lagi nanti." }, { status: response.status === 403 ? 403 : 503, headers });
    const result = response.status === 204 ? new NextResponse(null, { status: 204, headers }) : NextResponse.json(await response.json(), { headers });
    const raw = response.headers.get("set-cookie");
    if (raw) {
      const match = raw.match(/^restaurant_chat=([A-Za-z0-9_-]{43}|);/);
      if (!match) throw new Error("Invalid cookie response");
      result.cookies.set("restaurant_chat", match[1], { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/", maxAge: match[1] ? 86400 : 0 });
    }
    return result;
  } catch { return NextResponse.json({ message: "Chat belum tersedia. Gunakan halaman restoran dan coba lagi nanti." }, { status: 503, headers }); }
}
export const GET = forward;
export const POST = forward;
export const DELETE = forward;
