import { NextResponse } from "next/server";
import { API_ORIGIN, SESSION_COOKIE, TENANT_COOKIE, cookieOptions, trustedOrigin } from "../../staff-session";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!trustedOrigin(request)) return NextResponse.json({ message: "Permintaan ditolak." }, { status: 403, headers });
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return NextResponse.json({ message: "Permintaan tidak valid." }, { status: 400, headers });
  try {
    const text = await request.text();
    if (Buffer.byteLength(text) > 8192) return NextResponse.json({ message: "Permintaan terlalu panjang." }, { status: 400, headers });
    let body;
    try { body = JSON.parse(text); } catch { return NextResponse.json({ message: "Permintaan tidak valid." }, { status: 400, headers }); }
    const upstream = await fetch(`${API_ORIGIN}/api/v1/staff/login`, { method: "POST", headers: { "content-type": "application/json", origin: request.headers.get("origin")! }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(10000), redirect: "error" });
    if (!upstream.ok) {
      const status = [400, 401, 403, 429].includes(upstream.status) ? upstream.status : 503;
      const message = status === 429 ? "Terlalu banyak percobaan. Coba lagi nanti." : status === 503 ? "Layanan login belum tersedia. Coba lagi nanti." : "Login gagal. Periksa restoran, nama pengguna, dan password.";
      return NextResponse.json({ code: status === 429 ? "LOGIN_RATE_LIMITED" : status === 503 ? "LOGIN_UPSTREAM_UNAVAILABLE" : "LOGIN_REJECTED", message }, { status, headers });
    }
    const cookie = upstream.headers.get("set-cookie");
    const match = cookie?.match(/^restaurant_staff=([A-Za-z0-9_-]{43});/);
    if (!match || typeof body.tenantSlug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.tenantSlug) || body.tenantSlug.length > 80) return NextResponse.json({ code: "LOGIN_INVALID_RESPONSE", message: "Respons login tidak valid. Muat ulang halaman atau hubungi pengelola." }, { status: 502, headers });
    const response = NextResponse.json({ ok: true }, { headers });
    response.cookies.set(SESSION_COOKIE, match[1], cookieOptions);
    response.cookies.set(TENANT_COOKIE, body.tenantSlug, cookieOptions);
    return response;
  } catch (error) {
    const timeout = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
    return NextResponse.json({ code: timeout ? "LOGIN_TIMEOUT" : "LOGIN_CONNECTION_FAILED", message: timeout ? "Login melewati batas waktu. Tunggu sebentar lalu coba lagi." : "Tidak dapat menghubungi API login. Pastikan backend berjalan, lalu coba lagi." }, { status: 503, headers });
  }
}
