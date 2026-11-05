import { ConflictException, Injectable, NotFoundException, OnModuleDestroy } from "@nestjs/common";
import { createDatabaseClient } from "../database/client";
import { AvailabilitySnapshot, reservationWindow } from "./availability";

export interface AvailabilityInput { date: string; time: string; partySize: number; }

@Injectable()
export class AvailabilityRepository implements OnModuleDestroy {
  private readonly db = createDatabaseClient();

  snapshot(slug: string, input: AvailabilityInput, now: Date): Promise<AvailabilitySnapshot> {
    return this.db.$transaction(async tx => {
      const tenant = await tx.tenant.findFirst({ where: { slug, status: "active" }, select: { id: true } });
      if (!tenant) throw new NotFoundException();
      const outlets = await tx.outlet.findMany({ where: { tenantId: tenant.id, isActive: true }, take: 2, select: { id: true, timezone: true, durationMinutes: true, minNoticeMinutes: true, maxAdvanceDays: true, maxPartySize: true, cancelCutoffMinutes: true } });
      if (!outlets.length) throw new NotFoundException();
      if (outlets.length !== 1) throw new ConflictException();
      const { id: outletId, ...policy } = outlets[0];
      const scope = { tenantId: tenant.id, outletId };
      const window = reservationWindow(input, policy, now);
      const date = new Date(`${window.date}T00:00:00.000Z`);
      const weeklyHours = await tx.weeklyHours.findMany({ where: { ...scope, weekday: window.weekday }, select: { weekday: true, openMinute: true, closeMinute: true } });
      const specialHours = await tx.specialHours.findMany({ where: { ...scope, date }, select: { date: true, openMinute: true, closeMinute: true } });
      const tables = await tx.diningTable.findMany({ where: { ...scope, isActive: true }, select: { id: true, capacity: true, isActive: true } });
      const reservations = await tx.reservation.findMany({ where: { ...scope, status: "confirmed", startAt: { lt: window.endAt }, endAt: { gt: window.startAt } }, select: { tableId: true, startAt: true, endAt: true, status: true } });
      return { policy, weeklyHours, specialHours: specialHours.map(row => ({ ...row, date: row.date.toISOString().slice(0, 10) })), tables, reservations };
    }, { isolationLevel: "RepeatableRead", maxWait: 2000, timeout: 5000 });
  }

  async onModuleDestroy() { await this.db.$disconnect(); }
}
