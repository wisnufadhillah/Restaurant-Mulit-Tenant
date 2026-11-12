import { API_ORIGIN } from "../../staff-session";
import { uploadedMenuImage } from "../../../../api/src/menu/menu-images";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
  if (!uploadedMenuImage(key)) return new Response(null, { status: 404, headers });
  try {
    const response = await fetch(`${API_ORIGIN}/api/v1/public/tenants/demo-padang/menu/images/${key}`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5000) });
    if (!response.ok) return new Response(null, { status: response.status === 404 ? 404 : 503, headers });
    return new Response(response.body, { headers: { ...headers, "Content-Type": "image/webp" } });
  } catch { return new Response(null, { status: 503, headers }); }
}
