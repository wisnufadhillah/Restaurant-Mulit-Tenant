import { BadRequestException, HttpException, Injectable, NotFoundException, OnModuleDestroy, ServiceUnavailableException } from "@nestjs/common";
import { createDatabaseClient } from "../database/client";

export function staffReservationQuery(input: Record<string, unknown>) {
  if (!input || Object.keys(input).some(key => !["date", "status", "page"].includes(key))) throw new BadRequestException();
  const { date, status, page } = input;
  if (page !== undefined && (typeof page !== "string" || !/^[1-9]\d{0,2}$/.test(page))) throw new BadRequestException();
  if (status !== undefined && (typeof status !== "string" || !["confirmed", "cancelled", "completed", "no_show"].includes(status))) throw new BadRequestException();
  let startAt;
  if (date !== undefined) {
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException();
    const calendar = new Date(`${date}T00:00:00Z`);
    if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== date) throw new BadRequestException();
    const from = new Date(calendar.getTime() - 7 * 3600000);
    startAt = { gte: from, lt: new Date(from.getTime() + 86400000) };
  }
  return { page: page === undefined ? 1 : Number(page), ...(status === undefined ? {} : { status: status as string }), ...(startAt ? { startAt } : {}) };
}
const fields = { id: true, referenceCode: true, guestName: true, partySize: true, startAt: true, endAt: true, status: true, table: { select: { name: true } }, outlet: { select: { name: true } } } as const;

@Injectable()
export class StaffReservationsService implements OnModuleDestroy {
  private readonly db = createDatabaseClient();
  async list(tenantId: string, input: Record<string, unknown>) {
    const { page, ...filters } = staffReservationQuery(input);
    try {
      return await this.db.$transaction(async tx => {
        const where = { tenantId, ...filters };
        const data = await tx.reservation.findMany({ where, select: fields, orderBy: [{ startAt: "asc" }, { id: "asc" }], skip: (page - 1) * 20, take: 20 });
        const total = await tx.reservation.count({ where });
        return { data, page, pageSize: 20, total };
      }, { isolationLevel: "RepeatableRead", maxWait: 2000, timeout: 5000 });
    } catch { throw new ServiceUnavailableException(); }
  }
  async detail(tenantId: string, id: string) {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) throw new NotFoundException();
    try {
      const data = await this.db.reservation.findFirst({ where: { tenantId, id }, select: { ...fields, guestPhone: true, createdAt: true, source: true } });
      if (!data) throw new NotFoundException();
      return { data };
    } catch (error) { if (error instanceof HttpException) throw error; throw new ServiceUnavailableException(); }
  }
  async onModuleDestroy() { await this.db.$disconnect(); }
}
