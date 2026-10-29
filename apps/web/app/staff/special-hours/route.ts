import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_ORIGIN, SESSION_COOKIE, TENANT_COOKIE, trustedOrigin } from "../../staff-session";

async function forward(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (request.method !== "GET" && !trustedOrigin(request)) return NextResponse.json({ message: "Permintaan ditolak." }, { status: 403, headers });
  const store = await cookies();
  const tokens = store.getAll(SESSION_COOKIE), tenants = store.getAll(TENANT_COOKIE);
  const token = tokens.length === 1 ? tokens[0].value : "";
  const slug = tenants.length === 1 ? tenants[0].value : "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) return NextResponse.json({ message: "Sesi berakhir. Masuk kembali." }, { status: 401, headers });
  try {
    const date = new URL(request.url).searchParams.get("date");
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ message: "Tanggal tidak valid." }, { status: 400, headers });
    let body: string | undefined;
    if (!["GET", "DELETE"].includes(request.method)) {
      if (request.headers.get("content-type")?.split(";")[0] !== "application/json") return NextResponse.json({ message: "Gunakan data JSON." }, { status: 400, headers });
      body = await request.text();
      if (Buffer.byteLength(body) > 8192) return NextResponse.json({ message: "Data terlalu panjang." }, { status: 400, headers });
    }
    const response = await fetch(`${API_ORIGIN}/api/v1/staff/tenants/${slug}/special-hours${date ? `/${date}` : ""}`, { method: request.method, headers: { cookie: `restaurant_staff=${token}`, ...(request.method !== "GET" ? { "content-type": "application/json", origin: request.headers.get("origin")! } : {}) }, body, cache: "no-store", signal: AbortSignal.timeout(5000), redirect: "error" });
    if (!response.ok) return NextResponse.json({ message: response.status === 403 ? "Aksi ini memerlukan akses pemilik." : response.status === 401 ? "Sesi berakhir. Masuk kembali." : response.status === 400 ? "Periksa hari dan jam buka/tutup." : response.status === 404 ? "Jadwal tidak ditemukan. Muat ulang daftar." : response.status === 409 ? "Outlet belum siap. Periksa konfigurasi." : "Layanan jadwal belum tersedia. Coba lagi." }, { status: [400, 401, 403, 404, 409].includes(response.status) ? response.status : 503, headers });
    return NextResponse.json(await response.json(), { status: response.status, headers });
  } catch { return NextResponse.json({ message: "Layanan jadwal belum tersedia. Coba lagi." }, { status: 503, headers }); }
}
export const GET = forward;
export const PUT = forward;
export const DELETE = forward;
