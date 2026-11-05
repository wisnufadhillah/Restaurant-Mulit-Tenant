import { BadRequestException } from "@nestjs/common";

export interface ReservationPolicy {
  timezone: string;
  durationMinutes: number;
  minNoticeMinutes: number;
  maxAdvanceDays: number;
  maxPartySize: number;
  cancelCutoffMinutes: number;
}
interface Hours { openMinute: number | null; closeMinute: number | null; }
export interface AvailabilitySnapshot {
  policy: ReservationPolicy;
  weeklyHours: (Hours & { weekday: number })[];
  specialHours: (Hours & { date: string })[];
  tables: { id: string; capacity: number; isActive: boolean }[];
  reservations: { tableId: string; startAt: Date; endAt: Date; status: string }[];
}
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

function calendarDate(text: unknown): Date {
  if (typeof text !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new BadRequestException("Invalid calendar date");
  const date = new Date(`${text}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== text) throw new BadRequestException("Invalid calendar date");
  return date;
}

function validPolicy(policy: ReservationPolicy) {
  if (policy.timezone !== "Asia/Jakarta" || policy.durationMinutes !== 90 || policy.minNoticeMinutes !== 60 || policy.maxAdvanceDays !== 30 || policy.maxPartySize !== 12 || policy.cancelCutoffMinutes !== 120) throw new Error("Unsupported reservation policy");
}

export function reservationWindow(input: unknown, policy: ReservationPolicy, now: Date) {
  validPolicy(policy);
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid server clock");
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new BadRequestException("Invalid availability input");
  const body = input as Record<string, unknown>;
  if (Object.keys(body).sort().join() !== "date,partySize,time" || typeof body.time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time) || typeof body.partySize !== "number" || !Number.isInteger(body.partySize) || body.partySize < 1 || body.partySize > policy.maxPartySize) throw new BadRequestException("Invalid availability input");
  const date = calendarDate(body.date);
  const [hour, minute] = body.time.split(":").map(Number);
  const startMinute = hour * 60 + minute;
  // The supported outlet timezone is fixed UTC+7, without daylight-saving transitions.
  const startAt = new Date(date.getTime() + (startMinute - 420) * MINUTE);
  const endAt = new Date(startAt.getTime() + policy.durationMinutes * MINUTE);
  if (startAt.getTime() < now.getTime() + policy.minNoticeMinutes * MINUTE) throw new BadRequestException("Reservation requires sixty minutes notice");
  if (startAt.getTime() > now.getTime() + policy.maxAdvanceDays * DAY) throw new BadRequestException("Reservation exceeds advance limit");
  return { date: body.date as string, weekday: date.getUTCDay(), partySize: body.partySize, startMinute, endMinute: startMinute + policy.durationMinutes, startAt, endAt };
}

export function calculateAvailability(input: unknown, snapshot: AvailabilitySnapshot, now: Date) {
  const window = reservationWindow(input, snapshot.policy, now);
  const special = snapshot.specialHours.filter(row => row.date === window.date);
  const weekly = snapshot.weeklyHours.filter(row => row.weekday === window.weekday);
  if (special.length > 1 || weekly.length > 1) throw new Error("Ambiguous operating hours");
  const schedule = special[0] ?? weekly[0];
  const base = { startAt: window.startAt.toISOString(), endAt: window.endAt.toISOString(), timezone: snapshot.policy.timezone, held: false as const };
  if (!schedule) return { ...base, available: false as const, reason: "hours_unconfigured" as const };
  if (schedule.openMinute === null && schedule.closeMinute === null) return { ...base, available: false as const, reason: "closed" as const };
  const { openMinute, closeMinute } = schedule;
  if (!Number.isInteger(openMinute) || !Number.isInteger(closeMinute) || openMinute === null || closeMinute === null || openMinute < 0 || closeMinute > 1440 || openMinute >= closeMinute) throw new Error("Invalid operating hours");
  if (window.startMinute < openMinute || window.endMinute > closeMinute) return { ...base, available: false as const, reason: "outside_hours" as const };
  const occupied = new Set<string>();
  for (const reservation of snapshot.reservations) {
    if (reservation.status !== "confirmed") continue;
    const start = reservation.startAt.getTime(), end = reservation.endAt.getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("Invalid confirmed reservation interval");
    if (start < window.endAt.getTime() && end > window.startAt.getTime()) occupied.add(reservation.tableId);
  }
  const candidates = snapshot.tables.filter(table => {
    if (!table.id || !Number.isInteger(table.capacity) || table.capacity < 1 || table.capacity > 12 || typeof table.isActive !== "boolean") throw new Error("Invalid table configuration");
    return table.isActive && table.capacity >= window.partySize && !occupied.has(table.id);
  }).sort((a, b) => a.capacity - b.capacity || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const table = candidates[0];
  return table ? { ...base, available: true as const, tableId: table.id, capacity: table.capacity } : { ...base, available: false as const, reason: "no_table" as const };
}

export function customerCancellationAllowed(startAt: Date, policy: ReservationPolicy, now: Date): boolean {
  validPolicy(policy);
  if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(now.getTime())) throw new Error("Invalid cancellation time");
  return now.getTime() <= startAt.getTime() - policy.cancelCutoffMinutes * MINUTE;
}
