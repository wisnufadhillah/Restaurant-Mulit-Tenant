import { BadRequestException, Body, ConflictException, Controller, Get, Injectable, OnModuleDestroy, Param, Put, Req, Res, ServiceUnavailableException } from "@nestjs/common";
import { createDatabaseClient } from "../database/client";
import { StaffController, StaffRequest, StaffResponse, cookieToken } from "../auth/staff.controller";
import { StaffService } from "../auth/staff.service";

export function profileInput(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new BadRequestException();
  const b = input as Record<string, unknown>;
  if (Object.keys(b).sort().join() !== "address,contactPhone,name,outletName") throw new BadRequestException();
  for (const [key, max] of [["name", 120], ["outletName", 120], ["address", 500]] as const) if (typeof b[key] !== "string" || !b[key].trim() || b[key].length > max) throw new BadRequestException();
  if (typeof b.contactPhone !== "string" || b.contactPhone.length > 40 || !/^[+0-9 ()-]*$/.test(b.contactPhone)) throw new BadRequestException();
  return { name: (b.name as string).trim(), outletName: (b.outletName as string).trim(), address: (b.address as string).trim(), contactPhone: b.contactPhone };
}
@Injectable()
export class ProfileService implements OnModuleDestroy {
  private readonly db = createDatabaseClient();
  async read(tenantId: string) {
    try {
      const tenant = await this.db.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true, outlets: { where: { isActive: true }, take: 2, select: { name: true, address: true, contactPhone: true } } } });
      if (tenant.outlets.length !== 1) throw new ConflictException();
      const outlet = tenant.outlets[0]; return { data: { name: tenant.name, outletName: outlet.name, address: outlet.address, contactPhone: outlet.contactPhone } };
    } catch (error) { if (error instanceof ConflictException) throw error; throw new ServiceUnavailableException(); }
  }
  async save(tenantId: string, input: unknown, staffId?: string) {
    const data = profileInput(input);
    try {
      await this.db.$transaction(async tx => {
        const outlets = await tx.outlet.findMany({ where: { tenantId, isActive: true }, take: 2, select: { id: true } });
        if (outlets.length !== 1) throw new ConflictException();
        if (staffId) await tx.operationalAudit.create({ data: { tenantId, staffId, action: "profile.updated" } });
        await tx.tenant.update({ where: { id: tenantId }, data: { name: data.name } });
        await tx.outlet.updateMany({ where: { tenantId, id: outlets[0].id }, data: { name: data.outletName, address: data.address, contactPhone: data.contactPhone } });
      }); return { ok: true };
    } catch (error) { if (error instanceof ConflictException) throw error; throw new ServiceUnavailableException(); }
  }
  async onModuleDestroy() { await this.db.$disconnect(); }
}
@Controller("staff/tenants/:slug/profile")
export class ProfileController {
  constructor(private readonly profile: ProfileService, private readonly staff: StaffService) {}
  @Get()
  async read(@Param("slug") slug: string, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    new StaffController(this.staff).prepare(request, response, false);
    const actor = await this.staff.authenticate(cookieToken(request), slug); return this.profile.read(actor.tenantId);
  }
  @Put()
  async save(@Param("slug") slug: string, @Body() body: unknown, @Req() request: StaffRequest, @Res({ passthrough: true }) response: StaffResponse) {
    new StaffController(this.staff).prepare(request, response, true);
    const actor = await this.staff.authenticate(cookieToken(request), slug, ["owner"]); return this.profile.save(actor.tenantId, body, actor.id);
  }
}
