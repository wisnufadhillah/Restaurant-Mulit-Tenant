import { Body, Controller, ForbiddenException, Get, HttpCode, Param, Post, Query, Req, Res } from "@nestjs/common";
import { hashSessionToken } from "../auth/crypto";
import { StaffController, StaffRequest, StaffResponse, cookieToken } from "../auth/staff.controller";
import { StaffService } from "../auth/staff.service";
import { StaffReservationsService } from "./staff-reservations.service";

@Controller("staff/tenants/:slug")
export class StaffReservationsController {
  constructor(private readonly reservations: StaffReservationsService, private readonly staff: StaffService) {}
  private actor(slug: string, request: StaffRequest, response: StaffResponse, mutation = false) {
    new StaffController(this.staff).prepare(request, response, mutation);
    return this.staff.authenticate(cookieToken(request), slug, ["owner", "staff"]);
  }
  @Get("reservations")
  async list(@Param("slug") slug: string, @Query() query: Record<string, unknown>, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    const actor = await this.actor(slug, request, response);
    return this.reservations.list(actor.tenantId, query);
  }
  @Get("reservations/:id")
  async detail(@Param("slug") slug: string, @Param("id") id: string, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    const actor = await this.actor(slug, request, response);
    return this.reservations.detail(actor.tenantId, id);
  }
  @Post("reservations/:id/transitions")
  @HttpCode(200)
  async transition(@Param("slug") slug: string, @Param("id") id: string, @Body() body: unknown, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    const actor = await this.actor(slug, request, response, true);
    if (request.headers["content-type"]?.toString().split(";")[0].trim().toLowerCase() !== "application/json") throw new ForbiddenException();
    return this.reservations.transition(actor.tenantId, actor.id, hashSessionToken(cookieToken(request)!), id, request.headers["idempotency-key"], body);
  }
  @Get("audit")
  async audit(@Param("slug") slug: string, @Query() query: Record<string, unknown>, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    const actor = await this.actor(slug, request, response);
    return this.reservations.audit(actor.tenantId, query);
  }
}
