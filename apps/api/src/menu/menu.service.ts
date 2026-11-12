import { BadRequestException, Injectable, NotFoundException, OnModuleDestroy, ServiceUnavailableException } from "@nestjs/common";
import { createDatabaseClient } from "../database/client";
import { menuImage, uploadedMenuImage } from "./menu-images";
import { MenuImageStorage } from "./menu-image-storage";
import { Readable } from "node:stream";

export function menuInput(input: unknown, availabilityOnly = false) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new BadRequestException();
  const body = input as Record<string, unknown>;
  const allowed = availabilityOnly ? ["isAvailable"] : ["name", "description", "price", "isActive", "isAvailable", ...(Object.hasOwn(body, "imageKey") ? ["imageKey"] : [])];
  if (Object.keys(body).sort().join() !== [...allowed].sort().join()) throw new BadRequestException();
  if (typeof body.isAvailable !== "boolean") throw new BadRequestException();
  if (availabilityOnly) return { isAvailable: body.isAvailable };
  if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 120 || typeof body.description !== "string" || body.description.length > 1000 || typeof body.price !== "number" || !Number.isInteger(body.price) || body.price < 0 || body.price > 100000000 || typeof body.isActive !== "boolean") throw new BadRequestException();
  if (Object.hasOwn(body, "imageKey") && body.imageKey !== null && !menuImage(body.imageKey) && !uploadedMenuImage(body.imageKey)) throw new BadRequestException();
  return { name: body.name.trim(), description: body.description, price: body.price, isActive: body.isActive, isAvailable: body.isAvailable, ...(Object.hasOwn(body, "imageKey") ? { imageKey: body.imageKey as string | null } : {}) };
}

@Injectable()
export class MenuService implements OnModuleDestroy {
  private readonly db = createDatabaseClient();
  private readonly images = new MenuImageStorage();
  async upload(tenantId: string, request: Readable & { headers: Record<string, string | string[] | undefined> }) {
    try { if (await this.db.menuUpload.count({ where: { tenantId } }) >= 200) throw new BadRequestException(); }
    catch (error) { if (error instanceof BadRequestException) throw error; throw new ServiceUnavailableException(); }
    return this.images.upload(tenantId, request, async (key, bytes) => {
      if (await this.db.menuUpload.count({ where: { tenantId } }) >= 200) throw new BadRequestException();
      await this.db.menuUpload.create({ data: { tenantId, key, bytes } });
    });
  }
  async image(key: string, tenantId?: string, slug?: string) {
    if (!uploadedMenuImage(key) || (!tenantId && (!slug || slug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)))) throw new NotFoundException();
    try {
      const upload = await this.db.menuUpload.findFirst({ where: { key, ...(tenantId ? { tenantId } : { tenant: { slug, status: "active", menuItems: { some: { imageKey: key, isActive: true } } } }) }, select: { key: true } });
      if (!upload) throw new NotFoundException();
      return await this.images.read(key);
    } catch (error) { if (error instanceof NotFoundException) throw error; throw new ServiceUnavailableException(); }
  }
  async list(tenantId: string) {
    try { return { data: await this.db.menuItem.findMany({ where: { tenantId }, orderBy: [{ name: "asc" }, { id: "asc" }] }) }; }
    catch { throw new ServiceUnavailableException(); }
  }
  async publicList(slug: string, includeImages = false) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) throw new NotFoundException();
    try {
      const tenant = await this.db.tenant.findFirst({ where: { slug, status: "active" }, select: { menuItems: { where: { isActive: true }, orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true, description: true, price: true, isAvailable: true, ...(includeImages ? { imageKey: true } : {}) } } } });
      if (!tenant) throw new NotFoundException();
      return { data: tenant.menuItems, source: "restaurant_api" };
    } catch (error) { if (error instanceof NotFoundException) throw error; throw new ServiceUnavailableException(); }
  }
  async create(tenantId: string, input: unknown, staffId?: string) {
    const data = menuInput(input);
    if (!("name" in data)) throw new BadRequestException();
    try { return await this.db.$transaction(async tx => {
      if (uploadedMenuImage(data.imageKey) && !await tx.menuUpload.findUnique({ where: { tenantId_key: { tenantId, key: data.imageKey } } })) throw new BadRequestException();
      const item = await tx.menuItem.create({ data: { tenantId, ...data } });
      if (staffId) await tx.operationalAudit.create({ data: { tenantId, staffId, action: "menu.created" } });
      return { data: item };
    }); }
    catch (error) { if (error instanceof BadRequestException) throw error; throw new ServiceUnavailableException(); }
  }
  async update(tenantId: string, id: string, input: unknown, availabilityOnly: boolean, staffId?: string) {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) throw new NotFoundException();
    const data = menuInput(input, availabilityOnly);
    try {
      return await this.db.$transaction(async tx => {
        if ("imageKey" in data && uploadedMenuImage(data.imageKey) && !await tx.menuUpload.findUnique({ where: { tenantId_key: { tenantId, key: data.imageKey } } })) throw new BadRequestException();
        const result = await tx.menuItem.updateMany({ where: { tenantId, id }, data });
        if (!result.count) throw new NotFoundException();
        if (staffId) await tx.operationalAudit.create({ data: { tenantId, staffId, action: availabilityOnly ? "menu.availability_changed" : "menu.updated" } });
        return { ok: true };
      });
    } catch (error) { if (error instanceof NotFoundException || error instanceof BadRequestException) throw error; throw new ServiceUnavailableException(); }
  }
  async onModuleDestroy() { await this.db.$disconnect(); }
}
