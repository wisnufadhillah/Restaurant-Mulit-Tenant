import { ConflictException, ForbiddenException, Injectable, NotFoundException, OnModuleDestroy } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { createDatabaseClient } from "../database/client";
import { createSessionToken, hashSessionToken } from "../auth/crypto";
import { Prisma } from "../generated/prisma/client";
import { calculateAvailability, customerCancellationAllowed, reservationWindow } from "./availability";
import { confirmationAllowed, replayReservation, ReservationInput, reservationRequestHash } from "./reservation-input";
import { lockReservationTenant } from "./reservation-lock";

const OPTIONS = { isolationLevel: "ReadCommitted" as const, maxWait: 10_000, timeout: 10_000 };
const SESSION_MS = 32 * 24 * 60 * 60_000;
const CONFIRMATION_MS = 5 * 60_000;

@Injectable()
export class ReservationRepository implements OnModuleDestroy {
  private readonly db = createDatabaseClient();

  private async scope(tx: Prisma.TransactionClient, slug: string) {
    const tenant = await tx.tenant.findFirst({ where: { slug, status: "active" }, select: { id: true } });
    if (!tenant) throw new NotFoundException();
    await lockReservationTenant(tx, tenant.id);
    // Recheck after waiting for the tenant lock.
    if (!await tx.tenant.findFirst({ where: { id: tenant.id, slug, status: "active" }, select: { id: true } })) throw new NotFoundException();
    return tenant.id;
  }

  private async owner(tx: Prisma.TransactionClient, tenantId: string, tokenHash: string, now: Date) {
    const owner = await tx.reservationCreatorSession.findFirst({ where: { tenantId, tokenHash } });
    if (!owner || owner.revokedAt || owner.expiresAt <= now) throw new ForbiddenException();
    return owner;
  }

  private async outlet(tx: Prisma.TransactionClient, tenantId: string) {
    const rows = await tx.outlet.findMany({ where: { tenantId, isActive: true }, take: 2 });
    if (rows.length !== 1) throw new ConflictException();
    return rows[0];
  }

  private async available(tx: Prisma.TransactionClient, tenantId: string, outlet: Awaited<ReturnType<ReservationRepository["outlet"]>>, body: ReservationInput, now: Date) {
    const input = { date: body.date, time: body.time, partySize: body.partySize };
    const window = reservationWindow(input, outlet, now);
    const scope = { tenantId, outletId: outlet.id };
    const weeklyHours = await tx.weeklyHours.findMany({ where: { ...scope, weekday: window.weekday } });
    const specialHours = await tx.specialHours.findMany({ where: { ...scope, date: new Date(`${body.date}T00:00:00Z`) } });
    const tables = await tx.diningTable.findMany({ where: { ...scope, isActive: true }, select: { id: true, capacity: true, isActive: true } });
    const reservations = await tx.reservation.findMany({ where: { ...scope, status: "confirmed", startAt: { lt: window.endAt }, endAt: { gt: window.startAt } }, select: { tableId: true, startAt: true, endAt: true, status: true } });
    const result = calculateAvailability(input, { policy: outlet, weeklyHours, specialHours: specialHours.map(row => ({ ...row, date: row.date.toISOString().slice(0, 10) })), tables, reservations }, now);
    if (!result.available) throw new ConflictException("Reservation unavailable");
    return result;
  }

  session(slug: string, tokenHash: string | undefined) {
    return this.db.$transaction(async tx => {
      const tenantId = await this.scope(tx, slug);
      const now = new Date();
      if (tokenHash) {
        const owner = await this.owner(tx, tenantId, tokenHash, now);
        return { expiresAt: owner.expiresAt.toISOString() };
      }
      const token = createSessionToken();
      const expiresAt = new Date(now.getTime() + SESSION_MS);
      await tx.reservationCreatorSession.create({ data: { tenantId, tokenHash: hashSessionToken(token), createdAt: now, expiresAt } });
      return { token, expiresAt: expiresAt.toISOString() };
    }, OPTIONS);
  }

  confirmation(slug: string, tokenHash: string, body: ReservationInput) {
    return this.db.$transaction(async tx => {
      const tenantId = await this.scope(tx, slug);
      const now = new Date();
      const owner = await this.owner(tx, tenantId, tokenHash, now);
      const outlet = await this.outlet(tx, tenantId);
      const available = await this.available(tx, tenantId, outlet, body, now);
      const nonce = createSessionToken();
      const expiresAt = new Date(Math.min(now.getTime() + CONFIRMATION_MS, owner.expiresAt.getTime()));
      await tx.reservationConfirmation.updateMany({ where: { tenantId, creatorSessionId: owner.id, consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: now } });
      await tx.reservationConfirmation.create({ data: { tenantId, creatorSessionId: owner.id, nonceHash: hashSessionToken(nonce), requestHash: reservationRequestHash(tenantId, outlet.id, body), createdAt: now, expiresAt } });
      return { nonce, expiresAt: expiresAt.toISOString(), summary: { ...body, startAt: available.startAt, endAt: available.endAt, timezone: available.timezone, held: false } };
    }, OPTIONS);
  }

  create(slug: string, tokenHash: string, body: ReservationInput, nonceHash: string, idempotencyKey: string) {
    return this.db.$transaction(async tx => {
      const tenantId = await this.scope(tx, slug);
      const now = new Date();
      const owner = await this.owner(tx, tenantId, tokenHash, now);
      const existing = await tx.reservation.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } } });
      if (existing) {
        const hash = reservationRequestHash(tenantId, existing.outletId, body);
        replayReservation(owner, tenantId, hash, existing, now);
        return this.receipt(existing);
      }
      const outlet = await this.outlet(tx, tenantId);
      const hash = reservationRequestHash(tenantId, outlet.id, body);
      const confirmation = await tx.reservationConfirmation.findFirst({ where: { tenantId, creatorSessionId: owner.id, nonceHash } });
      if (!confirmation) throw new ForbiddenException();
      confirmationAllowed(owner, tenantId, hash, confirmation, now);
      const available = await this.available(tx, tenantId, outlet, body, now);
      const commitTime = new Date();
      await this.owner(tx, tenantId, tokenHash, commitTime);
      confirmationAllowed(owner, tenantId, hash, confirmation, commitTime);
      reservationWindow({ date: body.date, time: body.time, partySize: body.partySize }, outlet, commitTime);
      const reservation = await tx.reservation.create({ data: {
        tenantId, outletId: outlet.id, tableId: available.tableId, creatorSessionId: owner.id,
        referenceCode: randomUUID(), managementTokenHash: hashSessionToken(createSessionToken()),
        managementExpiresAt: new Date(new Date(available.endAt).getTime() + 24 * 60 * 60_000),
        guestName: body.guestName, guestPhone: body.guestPhone, partySize: body.partySize,
        startAt: new Date(available.startAt), endAt: new Date(available.endAt), status: "confirmed", source: "web", idempotencyKey, requestHash: hash,
      } });
      await tx.reservationEvent.create({ data: { tenantId, reservationId: reservation.id, fromStatus: null, toStatus: "confirmed", actorType: "customer" } });
      const consumed = await tx.reservationConfirmation.updateMany({ where: { id: confirmation.id, tenantId, creatorSessionId: owner.id, consumedAt: null, invalidatedAt: null, expiresAt: { gt: commitTime } }, data: { consumedAt: commitTime, reservationId: reservation.id } });
      if (consumed.count !== 1) throw new ConflictException();
      return this.receipt(reservation);
    }, OPTIONS);
  }

  managementSession(slug: string, creatorHash: string, idempotencyKey: string, existingHash?: string) {
    return this.db.$transaction(async tx => {
      const tenantId = await this.scope(tx, slug);
      const now = new Date();
      const owner = await this.owner(tx, tenantId, creatorHash, now);
      const reservation = await tx.reservation.findUnique({ where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } } });
      if (!reservation) throw new NotFoundException();
      if (reservation.creatorSessionId !== owner.id || reservation.managementExpiresAt <= now) throw new ForbiddenException();
      if (existingHash) {
        const session = await tx.reservationManagementSession.findFirst({ where: { tenantId, reservationId: reservation.id, tokenHash: existingHash, revokedAt: null, expiresAt: { gt: now } } });
        if (session) return { expiresAt: session.expiresAt.toISOString() };
      }
      const token = createSessionToken();
      const expiresAt = new Date(Math.min(now.getTime() + 30 * 60_000, reservation.managementExpiresAt.getTime()));
      // Independent sessions avoid concurrent responses invalidating each other's cookie.
      const count = await tx.reservationManagementSession.count({ where: { tenantId, reservationId: reservation.id, revokedAt: null, expiresAt: { gt: now } } });
      if (count >= 8) throw new ConflictException("Management session limit reached");
      await tx.reservationManagementSession.create({ data: { tenantId, reservationId: reservation.id, tokenHash: hashSessionToken(token), createdAt: now, expiresAt } });
      return { token, expiresAt: expiresAt.toISOString() };
    }, OPTIONS);
  }

  manage(slug: string, tokenHash: string, cancel: boolean, expectedReference?: string) {
    return this.db.$transaction(async tx => {
      const tenantId = await this.scope(tx, slug);
      const now = new Date();
      const session = await tx.reservationManagementSession.findFirst({ where: { tenantId, tokenHash, revokedAt: null, expiresAt: { gt: now } } });
      if (!session) throw new ForbiddenException();
      const row = await tx.reservation.findFirst({ where: { tenantId, id: session.reservationId, managementExpiresAt: { gt: now } } });
      if (!row) throw new ForbiddenException();
      if (cancel && row.referenceCode !== expectedReference) throw new ConflictException("Displayed reservation no longer matches private session");
      if (!cancel || row.status === "cancelled") return this.receipt(row);
      if (row.status !== "confirmed") throw new ConflictException();
      const outlet = await tx.outlet.findFirst({ where: { tenantId, id: row.outletId } });
      if (!outlet || !customerCancellationAllowed(row.startAt, outlet, new Date())) throw new ConflictException("Cancellation cutoff exceeded");
      const changed = await tx.reservation.updateMany({ where: { tenantId, id: row.id, status: "confirmed" }, data: { status: "cancelled" } });
      if (changed.count !== 1) throw new ConflictException();
      await tx.reservationEvent.create({ data: { tenantId, reservationId: row.id, fromStatus: "confirmed", toStatus: "cancelled", actorType: "customer" } });
      return this.receipt({ ...row, status: "cancelled" });
    }, OPTIONS);
  }

  revokeManagement(slug: string, tokenHash: string) {
    return this.db.$transaction(async tx => {
      const tenantId = await this.scope(tx, slug);
      await tx.reservationManagementSession.updateMany({ where: { tenantId, tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
    }, OPTIONS);
  }

  private receipt(row: { referenceCode: string; startAt: Date; endAt: Date; partySize: number; status: string }) {
    return { referenceCode: row.referenceCode, startAt: row.startAt.toISOString(), endAt: row.endAt.toISOString(), timezone: "Asia/Jakarta", partySize: row.partySize, status: row.status };
  }

  async onModuleDestroy() { await this.db.$disconnect(); }
}
