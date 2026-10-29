import "server-only";
import { cookies } from "next/headers";

export const API_ORIGIN = "http://127.0.0.1:3001";
export const SESSION_COOKIE = "senja_staff";
export const TENANT_COOKIE = "senja_staff_tenant";
export const cookieOptions = { httpOnly: true, sameSite: "strict" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 28800 };

function acceptedOrigins(expected: string) {
  const origins = new Set([expected]);
  if (process.env.NODE_ENV !== "production") {
    const url = new URL(expected);
    if (url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname)) {
      url.hostname = url.hostname === "localhost" ? "127.0.0.1" : "localhost";
      origins.add(url.origin);
    }
  }
  return origins;
}

export function trustedOrigin(request: Request): boolean {
  const expected = process.env.STAFF_ORIGIN ?? (process.env.NODE_ENV !== "production" ? "http://127.0.0.1:3000" : undefined);
  if (!expected || request.headers.get("sec-fetch-site") === "cross-site") return false;
  try {
    const url = new URL(expected);
    return url.origin === expected && acceptedOrigins(expected).has(request.headers.get("origin") ?? "") && (url.protocol === "https:" || (process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname)));
  } catch { return false; }
}

export async function staffSession() {
  const store = await cookies();
  const tokens = store.getAll(SESSION_COOKIE);
  const tenants = store.getAll(TENANT_COOKIE);
  if (tokens.length !== 1 || tenants.length !== 1) return null;
  const token = tokens[0].value;
  const slug = tenants[0].value;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) return null;
  const response = await fetch(`${API_ORIGIN}/api/v1/staff/tenants/${slug}/session`, { headers: { cookie: `restaurant_staff=${token}` }, cache: "no-store", signal: AbortSignal.timeout(5000), redirect: "error" });
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok) throw new Error("Staff session unavailable");
  const result = await response.json();
  if (!result.data || typeof result.data.username !== "string" || !["owner", "staff"].includes(result.data.role)) throw new Error("Invalid staff session response");
  return { slug, username: result.data.username as string, role: result.data.role as "owner" | "staff" };
}
