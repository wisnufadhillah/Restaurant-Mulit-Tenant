import { BadRequestException, Injectable, NotFoundException, OnModuleDestroy, ServiceUnavailableException } from "@nestjs/common";
import { createDatabaseClient } from "../database/client";

export function menuInput(input: unknown, availabilityOnly = false) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new BadRequestException();
  const body = input as Record<string, unknown>;
  const allowed = availabilityOnly ? ["isAvailable"] : ["name", "description", "price", "isActive", "isAvailable"];
  if (Object.keys(body).sort().join() !== [...allowed].sort().join()) throw new BadRequestException();
  if (typeof body.isAvailable !== "boolean") throw new BadRequestException();
  if (availabilityOnly) return { isAvailable: body.isAvailable };
  if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 120 || typeof body.description !== "string" || body.description.length > 1000 || typeof body.price !== "number" || !Number.isInteger(body.price) || body.price < 0 || body.price > 100000000 || typeof body.isActive !== "boolean") throw new BadRequestException();
  return { name: body.name.trim(), description: body.description, price: body.price, isActive: body.isActive, isAvailable: body.isAvailable };
}

@Injectable()
export class MenuService implements OnModuleDestroy {
  private readonly db = createDatabaseClient();
  async list(tenantId: string) {
    try { return { data: await this.db.menuItem.findMany({ where: { tenantId }, orderBy: [{ name: "asc" }, { id: "asc" }] }) }; }
    catch { throw new ServiceUnavailableException(); }
  }
  async publicList(slug: string) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) throw new NotFoundException();
    try {
      const tenant = await this.db.tenant.findFirst({ where: { slug, status: "active" }, select: { menuItems: { where: { isActive: true }, orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true, description: true, price: true, isAvailable: true } } } });
      if (!tenant) throw new NotFoundException();
      return { data: tenant.menuItems, source: "restaurant_api" };
    } catch (error) { if (error instanceof NotFoundException) throw error; throw new ServiceUnavailableException(); }
  }
  async create(tenantId: string, input: unknown, staffId?: string) {
    const data = menuInput(input);
    if (data.name === undefined) throw new BadRequestException();
    try { return await this.db.$transaction(async tx => {
      const item = await tx.menuItem.create({ data: { tenantId, ...data } });
      if (staffId) await tx.operationalAudit.create({ data: { tenantId, staffId, action: "menu.created" } });
      return { data: item };
    }); }
    catch { throw new ServiceUnavailableException(); }
  }
  async update(tenantId: string, id: string, input: unknown, availabilityOnly: boolean, staffId?: string) {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) throw new NotFoundException();
    const data = menuInput(input, availabilityOnly);
    try {
      return await this.db.$transaction(async tx => {
        const result = await tx.menuItem.updateMany({ where: { tenantId, id }, data });
        if (!result.count) throw new NotFoundException();
        if (staffId) await tx.operationalAudit.create({ data: { tenantId, staffId, action: availabilityOnly ? "menu.availability_changed" : "menu.updated" } });
        return { ok: true };
      });
    } catch (error) { if (error instanceof NotFoundException) throw error; throw new ServiceUnavailableException(); }
  }
  async onModuleDestroy() { await this.db.$disconnect(); }
}
