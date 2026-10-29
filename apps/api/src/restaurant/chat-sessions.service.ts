import { ForbiddenException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { signInternalContext } from "./internal-context";

const SESSION_MS = 24 * 60 * 60 * 1000;
interface Session { id: string; slug: string; expiresAt: number; }
@Injectable()
export class ChatSessionsService {
  private readonly sessions = new Map<string, Session>();
  private digest(token: string) { return createHash("sha256").update(token).digest("hex"); }
  create(slug: string, now = Date.now()) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) throw new ForbiddenException();
    for (const [hash, session] of this.sessions) if (session.expiresAt <= now) this.sessions.delete(hash);
    if (this.sessions.size >= 1000) throw new ServiceUnavailableException();
    const token = randomBytes(32).toString("base64url");
    const session = { id: randomUUID(), slug, expiresAt: now + SESSION_MS };
    this.sessions.set(this.digest(token), session);
    return { token, ...session };
  }
  read(token: string, slug: string, now = Date.now()) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ForbiddenException();
    const session = this.sessions.get(this.digest(token));
    if (!session || session.slug !== slug || session.expiresAt <= now) throw new ForbiddenException();
    return session;
  }
  assertActive(id: string, slug: string, now = Date.now()) {
    if (![...this.sessions.values()].some(session => session.id === id && session.slug === slug && session.expiresAt > now)) throw new ForbiddenException();
  }
  revoke(token: string, slug: string) {
    this.read(token, slug);
    this.sessions.delete(this.digest(token));
  }
  context(token: string, slug: string, now = Date.now()) {
    const session = this.read(token, slug, now);
    const secret = process.env.INTERNAL_CONTEXT_SECRET;
    if (!secret || secret.length < 32) throw new ServiceUnavailableException();
    return { sessionId: session.id, context: signInternalContext({ tenantSlug: slug, sessionId: session.id, expiresAt: Math.min(session.expiresAt, now + 30000) }, secret) };
  }
}
