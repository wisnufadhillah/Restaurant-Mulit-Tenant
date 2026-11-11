import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { API_ORIGIN } from "../../../staff-session";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ message: "Order tidak ditemukan." }, { status: 404 });
  const values = (await cookies()).getAll("restaurant_chat");
  if (values.length !== 1 || !/^[A-Za-z0-9_-]{43}$/.test(values[0].value)) return NextResponse.json({ message: "Sesi chat berakhir." }, { status: 403 });
  try {
    const response = await fetch(`${API_ORIGIN}/api/v1/chat/orders/${id}/status`, { method: "GET", headers: { cookie: `restaurant_chat=${values[0].value}` }, cache: "no-store", signal: AbortSignal.timeout(5000), redirect: "error" });
    return NextResponse.json(await response.json(), { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ message: "Status pembayaran belum tersedia." }, { status: 503 }); }
}
