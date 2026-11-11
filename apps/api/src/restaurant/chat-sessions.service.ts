import { ForbiddenException, Injectable, OnModuleDestroy, ServiceUnavailableException } from "@nestjs/common";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createDatabaseClient } from "../database/client";
import { signInternalContext } from "./internal-context";

const SESSION_MS = 24 * 60 * 60 * 1000;
type Message = { role: "user" | "assistant"; content: string };
type Session = { id: string; slug: string; expiresAt: number; history: Message[] };

@Injectable()
export class ChatSessionsService implements OnModuleDestroy {
  private readonly db = createDatabaseClient();
  private digest(token: string) { return createHash("sha256").update(token).digest("hex"); }
  private async tenant(slug: string) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) throw new ForbiddenException();
    const row = await this.db.tenant.findFirst({ where: { slug, status: "active" }, select: { id: true } });
    if (!row) throw new ForbiddenException();
    return row.id;
  }
  async create(slug: string, now = Date.now()) {
    const tenantId = await this.tenant(slug);
    const token = randomBytes(32).toString("base64url");
    const session = { id: randomUUID(), slug, expiresAt: now + SESSION_MS, history: [] as Message[] };
    await this.db.chatSession.create({ data: { id: session.id, tenantId, tokenHash: this.digest(token), expiresAt: new Date(session.expiresAt), history: [] } });
    return { token, ...session };
  }
  async read(token: string, slug: string, now = Date.now()): Promise<Session> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ForbiddenException();
    const tenantId = await this.tenant(slug);
    const row = await this.db.chatSession.findFirst({ where: { tenantId, tokenHash: this.digest(token), revokedAt: null, expiresAt: { gt: new Date(now) } }, select: { id: true, expiresAt: true, history: true } });
    if (!row) throw new ForbiddenException();
    const history = Array.isArray(row.history) ? row.history.filter((item): item is Message => !!item && typeof item === "object" && ((item as Record<string, unknown>).role === "user" || (item as Record<string, unknown>).role === "assistant") && typeof (item as Record<string, unknown>).content === "string").slice(-8) : [];
    return { id: row.id, slug, expiresAt: row.expiresAt.getTime(), history };
  }
  async assertActive(id: string, slug: string, now = Date.now()) { await this.readById(id, slug, now); }
  private async readById(id: string, slug: string, now: number) {
    const tenantId = await this.tenant(slug);
    const row = await this.db.chatSession.findFirst({ where: { id, tenantId, revokedAt: null, expiresAt: { gt: new Date(now) } }, select: { id: true } });
    if (!row) throw new ForbiddenException();
    return row;
  }
  async revoke(token: string, slug: string) {
    const session = await this.read(token, slug);
    await this.db.chatSession.updateMany({ where: { id: session.id, tokenHash: this.digest(token), revokedAt: null }, data: { revokedAt: new Date() } });
  }
  async context(token: string, slug: string, now = Date.now()) {
    const session = await this.read(token, slug, now);
    const secret = process.env.INTERNAL_CONTEXT_SECRET;
    if (!secret || secret.length < 32) throw new ServiceUnavailableException();
    return { sessionId: session.id, context: signInternalContext({ tenantSlug: slug, sessionId: session.id, expiresAt: Math.min(session.expiresAt, now + 30000) }, secret) };
  }
  async history(token: string, slug: string) { return (await this.read(token, slug)).history; }
  async append(token: string, slug: string, messages: Message[]) {
    const session = await this.read(token, slug);
    const history = [...session.history, ...messages.filter(message => message.content.length <= 2000)].slice(-8);
    await this.db.chatSession.updateMany({ where: { id: session.id, tokenHash: this.digest(token), revokedAt: null }, data: { history } });
  }
  async onModuleDestroy() { await this.db.$disconnect(); }
}
