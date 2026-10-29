import { BadRequestException, Injectable, OnModuleDestroy, UnauthorizedException } from "@nestjs/common";
import { createSessionToken, hashSessionToken, verifyPassword } from "./crypto";
import { createDatabaseClient } from "../database/client";

const COOKIE = "restaurant_staff_session";
const MAX_AGE_SECONDS = 8 * 60 * 60;
type ResponseLike = { setHeader(name: string, value: string): void };
export function assertAllowedOrigin(origin: string | undefined) {
  if (origin !== "http://127.0.0.1:3000" && origin !== "http://localhost:3000") throw new UnauthorizedException();
}

function cookieValue(header: string | undefined): string {
  return header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) ?? "";
}

@Injectable()
export class StaffAuthService implements OnModuleDestroy {
  private readonly database = createDatabaseClient();

  async login(slug: string, email: unknown, password: unknown, response: ResponseLike, origin?: string) {
    assertAllowedOrigin(origin);
    if (typeof email !== "string" || typeof password !== "string" || !email || !password) throw new BadRequestException();
    const user = await this.database.staffUser.findFirst({ where: { email: email.toLowerCase(), isActive: true, tenant: { slug, status: "active" } } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) throw new UnauthorizedException();
    const token = createSessionToken();
    await this.database.staffSession.create({ data: { tenantId: user.tenantId, staffUserId: user.id, tokenHash: hashSessionToken(token), expiresAt: new Date(Date.now() + MAX_AGE_SECONDS * 1000) } });
    response.setHeader("Set-Cookie", `${COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/api/v1/staff; Max-Age=${MAX_AGE_SECONDS}`);
    return { data: { tenantSlug: slug, email: user.email, role: user.role } };
  }

  async current(slug: string, cookie: string | undefined) {
    const token = cookieValue(cookie);
    if (!token) throw new UnauthorizedException();
    const session = await this.database.staffSession.findFirst({ where: { tokenHash: hashSessionToken(token), revokedAt: null, expiresAt: { gt: new Date() }, staffUser: { tenant: { slug, status: "active" }, isActive: true } }, include: { staffUser: true } });
    if (!session) throw new UnauthorizedException();
    return session.staffUser;
  }

  async logout(cookie: string | undefined, response: ResponseLike, origin?: string) {
    assertAllowedOrigin(origin);
    const token = cookieValue(cookie);
    if (token) await this.database.staffSession.updateMany({ where: { tokenHash: hashSessionToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
    response.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; SameSite=Lax; Path=/api/v1/staff; Max-Age=0`);
    return { data: { loggedOut: true } };
  }

  async onModuleDestroy() { await this.database.$disconnect(); }
}
