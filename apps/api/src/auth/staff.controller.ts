import { Body, Controller, Get, HttpCode, Param, Post, Req, Res, ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import { StaffService } from "./staff.service";

export interface StaffRequest {
  headers: Record<string, string | string[] | undefined>;
  socket: { remoteAddress?: string };
}
export interface StaffResponse { setHeader(name: string, value: string): unknown; }
const COOKIE = "restaurant_staff";

export function cookieToken(request: StaffRequest): string | undefined {
  const cookie = request.headers.cookie;
  if (typeof cookie !== "string" || cookie.length > 8192) return undefined;
  const values = cookie.split(";").map(part => part.trim()).filter(part => part.startsWith(`${COOKIE}=`));
  if (values.length !== 1) return undefined;
  return values[0].slice(COOKIE.length + 1);
}

@Controller("staff")
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  prepare(request: StaffRequest, response: StaffResponse, mutation: boolean) {
    response.setHeader("Cache-Control", "no-store");
    if (!mutation) return;
    const allowed = process.env.STAFF_ORIGIN ?? (process.env.NODE_ENV !== "production" ? "http://127.0.0.1:3000" : undefined);
    if (!allowed) throw new ServiceUnavailableException();
    let origin: URL;
    try { origin = new URL(allowed); } catch { throw new ServiceUnavailableException(); }
    if (origin.origin !== allowed || (origin.protocol !== "https:" &&
      !(process.env.NODE_ENV !== "production" && origin.protocol === "http:" && ["127.0.0.1", "localhost"].includes(origin.hostname)))) throw new ServiceUnavailableException();
    if (request.headers.origin !== allowed) throw new ForbiddenException();
    if (request.headers["sec-fetch-site"] === "cross-site") throw new ForbiddenException();
  }

  @Post("login")
  @HttpCode(200)
  async login(@Body() body: unknown, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    this.prepare(request, response, true);
    if (request.headers["content-type"]?.toString().split(";")[0].trim().toLowerCase() !== "application/json") throw new ForbiddenException();
    const result = await this.staff.login(body, request.socket.remoteAddress ?? "unknown");
    response.setHeader("Set-Cookie", `${COOKIE}=${result.token}; Path=/api/v1/staff; HttpOnly; SameSite=Strict; Max-Age=28800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
    return { data: result.data };
  }

  @Get("tenants/:slug/session")
  async session(@Param("slug") slug: string, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    this.prepare(request, response, false);
    return { data: await this.staff.authenticate(cookieToken(request), slug) };
  }

  @Post("tenants/:slug/logout")
  @HttpCode(204)
  async logout(@Param("slug") slug: string, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    this.prepare(request, response, true);
    await this.staff.logout(cookieToken(request), slug);
    response.setHeader("Set-Cookie", `${COOKIE}=; Path=/api/v1/staff; HttpOnly; SameSite=Strict; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  }
}
