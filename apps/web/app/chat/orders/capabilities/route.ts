import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_ORIGIN, trustedOrigin } from "../../../staff-session";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site" || (origin !== null && !trustedOrigin(request))) return NextResponse.json({ message: "Permintaan ditolak." }, { status: 403, headers });
  const values = (await cookies()).getAll("restaurant_chat");
  if (values.length !== 1 || !/^[A-Za-z0-9_-]{43}$/.test(values[0].value)) return NextResponse.json({ message: "Sesi chat berakhir." }, { status: 403, headers });
  try {
    const response = await fetch(`${API_ORIGIN}/api/v1/chat/orders/capabilities`, { method: "GET", headers: { cookie: `restaurant_chat=${values[0].value}`, ...(origin !== null ? { origin } : {}) }, cache: "no-store", signal: AbortSignal.timeout(5000), redirect: "error" });
    return NextResponse.json(await response.json(), { status: response.status, headers });
  } catch { return NextResponse.json({ message: "Pembayaran belum tersedia." }, { status: 503, headers }); }
}
