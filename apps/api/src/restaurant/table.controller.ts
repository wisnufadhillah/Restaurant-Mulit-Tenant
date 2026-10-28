import { Body, Controller, Get, Param, Patch, Post, Req, Res } from "@nestjs/common";
import { StaffController, StaffRequest, StaffResponse, cookieToken } from "../auth/staff.controller";
import { StaffService } from "../auth/staff.service";
import { TableService } from "./table.service";

@Controller("staff/tenants/:slug/tables")
export class TableController {
  constructor(private readonly tables: TableService, private readonly staff: StaffService) {}
  private async actor(slug: string, request: StaffRequest, response: StaffResponse, mutation: boolean) {
    new StaffController(this.staff).prepare(request, response, mutation);
    return this.staff.authenticate(cookieToken(request), slug, mutation ? ["owner"] : ["owner", "staff"]);
  }
  @Get()
  async list(@Param("slug") slug: string, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    const actor = await this.actor(slug, request, response, false); return this.tables.list(actor.tenantId);
  }
  @Post()
  async create(@Param("slug") slug: string, @Body() body: unknown, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    const actor = await this.actor(slug, request, response, true); return this.tables.save(actor.tenantId, body, undefined, actor.id);
  }
  @Patch(":id")
  async update(@Param("slug") slug: string, @Param("id") id: string, @Body() body: unknown, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    const actor = await this.actor(slug, request, response, true); return this.tables.save(actor.tenantId, body, id, actor.id);
  }
}
