import { Body, Controller, Delete, Get, Param, Put, Req, Res } from "@nestjs/common";
import { StaffController, StaffRequest, StaffResponse, cookieToken } from "../auth/staff.controller";
import { StaffService } from "../auth/staff.service";
import { SpecialHoursService } from "./special-hours.service";

@Controller("staff/tenants/:slug/special-hours")
export class SpecialHoursController {
  constructor(private readonly hours: SpecialHoursService, private readonly staff: StaffService) {}
  @Get()
  async list(@Param("slug") slug: string, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    new StaffController(this.staff).prepare(request, response, false);
    const actor = await this.staff.authenticate(cookieToken(request), slug);
    return this.hours.list(actor.tenantId);
  }
  @Delete(":date")
  async remove(@Param("slug") slug: string, @Param("date") date: string, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    new StaffController(this.staff).prepare(request, response, true);
    const actor = await this.staff.authenticate(cookieToken(request), slug, ["owner"]);
    return this.hours.remove(actor.tenantId, actor.id, date);
  }
  @Put()
  async save(@Param("slug") slug: string, @Body() body: unknown, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    new StaffController(this.staff).prepare(request, response, true);
    const actor = await this.staff.authenticate(cookieToken(request), slug, ["owner"]);
    return this.hours.save(actor.tenantId, actor.id, body);
  }
  @Get(":date")
  async resolve(@Param("slug") slug: string, @Param("date") date: string, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    new StaffController(this.staff).prepare(request, response, false);
    const actor = await this.staff.authenticate(cookieToken(request), slug);
    return this.hours.resolve(actor.tenantId, date);
  }
}
