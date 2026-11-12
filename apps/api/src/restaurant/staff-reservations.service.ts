import { BadRequestException, ConflictException, HttpException, Injectable, NotFoundException, OnModuleDestroy, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { createDatabaseClient } from "../database/client";
import { lockReservationTenant } from "./reservation-lock";

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function staffTransitionInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new BadRequestException();
  const body = input as Record<string, unknown>;
  if (body.status === "cancelled" && Object.keys(body).sort().join() === "reason,status" && typeof body.reason === "string" && !/[\u0000-\u001f\u007f-\u009f]/.test(body.reason)) {
    const reason = body.reason.trim();
    if (reason && reason.length <= 500) return { status: "cancelled" as const, reason };
  }
  if (body.status === "completed" && Object.keys(body).join() === "status") return { status: "completed" as const, reason: null };
  if (body.status === "no_show" && Object.keys(body).sort().join() === "reviewed,status" && body.reviewed === true) return { status: "no_show" as const, reason: null };
  throw new BadRequestException();
}
export function staffTransitionAllowed(status: string, endAt: Date, next: string, now: Date) {
  if (status !== "confirmed" || (next !== "cancelled" && now.getTime() <= endAt.getTime())) throw new ConflictException();
}
export function staffAuditQuery(input: Record<string, unknown>) {
  if (!input || Object.keys(input).some(key => key !== "page")) throw new BadRequestException();
  return staffReservationQuery(input).page;
}
type AuditRow = { id: string; source: string; createdAt: Date; action: string; actorType: string; reservationId: string | null; fromStatus: string | null; toStatus: string | null };

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
  private readonly attempts = new Map<string, { count: number; until: number }>();
  async transition(tenantId: string, staffId: string, sessionHash: string, id: string, key: unknown, input: unknown) {
    if (!uuid.test(id)) throw new NotFoundException();
    if (typeof key !== "string" || !uuid.test(key)) throw new BadRequestException();
    const body = staffTransitionInput(input), eventId = key.toLowerCase();
    const time = Date.now();
    for (const [actor, attempt] of this.attempts) if (attempt.until <= time) this.attempts.delete(actor);
    const actorKey = `${tenantId}:${staffId}`, attempt = this.attempts.get(actorKey);
    if ((attempt?.count ?? 0) >= 60 || (!attempt && this.attempts.size >= 10000)) throw new HttpException("Rate limited", 429);
    this.attempts.set(actorKey, { count: (attempt?.count ?? 0) + 1, until: attempt?.until ?? time + 60000 });
    try {
      return await this.db.$transaction(async tx => {
        await lockReservationTenant(tx, tenantId);
        const now = new Date();
        const actor = await tx.staffSession.findFirst({ where: { tenantId, staffId, tokenHash: sessionHash, revokedAt: null, expiresAt: { gt: now }, staff: { isActive: true, role: { in: ["owner", "staff"] }, tenant: { status: "active" } } }, select: { staffId: true } });
        if (!actor) throw new UnauthorizedException();
        const reservation = await tx.reservation.findFirst({ where: { tenantId, id }, select: { id: true, status: true, endAt: true } });
        if (!reservation) throw new NotFoundException();
        const existing = await tx.reservationEvent.findUnique({ where: { id: eventId } });
        const receipt = (event: { id: string; reservationId: string; toStatus: string; createdAt: Date }) => ({ data: { reservationId: event.reservationId, status: event.toStatus, eventId: event.id, changedAt: event.createdAt.toISOString() } });
        if (existing) {
          if (existing.tenantId !== tenantId || existing.reservationId !== id.toLowerCase() || existing.staffId !== staffId || existing.actorType !== "staff" || existing.fromStatus !== "confirmed" || existing.toStatus !== body.status || existing.reason !== body.reason) throw new ConflictException();
          return receipt(existing);
        }
        staffTransitionAllowed(reservation.status, reservation.endAt, body.status, now);
        const changed = await tx.reservation.updateMany({ where: { tenantId, id, status: "confirmed" }, data: { status: body.status } });
        if (changed.count !== 1) throw new ConflictException();
        const event = await tx.reservationEvent.create({ data: { id: eventId, tenantId, reservationId: id, fromStatus: "confirmed", toStatus: body.status, actorType: "staff", staffId, reason: body.reason, createdAt: now } });
        return receipt(event);
      }, { isolationLevel: "ReadCommitted", maxWait: 10000, timeout: 10000 });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") throw new ConflictException();
      throw new ServiceUnavailableException();
    }
  }
  async audit(tenantId: string, input: Record<string, unknown>) {
    const page = staffAuditQuery(input);
    try {
      return await this.db.$transaction(async tx => {
        const data = await tx.$queryRaw<AuditRow[]>`
          SELECT id, source, created_at AS "createdAt", action, actor_type AS "actorType", reservation_id AS "reservationId", from_status AS "fromStatus", to_status AS "toStatus"
          FROM (
            SELECT id, 'operational' AS source, created_at, CASE WHEN action IN ('menu.created', 'menu.updated', 'menu.availability_changed', 'profile.updated', 'table.created', 'table.updated', 'weekly_hours.saved', 'special_hours.saved', 'special_hours.removed') THEN action ELSE 'operational.other' END AS action, 'staff' AS actor_type, NULL::uuid AS reservation_id, NULL::text AS from_status, NULL::text AS to_status
            FROM operational_audits WHERE tenant_id = ${tenantId}::uuid
            UNION ALL
            SELECT id, 'reservation' AS source, created_at, 'reservation.' || to_status AS action, actor_type, reservation_id, from_status, to_status
            FROM reservation_events WHERE tenant_id = ${tenantId}::uuid
          ) AS activity ORDER BY created_at DESC, source ASC, id DESC LIMIT 20 OFFSET ${(page - 1) * 20}`;
        const [count] = await tx.$queryRaw<{ total: bigint }[]>`SELECT (SELECT count(*) FROM operational_audits WHERE tenant_id = ${tenantId}::uuid) + (SELECT count(*) FROM reservation_events WHERE tenant_id = ${tenantId}::uuid) AS total`;
        return { data, page, pageSize: 20, total: Number(count.total) };
      }, { isolationLevel: "RepeatableRead", maxWait: 2000, timeout: 5000 });
    } catch { throw new ServiceUnavailableException(); }
  }
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
