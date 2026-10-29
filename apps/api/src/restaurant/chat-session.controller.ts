import { Controller, Delete, Get, HttpCode, Post, Req, Res } from "@nestjs/common";
import { ChatSessionsService } from "./chat-sessions.service";
import { RestaurantService } from "./restaurant.service";
import { StaffController, StaffRequest, StaffResponse } from "../auth/staff.controller";
import { StaffService } from "../auth/staff.service";
import { ForbiddenException } from "@nestjs/common";

const SLUG = "demo-padang";
const COOKIE = "restaurant_chat";
export function chatCookie(request: StaffRequest) {
  const header = request.headers.cookie;
  if (typeof header !== "string" || header.length > 8192) return "";
  const matches = header.split(";").map(part => part.trim()).filter(part => part.startsWith(`${COOKIE}=`));
  return matches.length === 1 ? matches[0].slice(COOKIE.length + 1) : "";
}
@Controller("chat/session")
export class ChatSessionController {
  constructor(private readonly sessions: ChatSessionsService, private readonly restaurant: RestaurantService) {}
  private prepare(request: StaffRequest, response: StaffResponse, mutation: boolean) {
    new StaffController({} as StaffService).prepare(request, response, mutation);
  }
  @Post()
  @HttpCode(200)
  async create(@Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    this.prepare(request, response, true);
    const profile = await this.restaurant.info(SLUG);
    if (profile.data.outlets.length !== 1) throw new ForbiddenException();
    const existing = chatCookie(request);
    if (existing) {
      const session = this.sessions.read(existing, SLUG);
      return { data: { id: session.id, expiresAt: session.expiresAt } };
    }
    const session = this.sessions.create(SLUG);
    response.setHeader("Set-Cookie", `${COOKIE}=${session.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
    return { data: { id: session.id, expiresAt: session.expiresAt } };
  }
  @Get()
  read(@Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    this.prepare(request, response, false);
    const session = this.sessions.read(chatCookie(request), SLUG);
    return { data: { id: session.id, expiresAt: session.expiresAt } };
  }
  @Delete()
  @HttpCode(204)
  revoke(@Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    this.prepare(request, response, true);
    const token = chatCookie(request);
    if (token) {
      try { this.sessions.revoke(token, SLUG); }
      catch (error) { if (!(error instanceof ForbiddenException)) throw error; }
    }
    response.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  }
}
