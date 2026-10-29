import { Controller, ForbiddenException, Get, Headers, Param, UnauthorizedException } from "@nestjs/common";
import { timingSafeEqual } from "node:crypto";
import { verifyInternalContext } from "./internal-context";
import { RestaurantService } from "./restaurant.service";
import { MenuService } from "../menu/menu.service";
import { ChatSessionsService } from "./chat-sessions.service";

export function authorizeInternalTool(service: string | undefined, context: string | undefined, session: string | undefined, slug: string) {
  const expected = process.env.INTERNAL_TOOL_SERVICE_TOKEN;
  const secret = process.env.INTERNAL_CONTEXT_SECRET;
  if (!expected || !secret || expected.length < 32 || secret.length < 32 || !service || service.length > 1024) throw new UnauthorizedException();
  const left = Buffer.from(service), right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new UnauthorizedException();
  if (!context || context.length > 4096 || !session || session.length > 128 || !verifyInternalContext(context, slug, session, secret)) throw new ForbiddenException();
}

@Controller("internal/tenants/:slug")
export class InternalToolsController {
  constructor(private readonly restaurant: RestaurantService, private readonly menu: MenuService, private readonly sessions: ChatSessionsService) {}
  @Get("restaurant")
  info(@Param("slug") slug: string, @Headers("x-internal-service-token") service: string | undefined, @Headers("x-internal-context") context: string | undefined, @Headers("x-session-id") session: string | undefined) {
    authorizeInternalTool(service, context, session, slug);
    this.sessions.assertActive(session!, slug);
    return this.restaurant.info(slug);
  }
  @Get("menu")
  menuInfo(@Param("slug") slug: string, @Headers("x-internal-service-token") service: string | undefined, @Headers("x-internal-context") context: string | undefined, @Headers("x-session-id") session: string | undefined) {
    authorizeInternalTool(service, context, session, slug);
    this.sessions.assertActive(session!, slug);
    return this.menu.publicList(slug);
  }
}
