import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleDestroy, ServiceUnavailableException } from "@nestjs/common";
import { createDatabaseClient } from "../database/client";
import { lockReservationTenant } from "./reservation-lock";

export function tableInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new BadRequestException();
  const body = input as Record<string, unknown>;
  if (Object.keys(body).sort().join() !== "capacity,isActive,name" || typeof body.name !== "string" || !body.name.trim() || body.name.length > 80 || typeof body.capacity !== "number" || !Number.isInteger(body.capacity) || body.capacity < 1 || body.capacity > 12 || typeof body.isActive !== "boolean") throw new BadRequestException();
  return { name: body.name.trim(), capacity: body.capacity, isActive: body.isActive };
}

@Injectable()
export class TableService implements OnModuleDestroy {
  private readonly db = createDatabaseClient();
  private async outlet(tenantId: string) {
    const outlets = await this.db.outlet.findMany({ where: { tenantId, isActive: true }, select: { id: true }, take: 2 });
    if (outlets.length !== 1) throw new ConflictException();
    return outlets[0].id;
  }
  async list(tenantId: string) {
    try { const outletId = await this.outlet(tenantId); return { data: await this.db.diningTable.findMany({ where: { tenantId, outletId }, orderBy: [{ name: "asc" }, { id: "asc" }] }) }; }
    catch (error) { if (error instanceof ConflictException) throw error; throw new ServiceUnavailableException(); }
  }
  async save(tenantId: string, input: unknown, id?: string, staffId?: string) {
    const data = tableInput(input);
    if (id && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) throw new NotFoundException();
    try {
      return await this.db.$transaction(async tx => {
        await lockReservationTenant(tx, tenantId);
        const outlets = await tx.outlet.findMany({ where: { tenantId, isActive: true }, select: { id: true }, take: 2 });
        if (outlets.length !== 1) throw new ConflictException();
        const outletId = outlets[0].id;
        if (id) {
          const conflict = await tx.reservation.findFirst({ where: { tenantId, outletId, tableId: id, status: "confirmed", endAt: { gt: new Date() }, ...(data.isActive ? { partySize: { gt: data.capacity } } : {}) }, select: { id: true } });
          if (conflict) throw new ConflictException("Table change conflicts with an existing reservation");
        }
        if (staffId) await tx.operationalAudit.create({ data: { tenantId, staffId, action: id ? "table.updated" : "table.created" } });
        if (!id) return { data: await tx.diningTable.create({ data: { ...data, tenantId, outletId } }) };
        const result = await tx.diningTable.updateMany({ where: { id, tenantId, outletId }, data });
        if (!result.count) throw new NotFoundException();
        return { ok: true };
      });
    } catch (error) {
      if (error instanceof ConflictException || error instanceof NotFoundException) throw error;
      if (typeof error === "object" && error && "code" in error && error.code === "P2002") throw new ConflictException();
      throw new ServiceUnavailableException();
    }
  }
  async onModuleDestroy() { await this.db.$disconnect(); }
}
