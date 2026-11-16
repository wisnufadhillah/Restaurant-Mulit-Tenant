import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_ORIGIN, SESSION_COOKIE, TENANT_COOKIE, cookieOptions, trustedOrigin } from "../../staff-session";

async function session(request: Request, activity: boolean) {
  const headers = { "Cache-Control": "no-store" };
  const fail = (status: number, message: string) => {
    const response = NextResponse.json({ message }, { status, headers });
    if (status === 401) {
      response.cookies.set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 });
      response.cookies.set(TENANT_COOKIE, "", { ...cookieOptions, maxAge: 0 });
    }
    return response;
  };
  if (new URL(request.url).search) return fail(400, "Permintaan tidak valid.");
  if (activity) {
    if (!trustedOrigin(request)) return fail(403, "Permintaan ditolak.");
    if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") return fail(400, "Gunakan data JSON.");
    if (Number(request.headers.get("content-length")) > 32) return fail(400, "Data tidak valid.");
    try { const text = await request.text(); if (Buffer.byteLength(text) > 32) return fail(400, "Data tidak valid."); const body = JSON.parse(text); if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length) return fail(400, "Data tidak valid."); } catch { return fail(400, "Data tidak valid."); }
  }
  const store = await cookies(), tokens = store.getAll(SESSION_COOKIE), tenants = store.getAll(TENANT_COOKIE);
  const token = tokens.length === 1 ? tokens[0].value : "", slug = tenants.length === 1 ? tenants[0].value : "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || slug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return fail(401, "Sesi berakhir. Masuk kembali.");
  try {
    const response = await fetch(`${API_ORIGIN}/api/v1/staff/tenants/${slug}/${activity ? "activity" : "session"}`, { method: activity ? "POST" : "GET", headers: { cookie: `restaurant_staff=${token}`, ...(activity ? { origin: request.headers.get("origin")!, "content-type": "application/json" } : {}) }, ...(activity ? { body: "{}" } : {}), cache: "no-store", signal: AbortSignal.timeout(5000), redirect: "error" });
    if (!response.ok) return fail([401, 403, 429].includes(response.status) ? response.status : 503, response.status === 401 ? "Sesi berakhir. Masuk kembali." : "Sesi belum dapat diperiksa. Coba lagi.");
    const body = await response.json();
    if (!Number.isFinite(body.data?.validUntil)) return fail(503, "Sesi belum dapat diperiksa. Coba lagi.");
    return NextResponse.json({ active: true, validUntil: body.data.validUntil }, { headers });
  } catch { return fail(503, "Sesi belum dapat diperiksa. Coba lagi."); }
}
export function GET(request: Request) { return session(request, false); }
export function POST(request: Request) { return session(request, true); }
