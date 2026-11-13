import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_ORIGIN, SESSION_COOKIE, TENANT_COOKIE, trustedOrigin } from "../../../staff-session";
import { uploadedMenuImage } from "../../../../../api/src/menu/menu-images";

const MAX_BYTES = 4_000_000;
let receiving = false;
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

async function forward(request: Request) {
  if (request.method === "POST" && !trustedOrigin(request)) return NextResponse.json({ message: "Permintaan ditolak." }, { status: 403, headers });
  const store = await cookies();
  const tokens = store.getAll(SESSION_COOKIE), tenants = store.getAll(TENANT_COOKIE);
  const token = tokens.length === 1 ? tokens[0].value : "", slug = tenants.length === 1 ? tenants[0].value : "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) return NextResponse.json({ message: "Sesi berakhir. Masuk kembali." }, { status: 401, headers });
  let acquired = false;
  try {
    const authHeaders = { cookie: `restaurant_staff=${token}` };
    if (request.method === "GET") {
      const key = new URL(request.url).searchParams.get("key");
      if (!uploadedMenuImage(key)) return new Response(null, { status: 404, headers });
      const response = await fetch(`${API_ORIGIN}/api/v1/staff/tenants/${slug}/menu/images/${key}`, { headers: authHeaders, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) });
      if (!response.ok) return new Response(null, { status: [401, 403, 404].includes(response.status) ? response.status : 503, headers });
      return new Response(response.body, { headers: { ...headers, "Content-Type": "image/webp" } });
    }
    // Verify real session and owner role before consuming any upload bytes.
    const session = await fetch(`${API_ORIGIN}/api/v1/staff/tenants/${slug}/session`, { headers: authHeaders, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000) });
    if (!session.ok) return NextResponse.json({ message: "Sesi berakhir. Masuk kembali." }, { status: session.status === 401 ? 401 : 503, headers });
    if ((await session.json()).data.role !== "owner") return NextResponse.json({ message: "Foto memerlukan akses pemilik." }, { status: 403, headers });
    const type = request.headers.get("content-type") ?? "";
    if (!["image/jpeg", "image/png", "image/webp"].includes(type)) return NextResponse.json({ message: "Gunakan JPEG, PNG atau WebP." }, { status: 400, headers });
    const length = request.headers.get("content-length");
    if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BYTES)) return NextResponse.json({ message: "Foto maksimal 4 MB." }, { status: 413, headers });
    if (receiving) return NextResponse.json({ message: "Unggahan sedang sibuk. Coba lagi." }, { status: 429, headers });
    if (!request.body) return NextResponse.json({ message: "Pilih foto." }, { status: 400, headers });
    receiving = true; acquired = true;
    const reader = request.body.getReader(), chunks: Uint8Array[] = [];
    let size = 0;
    let complete = false, expired = false;
    const timeout = setTimeout(() => { expired = true; void reader.cancel(); }, 15000);
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) { complete = true; break; }
        size += value.byteLength;
        if (size > MAX_BYTES) { await reader.cancel(); return NextResponse.json({ message: "Foto maksimal 4 MB." }, { status: 413, headers }); }
        chunks.push(value);
      }
    } finally { clearTimeout(timeout); reader.releaseLock(); }
    if (expired || !complete || !size || (length && Number(length) !== size)) return NextResponse.json({ message: "Unggahan tidak lengkap." }, { status: 400, headers });
    const response = await fetch(`${API_ORIGIN}/api/v1/staff/tenants/${slug}/menu/images`, { method: "POST", headers: { ...authHeaders, "content-type": type, origin: request.headers.get("origin")! }, body: new Uint8Array(Buffer.concat(chunks)), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20000) });
    if (!response.ok) return NextResponse.json({ message: response.status === 413 ? "Foto terlalu besar." : response.status === 429 ? "Batas unggahan tercapai. Coba lagi nanti." : "Foto gagal diunggah. Gunakan JPEG, PNG atau WebP yang valid." }, { status: [400, 401, 403, 413, 429].includes(response.status) ? response.status : 503, headers });
    return NextResponse.json(await response.json(), { status: 201, headers });
  } catch { return NextResponse.json({ message: "Layanan foto belum tersedia. Coba lagi." }, { status: 503, headers }); }
  finally { if (acquired) receiving = false; }
}

export const POST = forward;
export const GET = forward;
