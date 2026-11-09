import { Body, Controller, ForbiddenException, HttpCode, Param, Post, Req, Res, ServiceUnavailableException } from "@nestjs/common";
import { StaffRequest, StaffResponse } from "../auth/staff.controller";
import { ReservationService } from "./reservation.service";

function cookieName(slug: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) throw new ForbiddenException();
  return `restaurant_reservation_${slug}`;
}
function cookieToken(request: StaffRequest, name: string): string | undefined {
  const cookie = request.headers.cookie;
  if (cookie === undefined) return undefined;
  if (typeof cookie !== "string" || cookie.length > 8192) throw new ForbiddenException();
  const values = cookie.split(";").map(part => part.trim()).filter(part => part.startsWith(`${name}=`));
  if (values.length > 1) throw new ForbiddenException();
  return values[0]?.slice(name.length + 1);
}

@Controller("public/tenants/:slug/reservations")
export class ReservationController {
  constructor(private readonly reservations: ReservationService) {}

  private prepare(slug: string, request: StaffRequest, response: StaffResponse) {
    response.setHeader("Cache-Control", "no-store");
    const allowed = process.env.STAFF_ORIGIN ?? (process.env.NODE_ENV !== "production" ? "http://127.0.0.1:3000" : undefined);
    if (!allowed) throw new ServiceUnavailableException();
    let origin: URL;
    try { origin = new URL(allowed); } catch { throw new ServiceUnavailableException(); }
    const local = process.env.NODE_ENV !== "production" && origin.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origin.hostname);
    if (origin.origin !== allowed || (origin.protocol !== "https:" && !local)) throw new ServiceUnavailableException();
    const origins = new Set([allowed]);
    if (local) {
      origin.hostname = origin.hostname === "localhost" ? "127.0.0.1" : "localhost";
      origins.add(origin.origin);
    }
    if (typeof request.headers.origin !== "string" || !origins.has(request.headers.origin) || request.headers["sec-fetch-site"] === "cross-site") throw new ForbiddenException();
    if (request.headers["content-type"]?.toString().split(";")[0].trim().toLowerCase() !== "application/json") throw new ForbiddenException();
    return cookieToken(request, cookieName(slug));
  }

  @Post("session")
  @HttpCode(200)
  async session(@Param("slug") slug: string, @Body() body: unknown, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    const token = this.prepare(slug, request, response);
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 0) throw new ForbiddenException();
    const result = await this.reservations.session(slug, token, request.socket.remoteAddress);
    if (result.token) response.setHeader("Set-Cookie", `${cookieName(slug)}=${result.token}; Path=/api/v1/public/tenants/${slug}/reservations; HttpOnly; SameSite=Strict; Max-Age=2764800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
    return { data: { expiresAt: result.expiresAt } };
  }

  @Post("confirmations")
  @HttpCode(200)
  async confirmation(@Param("slug") slug: string, @Body() body: unknown, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    const token = this.prepare(slug, request, response);
    return { data: await this.reservations.confirmation(slug, token, body) };
  }

  @Post("recovery")
  @HttpCode(200)
  async recovery(@Param("slug") slug: string, @Body() body: unknown, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    const creator = this.prepare(slug, request, response);
    this.empty(body);
    return { data: await this.reservations.recovery(slug, creator, request.headers["idempotency-key"]) };
  }

  @Post("management-session")
  @HttpCode(200)
  async managementSession(@Param("slug") slug: string, @Body() body: unknown, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    const creator = this.prepare(slug, request, response);
    this.empty(body);
    const name = `${cookieName(slug)}_management`;
    const result = await this.reservations.managementSession(slug, creator, request.headers["idempotency-key"], cookieToken(request, name));
    if (result.token) response.setHeader("Set-Cookie", `${name}=${result.token}; Path=/api/v1/public/tenants/${slug}/reservations; HttpOnly; SameSite=Strict; Max-Age=1800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
    return { data: { expiresAt: result.expiresAt } };
  }

  private empty(body: unknown) {
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length) throw new ForbiddenException();
  }

  @Post("receipt")
  @HttpCode(200)
  async receipt(@Param("slug") slug: string, @Body() body: unknown, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    this.prepare(slug, request, response);
    this.empty(body);
    return { data: await this.reservations.manage(slug, cookieToken(request, `${cookieName(slug)}_management`), false) };
  }

  @Post("cancel")
  @HttpCode(200)
  async cancel(@Param("slug") slug: string, @Body() body: unknown, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    this.prepare(slug, request, response);
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).join() !== "referenceCode" || typeof (body as { referenceCode?: unknown }).referenceCode !== "string" || (body as { referenceCode: string }).referenceCode.length > 80) throw new ForbiddenException();
    return { data: await this.reservations.manage(slug, cookieToken(request, `${cookieName(slug)}_management`), true, (body as { referenceCode: string }).referenceCode) };
  }

  @Post("management-session/logout")
  @HttpCode(204)
  async logout(@Param("slug") slug: string, @Body() body: unknown, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    this.prepare(slug, request, response);
    this.empty(body);
    const name = `${cookieName(slug)}_management`;
    await this.reservations.revokeManagement(slug, cookieToken(request, name));
    response.setHeader("Set-Cookie", `${name}=; Path=/api/v1/public/tenants/${slug}/reservations; HttpOnly; SameSite=Strict; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  }

  @Post()
  @HttpCode(200)
  async create(@Param("slug") slug: string, @Body() body: unknown, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    const token = this.prepare(slug, request, response);
    return { data: await this.reservations.create(slug, token, body, request.headers["idempotency-key"]) };
  }
}
