import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_ORIGIN, SESSION_COOKIE, TENANT_COOKIE } from "../../staff-session";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  const fail = (status: number, message: string) => NextResponse.json({ message }, { status, headers });
  const store = await cookies();
  const tokens = store.getAll(SESSION_COOKIE), tenants = store.getAll(TENANT_COOKIE);
  const token = tokens.length === 1 ? tokens[0].value : "", slug = tenants.length === 1 ? tenants[0].value : "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || slug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return fail(401, "Sesi berakhir. Masuk kembali.");
  const params = new URL(request.url).searchParams;
  if ([...params.keys()].some(key => !["date", "status", "page", "id"].includes(key) || params.getAll(key).length !== 1)) return fail(400, "Filter tidak valid.");
  const id = params.get("id");
  if (params.has("id") && (!id || params.size !== 1 || !/^[a-f0-9-]{36}$/i.test(id))) return fail(400, "Reservasi tidak valid.");
  try {
    const response = await fetch(`${API_ORIGIN}/api/v1/staff/tenants/${slug}/reservations${id ? `/${id}` : `?${params}`}`, { headers: { cookie: `restaurant_staff=${token}` }, cache: "no-store", signal: AbortSignal.timeout(6000), redirect: "error" });
    if (!response.ok) return fail([400, 401, 403, 404].includes(response.status) ? response.status : 503, response.status === 404 ? "Reservasi tidak ditemukan." : response.status === 401 ? "Sesi berakhir. Masuk kembali." : response.status === 400 ? "Periksa filter tanggal, status dan halaman." : "Data reservasi belum dapat dimuat.");
    return NextResponse.json(await response.json(), { headers });
  } catch { return fail(503, "Data reservasi belum dapat dimuat. Coba lagi."); }
}
