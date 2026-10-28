import { createHmac, timingSafeEqual } from "node:crypto";

export type InternalContext = { tenantSlug: string; sessionId: string; expiresAt: number };

function encode(value: string) { return Buffer.from(value, "utf8").toString("base64url"); }
function decode(value: string) { return Buffer.from(value, "base64url").toString("utf8"); }
function signature(payload: string, secret: string) { return createHmac("sha256", secret).update(payload).digest("base64url"); }

export function signInternalContext(context: InternalContext, secret: string): string {
  if (!secret || !context.tenantSlug || !context.sessionId || !Number.isFinite(context.expiresAt)) throw new Error("Invalid internal context");
  const payload = encode(JSON.stringify(context));
  return `${payload}.${signature(payload, secret)}`;
}

export function verifyInternalContext(token: string, expectedTenant: string, expectedSession: string, secret: string, now = Date.now()): boolean {
  try {
    if (!token || !secret || !expectedTenant || !expectedSession) return false;
    const [payload, provided] = token.split(".");
    if (!payload || !provided) return false;
    const expected = Buffer.from(signature(payload, secret));
    const actual = Buffer.from(provided);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;
    const context = JSON.parse(decode(payload)) as InternalContext;
    return context.tenantSlug === expectedTenant && context.sessionId === expectedSession && Number.isSafeInteger(context.expiresAt) && context.expiresAt > now;
  } catch { return false; }
}
