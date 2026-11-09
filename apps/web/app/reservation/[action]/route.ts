import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_ORIGIN, trustedOrigin } from "../../staff-session";

const SLUG = process.env.RESERVATION_TENANT_SLUG ?? "demo-padang";
if (SLUG.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(SLUG)) throw new Error("Invalid reservation tenant configuration");
const PATH = `/api/v1/public/tenants/${SLUG}/reservations`;
const CREATOR = `restaurant_reservation_${SLUG}`;
const MANAGEMENT = `${CREATOR}_management`;
const actions: Record<string, string> = { session: "/session", confirmations: "/confirmations", create: "", management: "/management-session", recovery: "/recovery", receipt: "/receipt", cancel: "/cancel", logout: "/management-session/logout" };

export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  const fail = (status: number, message: string) => NextResponse.json({ message }, { status, headers });
  if (!trustedOrigin(request) || request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return fail(403, "Permintaan ditolak.");
  const { action } = await context.params;
  if (!Object.hasOwn(actions, action)) return fail(404, "Layanan tidak ditemukan.");
  try {
    const text = await request.text();
    if (text.length > 4096) return fail(400, "Data terlalu panjang.");
    const body: unknown = JSON.parse(text);
    const store = await cookies();
    const forwarded: string[] = [];
    for (const name of [CREATOR, MANAGEMENT]) {
      const values = store.getAll(name);
      if (values.length > 1 || (values.length === 1 && !/^[A-Za-z0-9_-]{43}$/.test(values[0].value))) return fail(403, "Sesi tidak valid.");
      if (values.length) forwarded.push(`${name}=${values[0].value}`);
    }
    const key = request.headers.get("idempotency-key");
    if (key && !/^[A-Za-z0-9_-]{16,128}$/.test(key)) return fail(400, "Kunci percobaan tidak valid.");
    const response = await fetch(`${API_ORIGIN}${PATH}${actions[action]}`, { method: "POST", headers: { "content-type": "application/json", origin: request.headers.get("origin")!, ...(forwarded.length ? { cookie: forwarded.join("; ") } : {}), ...(key ? { "idempotency-key": key } : {}) }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(15000), redirect: "error" });
    const retry = response.headers.get("retry-after");
    if (retry && /^\d{1,5}$/.test(retry)) headers["Retry-After"] = retry;
    if (!response.ok) return fail([400, 403, 404, 409, 429].includes(response.status) ? response.status : 503, response.status === 404 && action === "management" ? "Percobaan belum menghasilkan reservasi." : response.status === 409 ? "Detail sudah berubah, meja tidak tersedia, atau batas pembatalan terlewati. Periksa status sebelum membuat percobaan baru." : response.status === 429 ? "Terlalu banyak permintaan. Tunggu sebelum mencoba lagi." : response.status === 403 ? "Sesi atau konfirmasi tidak valid. Jangan buat booking baru jika hasil sebelumnya belum pasti." : "Layanan belum tersedia. Coba lagi dengan percobaan yang sama.");
    if ((action === "logout") !== (response.status === 204)) throw new Error("Invalid response status");
    let payload;
    if (action !== "logout") {
      payload = await response.json();
      const data = payload?.data;
      if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid response envelope");
      if (action === "recovery" && (Object.keys(data).join() !== "outcome" || !["reservation_exists", "not_created"].includes(data.outcome))) throw new Error("Invalid recovery outcome");
      if (["session", "management", "confirmations"].includes(action) && (typeof data.expiresAt !== "string" || !Number.isFinite(Date.parse(data.expiresAt)))) throw new Error("Invalid session expiry");
      if (action === "confirmations" && (typeof data.nonce !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(data.nonce) || !data.summary || typeof data.summary.startAt !== "string" || !Number.isFinite(Date.parse(data.summary.startAt)) || !Number.isFinite(Date.parse(data.summary.endAt)))) throw new Error("Invalid confirmation");
      if (["receipt", "create", "cancel"].includes(action) && (typeof data.referenceCode !== "string" || !Number.isFinite(Date.parse(data.startAt)) || !Number.isFinite(Date.parse(data.endAt)) || data.timezone !== "Asia/Jakarta" || !Number.isInteger(data.partySize) || data.partySize < 1 || data.partySize > 12 || !["confirmed", "cancelled", "completed", "no_show"].includes(data.status))) throw new Error("Invalid receipt");
    }
    const result = response.status === 204 ? new NextResponse(null, { status: 204, headers }) : NextResponse.json(payload, { headers });
    const responseCookies = response.headers.getSetCookie();
    for (const raw of responseCookies) {
      const match = raw.match(/^([a-z0-9_-]+)=([A-Za-z0-9_-]{43}|);/i);
      if (!match || match[1] !== (action === "session" ? CREATOR : ["management", "logout"].includes(action) ? MANAGEMENT : "")) throw new Error("Invalid private cookie response");
      result.cookies.set(match[1], match[2], { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/reservation", maxAge: match[2] ? (match[1] === CREATOR ? 2764800 : 1800) : 0 });
    }
    return result;
  } catch { return fail(503, "Respons belum dapat dipastikan. Jangan membuat booking baru; coba ulang percobaan yang sama."); }
}
