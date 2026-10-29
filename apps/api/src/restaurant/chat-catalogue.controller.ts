import { Controller, Get, Param, Req, Res, NotFoundException } from "@nestjs/common";
import { ChatSessionsService } from "./chat-sessions.service";
import { chatCookie } from "./chat-session.controller";
import { StaffRequest, StaffResponse } from "../auth/staff.controller";
import { RestaurantService } from "./restaurant.service";
import { MenuService } from "../menu/menu.service";
import { HoursService } from "./hours.service";

@Controller("chat/catalogue")
export class ChatCatalogueController {
  constructor(private readonly sessions: ChatSessionsService, private readonly restaurant: RestaurantService, private readonly menu: MenuService, private readonly hours: HoursService) {}
  @Get(":resource")
  read(@Param("resource") resource: string, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    response.setHeader("Cache-Control", "no-store");
    const session = this.sessions.read(chatCookie(request), "demo-padang");
    if (resource === "restaurant") return this.restaurant.info(session.slug);
    if (resource === "menu") return this.menu.publicList(session.slug);
    if (resource === "hours") return this.hours.publicList(session.slug);
    throw new NotFoundException();
  }
}
