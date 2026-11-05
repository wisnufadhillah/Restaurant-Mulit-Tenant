import { ConflictException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";

type Hours = { openMinute: number | null; closeMinute: number | null };
export function reservationFitsHours(booking: { startAt: Date; endAt: Date }, hours: Hours): boolean {
  if (hours.openMinute === null || hours.closeMinute === null) return false;
  const local = new Date(booking.startAt.getTime() + 420 * 60_000);
  const minute = local.getUTCHours() * 60 + local.getUTCMinutes();
  const endMinute = minute + (booking.endAt.getTime() - booking.startAt.getTime()) / 60_000;
  return Number.isFinite(endMinute) && minute >= hours.openMinute && endMinute <= hours.closeMinute;
}

export async function protectReservationSchedule(tx: Prisma.TransactionClient, tenantId: string, outletId: string,
  change: { weekday: number; hours: Hours } | { date: Date; hours: Hours | null }): Promise<void> {
  const rows = await tx.reservation.findMany({ where: { tenantId, outletId, status: "confirmed", endAt: { gt: new Date() } }, select: { startAt: true, endAt: true } });
  for (const row of rows) {
    const local = new Date(row.startAt.getTime() + 420 * 60_000);
    const date = new Date(`${local.toISOString().slice(0, 10)}T00:00:00Z`);
    let hours: Hours | null;
    if ("weekday" in change) {
      if (local.getUTCDay() !== change.weekday) continue;
      const special = await tx.specialHours.findUnique({ where: { tenantId_outletId_date: { tenantId, outletId, date } } });
      if (special) continue;
      hours = change.hours;
    } else {
      if (date.getTime() !== change.date.getTime()) continue;
      hours = change.hours ?? await tx.weeklyHours.findUnique({ where: { tenantId_outletId_weekday: { tenantId, outletId, weekday: local.getUTCDay() } } });
    }
    if (!hours || !reservationFitsHours(row, hours)) throw new ConflictException("Schedule conflicts with an existing reservation");
  }
}
