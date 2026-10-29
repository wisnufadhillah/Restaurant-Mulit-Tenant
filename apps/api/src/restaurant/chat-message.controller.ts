import { BadRequestException, Body, Controller, HttpCode, HttpException, Injectable, Post, Req, Res, ServiceUnavailableException } from "@nestjs/common";
import { ChatSessionsService } from "./chat-sessions.service";
import { chatCookie } from "./chat-session.controller";
import { StaffController, StaffRequest, StaffResponse } from "../auth/staff.controller";
import { StaffService } from "../auth/staff.service";
import { validatedChatCards } from "./chat-cards";

export function redactChat(message: string) {
  return message.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[kontak disamarkan]")
    .replace(/\+?\d[\d ()-]{6,}\d/g, "[nomor disamarkan]")
    .replace(/[A-Za-z0-9_-]{24,}/g, "[nilai privat disamarkan]");
}
@Injectable()
export class ConversationTransport {
  async send(body: unknown) {
    const token = process.env.ASSISTANT_GATEWAY_TOKEN;
    if (!token || token.length < 32) throw new ServiceUnavailableException();
    const response = await fetch("http://127.0.0.1:8001/turn", { method: "POST", headers: { "content-type": "application/json", "x-assistant-service-token": token }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000), redirect: "error" });
    if (!response.ok) throw new ServiceUnavailableException();
    const length = Number(response.headers.get("content-length"));
    if (!Number.isFinite(length) || length <= 0 || length > 131072) throw new ServiceUnavailableException();
    const text = await response.text();
    if (Buffer.byteLength(text) > 131072) throw new ServiceUnavailableException();
    const result = JSON.parse(text);
    if (!result || typeof result.message !== "string" || !result.message.trim() || result.message.length > 8000 || !Array.isArray(result.cards) || result.cards.length > 3 || typeof result.status !== "string") throw new ServiceUnavailableException();
    const allowed = new Set(["ok", "timeout", "transport_error", "invalid_request", "authentication", "credit_or_quota", "access_denied", "endpoint_or_model_missing", "rate_limited", "upstream_error", "http_error", "redirect_rejected", "tool_http_error", "tool_timeout", "tool_invalid_response", "tool_transport_error", "budget_exhausted"]);
    const diagnostics = Array.isArray(result.diagnostics) ? result.diagnostics.slice(0, 8).flatMap((entry: unknown) => {
      if (!entry || typeof entry !== "object") return [];
      const e = entry as Record<string, unknown>;
      if (typeof e.category !== "string" || !allowed.has(e.category)) return [];
      const safe: Record<string, string | number | null> = { category: e.category, http_status: Number.isInteger(e.http_status) && Number(e.http_status) >= 100 && Number(e.http_status) <= 599 ? e.http_status as number : null };
      for (const key of ["retry_after_seconds", "rate_limit", "rate_remaining", "rate_reset"]) if (Number.isSafeInteger(e[key]) && Number(e[key]) >= 0 && Number(e[key]) <= 999999999999) safe[key] = e[key] as number;
      if (["platform", "upstream", "unknown"].includes(String(e.limit_scope))) safe.limit_scope = e.limit_scope as string;
      return [safe];
    }) : [];
    return { status: result.status, message: result.message, cards: result.cards as unknown[], attempted_requests: Number.isInteger(result.attempted_requests) && result.attempted_requests >= 0 && result.attempted_requests <= 3 ? result.attempted_requests as number : 0, diagnostics };
  }
}
@Controller("chat/messages")
export class ChatMessageController {
  private readonly turns = new Map<string, { count: number; until: number; busy: boolean }>();
  constructor(private readonly sessions: ChatSessionsService, private readonly transport: ConversationTransport) {}
  @Post()
  @HttpCode(200)
  async send(@Body() input: unknown, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    new StaffController({} as StaffService).prepare(request, response, true);
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new BadRequestException();
    const body = input as Record<string, unknown>;
    if (Object.keys(body).join() !== "message" || typeof body.message !== "string" || !body.message.trim() || body.message.length > 2000) throw new BadRequestException();
    const token = chatCookie(request), session = this.sessions.read(token, "demo-padang");
    const now = Date.now();
    for (const [id, entry] of this.turns) if (!entry.busy && entry.until <= now) this.turns.delete(id);
    const entry = this.turns.get(session.id) ?? { count: 0, until: now + 60000, busy: false };
    if (entry.busy || entry.count >= 5 || this.turns.size >= 1000 && !this.turns.has(session.id)) throw new HttpException("Rate limited", 429);
    entry.count++; entry.busy = true; this.turns.set(session.id, entry);
    const safeMessage = redactChat(body.message.trim());
    try {
      const context = this.sessions.context(token, session.slug);
      const result = await this.transport.send({ message: safeMessage, tenantSlug: session.slug, sessionId: context.sessionId, context: context.context });
      this.sessions.assertActive(session.id, session.slug);
      return { status: result.status, message: redactChat(result.message), cards: result.status === "ok" ? validatedChatCards(result.cards) : [], input: safeMessage, attempted_requests: result.attempted_requests, diagnostics: result.diagnostics };
    } catch {
      return { status: "unavailable", message: "Asisten belum tersedia. Silakan gunakan halaman restoran atau coba lagi nanti.", cards: [], input: safeMessage };
    } finally { entry.busy = false; }
  }
}
