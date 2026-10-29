import { BadRequestException, ForbiddenException, Injectable, NotFoundException, OnModuleDestroy, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { createDatabaseClient } from "../database/client";
import { verifyInternalContext } from "./internal-context";
import { assertAllowedOrigin } from "../auth/staff-auth.service";
import { StaffAuthService } from "../auth/staff-auth.service";

@Injectable()
export class RestaurantService implements OnModuleDestroy {
  private readonly database = createDatabaseClient();
  constructor(private readonly auth: StaffAuthService) {}

  async info(slug: string) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) throw new NotFoundException();
    let tenant;
    try {
      tenant = await this.database.tenant.findFirst({
        where: { slug, status: "active" },
        select: {
          slug: true, name: true,
          outlets: {
            where: { isActive: true }, orderBy: { id: "asc" },
            select: {
              name: true, address: true, contactPhone: true, timezone: true, durationMinutes: true, minNoticeMinutes: true, maxAdvanceDays: true, cancelCutoffMinutes: true, maxPartySize: true,
              menuItems: { where: { isAvailable: true }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, category: true, price: true, description: true, isAvailable: true } },
              diningTables: { where: { status: "available" }, orderBy: { tableNumber: "asc" }, select: { id: true, tableNumber: true, capacity: true, area: true, status: true } },
              openingHours: { orderBy: { dayOfWeek: "asc" }, select: { dayOfWeek: true, openMinutes: true, closeMinutes: true, isOpen: true } },
            },
          },
        },
      });
    } catch { throw new ServiceUnavailableException(); }
    if (!tenant) throw new NotFoundException();
    return { data: tenant, retrieved_at: new Date().toISOString(), source: "restaurant_api" };
  }

  async internalInfo(slug: string, serviceToken: string | string[] | undefined, contextToken: string | string[] | undefined, sessionId: string | string[] | undefined) {
    const token = typeof serviceToken === "string" ? serviceToken : "";
    const context = typeof contextToken === "string" ? contextToken : "";
    const session = typeof sessionId === "string" ? sessionId : "";
    const expectedToken = process.env.INTERNAL_TOOL_SERVICE_TOKEN ?? "";
    if (!expectedToken || token !== expectedToken) throw new UnauthorizedException();
    if (!verifyInternalContext(context, slug, session, process.env.INTERNAL_CONTEXT_SECRET ?? "")) throw new ForbiddenException();
    return this.info(slug);
  }

  async updateMenu(slug: string, id: string, body: Record<string, unknown>, cookie: string | undefined, origin?: string) {
    assertAllowedOrigin(origin);
    const user = await this.auth.current(slug, cookie);
    const data: Record<string, unknown> = {};
    if ("isAvailable" in body) { if (typeof body.isAvailable !== "boolean") throw new BadRequestException(); data.isAvailable = body.isAvailable; }
    if ("name" in body) { if (typeof body.name !== "string" || !body.name.trim()) throw new BadRequestException(); data.name = body.name.trim(); }
    if ("description" in body) { if (typeof body.description !== "string") throw new BadRequestException(); data.description = body.description; }
    if ("price" in body) { if (!Number.isInteger(body.price) || (body.price as number) < 0) throw new BadRequestException(); data.price = body.price; }
    if ("category" in body) { if (typeof body.category !== "string" || !body.category.trim()) throw new BadRequestException(); data.category = body.category.trim(); }
    if (!Object.keys(data).length) throw new BadRequestException();
    const result = await this.database.menuItem.updateMany({ where: { id, tenantId: user.tenantId }, data });
    if (!result.count) throw new NotFoundException();
    return { data: await this.database.menuItem.findFirst({ where: { id, tenantId: user.tenantId } }) };
  }

  async updateTable(slug: string, id: string, body: Record<string, unknown>, cookie: string | undefined, origin?: string) {
    assertAllowedOrigin(origin);
    const user = await this.auth.current(slug, cookie);
    const data: Record<string, unknown> = {};
    if ("status" in body && typeof body.status === "string" && ["available", "reserved", "maintenance"].includes(body.status)) data.status = body.status;
    if ("capacity" in body && Number.isInteger(body.capacity) && (body.capacity as number) > 0) data.capacity = body.capacity;
    if (!Object.keys(data).length) throw new BadRequestException();
    const result = await this.database.diningTable.updateMany({ where: { id, tenantId: user.tenantId }, data });
    if (!result.count) throw new NotFoundException();
    return { data: await this.database.diningTable.findFirst({ where: { id, tenantId: user.tenantId } }) };
  }

  async updateHours(slug: string, dayOfWeek: number, body: Record<string, unknown>, cookie: string | undefined, origin?: string) {
    assertAllowedOrigin(origin);
    const user = await this.auth.current(slug, cookie);
    if (user.role !== "owner") throw new ForbiddenException();
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 || typeof body.isOpen !== "boolean" || !Number.isInteger(body.openMinutes) || !Number.isInteger(body.closeMinutes)) throw new BadRequestException();
    const outlet = await this.database.outlet.findFirst({ where: { tenantId: user.tenantId, isActive: true } });
    if (!outlet) throw new NotFoundException();
    if ((body.openMinutes as number) < 0 || (body.closeMinutes as number) > 1440 || (body.closeMinutes as number) <= (body.openMinutes as number)) throw new BadRequestException();
    return { data: await this.database.openingHour.upsert({ where: { tenantId_outletId_dayOfWeek: { tenantId: user.tenantId, outletId: outlet.id, dayOfWeek } }, update: { isOpen: body.isOpen, openMinutes: body.openMinutes as number, closeMinutes: body.closeMinutes as number }, create: { tenantId: user.tenantId, outletId: outlet.id, dayOfWeek, isOpen: body.isOpen, openMinutes: body.openMinutes as number, closeMinutes: body.closeMinutes as number } }) };
  }

  async onModuleDestroy() { await this.database.$disconnect(); }
}
