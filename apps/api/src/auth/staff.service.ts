import { BadRequestException, ForbiddenException, HttpException, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { createHmac, randomBytes } from "node:crypto";
import { createSessionToken, hashPassword, hashSessionToken, verifyPassword } from "./crypto";
import { StaffRepository, StaffSessionRecord } from "./staff.repository";

const SESSION_MS = 8 * 60 * 60 * 1000;
const WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class StaffService {
  private readonly attempts = new Map<string, { count: number; until: number }>();
  private readonly limiterKey = randomBytes(32);
  private dummyHash?: Promise<string>;
  private deriving = false;

  constructor(private readonly repository: StaffRepository) {}

  private limit(key: string, max: number) {
    const now = Date.now();
    for (const [id, value] of this.attempts) if (value.until <= now) this.attempts.delete(id);
    const entry = this.attempts.get(key);
    if (entry && entry.count >= max) throw new HttpException("Rate limited", 429);
    if (!entry && this.attempts.size >= 10000) throw new HttpException("Rate limited", 429);
    this.attempts.set(key, { count: (entry?.count ?? 0) + 1, until: entry?.until ?? now + WINDOW_MS });
  }

  async login(input: unknown, address: string) {
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new BadRequestException();
    const body = input as Record<string, unknown>;
    if (Object.keys(body).sort().join(",") !== "password,tenantSlug,username" ||
      typeof body.tenantSlug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.tenantSlug) || body.tenantSlug.length > 80 ||
      typeof body.username !== "string" || !/^[a-z0-9][a-z0-9._-]{2,63}$/.test(body.username) ||
      typeof body.password !== "string" || Buffer.byteLength(body.password) < 12 || Buffer.byteLength(body.password) > 1024) throw new BadRequestException();
    this.limit(`ip:${address}`, 20);
    const accountKey = createHmac("sha256", this.limiterKey).update(`${body.tenantSlug}:${body.username}`).digest("hex");
    this.limit(`account:${accountKey}`, 5);
    if (this.deriving) throw new HttpException("Rate limited", 429);
    this.deriving = true;
    try {
      const account = await this.repository.account(body.tenantSlug, body.username);
      this.dummyHash ??= hashPassword(randomBytes(32).toString("base64url"));
      const dummy = await this.dummyHash;
      const stored = account?.passwordHash ?? dummy;
      const valid = await verifyPassword(body.password, stored);
      if (account && !/^scrypt\$131072\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(stored)) await verifyPassword(body.password, dummy);
      if (!account || !valid || !account.isActive || account.tenant.status !== "active" || !["owner", "staff"].includes(account.role)) throw new UnauthorizedException();
      const token = createSessionToken();
      await this.repository.createSession({ tenantId: account.tenantId, staffId: account.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + SESSION_MS) });
      return { token, data: { id: account.id, tenantId: account.tenantId, username: account.username, role: account.role } };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new ServiceUnavailableException();
    } finally { this.deriving = false; }
  }

  async authenticate(token: string | undefined, slug: string, roles: readonly string[] = ["owner", "staff"]) {
    let hash: string;
    try { hash = hashSessionToken(token!); } catch { throw new UnauthorizedException(); }
    let session: StaffSessionRecord | null;
    try { session = await this.repository.session(hash); } catch { throw new ServiceUnavailableException(); }
    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now() ||
      !session.staff.isActive || session.staff.tenant.status !== "active" ||
      session.tenantId !== session.staff.tenantId || session.staffId !== session.staff.id ||
      session.staff.tenant.slug !== slug) throw new UnauthorizedException();
    if (!roles.includes(session.staff.role)) throw new ForbiddenException();
    return { id: session.staff.id, tenantId: session.tenantId, username: session.staff.username, role: session.staff.role };
  }

  async logout(token: string | undefined, slug: string) {
    await this.authenticate(token, slug);
    try { await this.repository.revoke(hashSessionToken(token!)); } catch { throw new ServiceUnavailableException(); }
  }
}
