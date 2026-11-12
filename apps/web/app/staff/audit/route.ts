import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_ORIGIN, SESSION_COOKIE, TENANT_COOKIE } from "../../staff-session";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const fail = (status: number, message: string) => NextResponse.json({ message }, { status, headers });
  const store = await cookies(), tokens = store.getAll(SESSION_COOKIE), tenants = store.getAll(TENANT_COOKIE);
  const token = tokens.length === 1 ? tokens[0].value : "", slug = tenants.length === 1 ? tenants[0].value : "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || slug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return fail(401, "Sesi berakhir. Masuk kembali.");
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some(key => key !== "page" || params.getAll(key).length !== 1) || (params.has("page") && !/^[1-9]\d{0,2}$/.test(params.get("page")!))) return fail(400, "Halaman tidak valid.");
  try {
    const response = await fetch(`${API_ORIGIN}/api/v1/staff/tenants/${slug}/audit?${params}`, { headers: { cookie: `restaurant_staff=${token}` }, cache: "no-store", signal: AbortSignal.timeout(6000), redirect: "error" });
    if (!response.ok) return fail([400, 401, 403].includes(response.status) ? response.status : 503, response.status === 401 || response.status === 403 ? "Sesi atau akses berakhir. Masuk kembali." : "Riwayat belum dapat dimuat. Coba lagi.");
    return NextResponse.json(await response.json(), { headers });
  } catch { return fail(503, "Riwayat belum dapat dimuat. Coba lagi."); }
}
