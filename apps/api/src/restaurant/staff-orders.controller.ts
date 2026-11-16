import { Controller, Get, Param, Query, Req, Res } from "@nestjs/common";
import { StaffController, StaffRequest, StaffResponse, cookieToken } from "../auth/staff.controller";
import { StaffService } from "../auth/staff.service";
import { StaffOrdersService } from "./staff-orders.service";

@Controller("staff/tenants/:slug/orders")
export class StaffOrdersController {
  constructor(private readonly orders: StaffOrdersService, private readonly staff: StaffService) {}
  private actor(slug: string, request: StaffRequest, response: StaffResponse) {
    new StaffController(this.staff).prepare(request, response, false);
    return this.staff.authenticate(cookieToken(request), slug, ["owner", "staff"]);
  }
  @Get()
  async list(@Param("slug") slug: string, @Query() query: Record<string, unknown>, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    const actor = await this.actor(slug, request, response);
    return this.orders.list(actor.tenantId, query);
  }
  @Get(":id")
  async detail(@Param("slug") slug: string, @Param("id") id: string, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    const actor = await this.actor(slug, request, response);
    return this.orders.detail(actor.tenantId, id);
  }
}
