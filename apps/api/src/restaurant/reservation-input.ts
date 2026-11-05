import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { createHash } from "node:crypto";

export interface ReservationInput {
  date: string;
  time: string;
  partySize: number;
  guestName: string;
  guestPhone: string;
}
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const HASH = /^[a-f0-9]{64}$/;

export function reservationInput(input: unknown): ReservationInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new BadRequestException();
  const body = input as Record<string, unknown>;
  if (Object.keys(body).sort().join() !== "date,guestName,guestPhone,partySize,time" ||
    typeof body.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) ||
    typeof body.time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.time) ||
    typeof body.partySize !== "number" || !Number.isInteger(body.partySize) || body.partySize < 1 || body.partySize > 12 ||
    typeof body.guestName !== "string" || body.guestName.length > 120 || /[\p{Cc}\p{Cf}]/u.test(body.guestName) ||
    typeof body.guestPhone !== "string" || body.guestPhone.length > 40 || !/^[+0-9 ()-]+$/.test(body.guestPhone)) throw new BadRequestException();
  const date = new Date(`${body.date}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== body.date) throw new BadRequestException();
  const guestName = body.guestName.normalize("NFC").trim().replace(/\s+/gu, " ");
  let guestPhone = body.guestPhone.replace(/[ ()-]/g, "");
  if (guestPhone.startsWith("0")) guestPhone = `+62${guestPhone.slice(1)}`;
  else if (guestPhone.startsWith("62")) guestPhone = `+${guestPhone}`;
  if (!guestName || !/^\+[1-9]\d{7,14}$/.test(guestPhone)) throw new BadRequestException();
  return { date: body.date, time: body.time, partySize: body.partySize, guestName, guestPhone };
}

export function reservationRequestHash(tenantId: string, outletId: string, input: unknown): string {
  if (!UUID.test(tenantId) || !UUID.test(outletId)) throw new Error("Invalid reservation scope");
  const body = reservationInput(input);
  return createHash("sha256").update(JSON.stringify([
    "web-reservation-v1", tenantId.toLowerCase(), outletId.toLowerCase(), "Asia/Jakarta", 90,
    body.date, body.time, body.partySize, body.guestName, body.guestPhone,
  ])).digest("hex");
}

export interface ReservationOwner {
  tenantId: string;
  id: string;
  expiresAt: Date;
  revokedAt: Date | null;
}
function activeOwner(owner: ReservationOwner, tenantId: string, now: Date) {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid server clock");
  if (!UUID.test(tenantId) || owner.tenantId !== tenantId || !UUID.test(owner.id) || owner.revokedAt !== null ||
    !Number.isFinite(owner.expiresAt.getTime()) || owner.expiresAt.getTime() <= now.getTime()) throw new ForbiddenException();
}

export function replayReservation<T extends { tenantId: string; creatorSessionId: string | null; requestHash: string }>(
  owner: ReservationOwner, tenantId: string, hash: string, existing: T | null, now: Date,
): T | null {
  activeOwner(owner, tenantId, now);
  if (!HASH.test(hash)) throw new Error("Invalid reservation request hash");
  if (!existing) return null;
  if (existing.tenantId !== tenantId || existing.creatorSessionId !== owner.id) throw new ForbiddenException();
  if (existing.requestHash !== hash) throw new ConflictException();
  return existing;
}

export interface ReservationConfirmation {
  tenantId: string;
  creatorSessionId: string;
  requestHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  invalidatedAt: Date | null;
}
export function confirmationAllowed(owner: ReservationOwner, tenantId: string, hash: string, confirmation: ReservationConfirmation, now: Date): void {
  activeOwner(owner, tenantId, now);
  if (!HASH.test(hash)) throw new Error("Invalid reservation request hash");
  if (confirmation.tenantId !== tenantId || confirmation.creatorSessionId !== owner.id) throw new ForbiddenException();
  if (confirmation.requestHash !== hash || confirmation.consumedAt !== null || confirmation.invalidatedAt !== null ||
    !Number.isFinite(confirmation.expiresAt.getTime()) || confirmation.expiresAt.getTime() <= now.getTime()) throw new ConflictException();
}
