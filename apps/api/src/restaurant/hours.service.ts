import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleDestroy, ServiceUnavailableException } from "@nestjs/common";
import { createDatabaseClient } from "../database/client";

export function hoursInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new BadRequestException();
  const body = input as Record<string, unknown>;
  if (Object.keys(body).sort().join() !== "closeMinute,openMinute,weekday" || typeof body.weekday !== "number" || !Number.isInteger(body.weekday) || body.weekday < 0 || body.weekday > 6) throw new BadRequestException();
  if (body.openMinute === null && body.closeMinute === null) return { weekday: body.weekday, openMinute: null, closeMinute: null };
  if (typeof body.openMinute !== "number" || typeof body.closeMinute !== "number" || !Number.isInteger(body.openMinute) || !Number.isInteger(body.closeMinute) || body.openMinute < 0 || body.openMinute >= body.closeMinute || body.closeMinute > 1440) throw new BadRequestException();
  return { weekday: body.weekday, openMinute: body.openMinute, closeMinute: body.closeMinute };
}
@Injectable()
export class HoursService implements OnModuleDestroy {
  private readonly db = createDatabaseClient();
  private async outlet(tenantId: string) {
    const rows = await this.db.outlet.findMany({ where: { tenantId, isActive: true }, select: { id: true, timezone: true }, take: 2 });
    if (rows.length !== 1) throw new ConflictException();
    return rows[0];
  }
  async list(tenantId: string) {
    try { const outlet = await this.outlet(tenantId); return { data: await this.db.weeklyHours.findMany({ where: { tenantId, outletId: outlet.id }, orderBy: { weekday: "asc" } }), timezone: outlet.timezone }; }
    catch (error) { if (error instanceof ConflictException) throw error; throw new ServiceUnavailableException(); }
  }
  async publicList(slug: string) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) throw new NotFoundException();
    try {
      const tenant = await this.db.tenant.findFirst({ where: { slug, status: "active" }, select: { id: true } });
      if (!tenant) throw new NotFoundException();
      const outlet = await this.outlet(tenant.id);
      const rows = await this.db.weeklyHours.findMany({ where: { tenantId: tenant.id, outletId: outlet.id }, orderBy: { weekday: "asc" }, select: { weekday: true, openMinute: true, closeMinute: true } });
      return { data: rows, timezone: outlet.timezone, source: "restaurant_api", dateExceptionsSupported: false };
    } catch (error) { if (error instanceof NotFoundException || error instanceof ConflictException) throw error; throw new ServiceUnavailableException(); }
  }
  async save(tenantId: string, input: unknown, staffId?: string) {
    const data = hoursInput(input);
    try {
      const outlet = await this.outlet(tenantId);
      await this.db.$transaction(async tx => {
        await tx.weeklyHours.upsert({ where: { tenantId_outletId_weekday: { tenantId, outletId: outlet.id, weekday: data.weekday } }, create: { tenantId, outletId: outlet.id, ...data }, update: { openMinute: data.openMinute, closeMinute: data.closeMinute } });
        if (staffId) await tx.operationalAudit.create({ data: { tenantId, staffId, action: "weekly_hours.saved" } });
      });
      return { ok: true };
    } catch (error) { if (error instanceof ConflictException) throw error; throw new ServiceUnavailableException(); }
  }
  async onModuleDestroy() { await this.db.$disconnect(); }
}
