import { BadRequestException, ConflictException, Injectable, OnModuleDestroy, ServiceUnavailableException } from "@nestjs/common";
import { createDatabaseClient } from "../database/client";
import { hoursInput } from "./hours.service";

export function specialInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new BadRequestException();
  const body = input as Record<string, unknown>;
  if (Object.keys(body).sort().join() !== "closeMinute,date,openMinute" || typeof body.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) throw new BadRequestException();
  const date = new Date(`${body.date}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== body.date) throw new BadRequestException();
  const interval = hoursInput({ weekday: 0, openMinute: body.openMinute, closeMinute: body.closeMinute });
  return { date, openMinute: interval.openMinute, closeMinute: interval.closeMinute };
}
@Injectable()
export class SpecialHoursService implements OnModuleDestroy {
  private readonly db = createDatabaseClient();
  async save(tenantId: string, staffId: string, input: unknown) {
    const data = specialInput(input);
    try {
      await this.db.$transaction(async tx => {
        const outlets = await tx.outlet.findMany({ where: { tenantId, isActive: true }, take: 2, select: { id: true } });
        if (outlets.length !== 1) throw new ConflictException();
        const key = { tenantId, outletId: outlets[0].id, date: data.date };
        await tx.specialHours.upsert({ where: { tenantId_outletId_date: key }, create: { ...key, openMinute: data.openMinute, closeMinute: data.closeMinute }, update: { openMinute: data.openMinute, closeMinute: data.closeMinute } });
        await tx.operationalAudit.create({ data: { tenantId, staffId, action: "special_hours.saved" } });
      }); return { ok: true };
    } catch (error) { if (error instanceof ConflictException) throw error; throw new ServiceUnavailableException(); }
  }
  async list(tenantId: string) {
    try {
      const outlets = await this.db.outlet.findMany({ where: { tenantId, isActive: true }, take: 2, select: { id: true } });
      if (outlets.length !== 1) throw new ConflictException();
      const rows = await this.db.specialHours.findMany({ where: { tenantId, outletId: outlets[0].id }, orderBy: { date: "asc" }, take: 367, select: { date: true, openMinute: true, closeMinute: true } });
      if (rows.length > 366) throw new ConflictException();
      return { data: rows };
    }
    catch (error) { if (error instanceof ConflictException) throw error; throw new ServiceUnavailableException(); }
  }
  async remove(tenantId: string, staffId: string, dateText: string) {
    const { date } = specialInput({ date: dateText, openMinute: null, closeMinute: null });
    try {
      await this.db.$transaction(async tx => {
        const outlets = await tx.outlet.findMany({ where: { tenantId, isActive: true }, take: 2, select: { id: true } });
        if (outlets.length !== 1) throw new ConflictException();
        const result = await tx.specialHours.deleteMany({ where: { tenantId, outletId: outlets[0].id, date } });
        if (result.count) await tx.operationalAudit.create({ data: { tenantId, staffId, action: "special_hours.removed" } });
      }); return { ok: true };
    } catch (error) { if (error instanceof ConflictException) throw error; throw new ServiceUnavailableException(); }
  }
  async resolve(tenantId: string, dateText: string) {
    const { date } = specialInput({ date: dateText, openMinute: null, closeMinute: null });
    try {
      const outlets = await this.db.outlet.findMany({ where: { tenantId, isActive: true }, take: 2, select: { id: true, timezone: true } });
      if (outlets.length !== 1) throw new ConflictException();
      const outletId = outlets[0].id;
      const special = await this.db.specialHours.findUnique({ where: { tenantId_outletId_date: { tenantId, outletId, date } } });
      const weekly = special ? null : await this.db.weeklyHours.findUnique({ where: { tenantId_outletId_weekday: { tenantId, outletId, weekday: date.getUTCDay() } } });
      const row = special ?? weekly;
      return { data: { date: dateText, configured: !!row, openMinute: row?.openMinute ?? null, closeMinute: row?.closeMinute ?? null, source: special ? "special" : weekly ? "weekly" : "unconfigured", timezone: outlets[0].timezone } };
    } catch (error) { if (error instanceof ConflictException) throw error; throw new ServiceUnavailableException(); }
  }
  async onModuleDestroy() { await this.db.$disconnect(); }
}
