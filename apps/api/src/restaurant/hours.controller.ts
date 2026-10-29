import { Body, Controller, Get, Param, Put, Req, Res } from "@nestjs/common";
import { StaffController, StaffRequest, StaffResponse, cookieToken } from "../auth/staff.controller";
import { StaffService } from "../auth/staff.service";
import { HoursService } from "./hours.service";

@Controller("staff/tenants/:slug/hours")
export class HoursController {
  constructor(private readonly hours: HoursService, private readonly staff: StaffService) {}
  @Get()
  async list(@Param("slug") slug: string, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    new StaffController(this.staff).prepare(request, response, false);
    const actor = await this.staff.authenticate(cookieToken(request), slug); return this.hours.list(actor.tenantId);
  }
  @Put()
  async save(@Param("slug") slug: string, @Body() body: unknown, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    new StaffController(this.staff).prepare(request, response, true);
    const actor = await this.staff.authenticate(cookieToken(request), slug, ["owner"]); return this.hours.save(actor.tenantId, body, actor.id);
  }
}
