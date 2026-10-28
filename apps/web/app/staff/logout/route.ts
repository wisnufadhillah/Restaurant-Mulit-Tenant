import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_ORIGIN, SESSION_COOKIE, TENANT_COOKIE, cookieOptions, trustedOrigin } from "../../staff-session";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!trustedOrigin(request)) return NextResponse.json({ message: "Permintaan ditolak." }, { status: 403, headers });
  const store = await cookies();
  const tokens = store.getAll(SESSION_COOKIE);
  const tenants = store.getAll(TENANT_COOKIE);
  const token = tokens.length === 1 ? tokens[0].value : "";
  const slug = tenants.length === 1 ? tenants[0].value : "";
  if (/^[A-Za-z0-9_-]{43}$/.test(token) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 80) {
    try {
      const upstream = await fetch(`${API_ORIGIN}/api/v1/staff/tenants/${slug}/logout`, { method: "POST", headers: { cookie: `restaurant_staff=${token}`, origin: request.headers.get("origin")! }, cache: "no-store", signal: AbortSignal.timeout(5000), redirect: "error" });
      if (![204, 401].includes(upstream.status)) throw new Error("Revocation unavailable");
    } catch { return NextResponse.json({ message: "Logout belum berhasil. Coba lagi; sesi belum dicabut." }, { status: 503, headers }); }
  }
  const response = NextResponse.json({ ok: true }, { headers });
  response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  response.cookies.set(TENANT_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  return response;
}
