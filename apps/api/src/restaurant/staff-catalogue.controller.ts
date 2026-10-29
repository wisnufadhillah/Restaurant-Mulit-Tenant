import { Body, Controller, Headers, Param, Patch, Put } from "@nestjs/common";
import { StaffAuthService, assertAllowedOrigin } from "../auth/staff-auth.service";
import { MenuService } from "../menu/menu.service";
import { TableService } from "./table.service";
import { HoursService } from "./hours.service";
import { ForbiddenException, BadRequestException } from "@nestjs/common";

@Controller("staff")
export class StaffCatalogueController {
  constructor(private readonly auth: StaffAuthService, private readonly menu: MenuService, private readonly tables: TableService, private readonly hours: HoursService) {}
  @Patch(":slug/menu/:id")
  async updateMenu(@Param("slug") slug: string, @Param("id") id: string, @Body() body: Record<string, unknown>, @Headers("cookie") cookie: string | undefined, @Headers("origin") origin: string | undefined) {
    assertAllowedOrigin(origin); const actor = await this.auth.current(slug, cookie);
    const availabilityOnly = Object.keys(body).length === 1 && "isAvailable" in body;
    if (!availabilityOnly && actor.role !== "owner") throw new ForbiddenException();
    return this.menu.update(actor.tenantId, id, body, availabilityOnly, actor.id);
  }
  @Patch(":slug/tables/:id")
  async updateTable(@Param("slug") slug: string, @Param("id") id: string, @Body() body: Record<string, unknown>, @Headers("cookie") cookie: string | undefined, @Headers("origin") origin: string | undefined) {
    assertAllowedOrigin(origin); const actor = await this.auth.current(slug, cookie);
    if (actor.role !== "owner") throw new ForbiddenException();
    return this.tables.save(actor.tenantId, body, id, actor.id);
  }
  @Put(":slug/hours/:dayOfWeek")
  async updateHours(@Param("slug") slug: string, @Param("dayOfWeek") day: string, @Body() body: Record<string, unknown>, @Headers("cookie") cookie: string | undefined, @Headers("origin") origin: string | undefined) {
    assertAllowedOrigin(origin); const actor = await this.auth.current(slug, cookie);
    if (actor.role !== "owner") throw new ForbiddenException();
    if (Object.keys(body).sort().join() !== "closeMinutes,isOpen,openMinutes" || typeof body.isOpen !== "boolean") throw new BadRequestException();
    return this.hours.save(actor.tenantId, { weekday: Number(day), openMinute: body.isOpen ? body.openMinutes : null, closeMinute: body.isOpen ? body.closeMinutes : null }, actor.id);
  }
}
