import { BadRequestException, Controller, Get, Headers, HttpException, Param, Query, Res, ServiceUnavailableException } from "@nestjs/common";
import { authorizeInternalTool } from "./internal-tools.controller";
import { ChatSessionsService } from "./chat-sessions.service";
import { KnowledgeRepository } from "./knowledge.repository";
import { StaffResponse } from "../auth/staff.controller";
import { KnowledgeLimiter } from "./knowledge-limiter";
import { TooManyRequestsException } from "./knowledge-rate-limit";

@Controller("internal/tenants/:slug/knowledge")
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeRepository, private readonly sessions: ChatSessionsService) {}
  private readonly limiter = new KnowledgeLimiter();
  @Get()
  async search(@Param("slug") slug: string, @Query() query: Record<string, unknown>,
    @Headers("x-internal-service-token") service: string | undefined, @Headers("x-internal-context") context: string | undefined,
    @Headers("x-session-id") session: string | undefined, @Res({ passthrough: true }) response: StaffResponse) {
    response.setHeader("Cache-Control", "no-store");
    authorizeInternalTool(service, context, session, slug);
    await this.sessions.assertActive(session!, slug);
    if (Object.keys(query).join() !== "q" || typeof query.q !== "string" || !query.q.trim() || query.q.length > 500) throw new BadRequestException();
    let release: () => void;
    try { release = this.limiter.acquire(slug, session!); }
    catch (error) {
      if (error instanceof TooManyRequestsException) response.setHeader("Retry-After", String(error.retryAfterSeconds));
      throw error;
    }
    try { return await this.knowledge.search(slug, query.q); }
    catch (error) { if (error instanceof HttpException) throw error; throw new ServiceUnavailableException(); }
    finally { release(); }
  }
}
