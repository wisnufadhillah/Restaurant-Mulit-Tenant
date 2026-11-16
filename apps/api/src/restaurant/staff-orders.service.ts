import { BadRequestException, HttpException, Injectable, NotFoundException, OnModuleDestroy, ServiceUnavailableException } from "@nestjs/common";
import { createDatabaseClient } from "../database/client";
import { staffReservationQuery } from "./staff-reservations.service";

export const staffPaymentStatuses = ["unpaid", "pending", "settlement", "deny", "cancel", "expire", "failure"];
export function staffOrderQuery(input: Record<string, unknown>) {
  if (!input || Object.keys(input).some(key => !["date", "paymentStatus", "page"].includes(key))) throw new BadRequestException();
  if (input.paymentStatus !== undefined && (typeof input.paymentStatus !== "string" || !staffPaymentStatuses.includes(input.paymentStatus))) throw new BadRequestException();
  const { page, startAt } = staffReservationQuery({ ...(input.date === undefined ? {} : { date: input.date }), ...(input.page === undefined ? {} : { page: input.page }) });
  return { page, ...(startAt ? { createdAt: startAt } : {}), ...(input.paymentStatus === undefined ? {} : { paymentStatus: input.paymentStatus as string }) };
}
const fields = { id: true, code: true, createdAt: true, orderTotal: true, status: true, paymentStatus: true } as const;

export function staffOrderItems(input: unknown) {
  if (!Array.isArray(input)) throw new Error("Invalid order snapshot");
  return input.map(item => {
    if (!item || typeof item !== "object" || typeof item.name !== "string" || !Number.isSafeInteger(item.price) || item.price < 0 || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || !Number.isSafeInteger(item.price * item.quantity)) throw new Error("Invalid order snapshot");
    return { name: item.name, price: item.price as number, quantity: item.quantity as number, subtotal: item.price * item.quantity };
  });
}

@Injectable()
export class StaffOrdersService implements OnModuleDestroy {
  private readonly db = createDatabaseClient();
  async list(tenantId: string, input: Record<string, unknown>) {
    const { page, ...filters } = staffOrderQuery(input);
    try {
      return await this.db.$transaction(async tx => {
        const where = { tenantId, ...filters };
        const data = await tx.order.findMany({ where, select: fields, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * 20, take: 20 });
        const total = await tx.order.count({ where });
        return { data, page, pageSize: 20, total };
      }, { isolationLevel: "RepeatableRead", maxWait: 2000, timeout: 5000 });
    } catch { throw new ServiceUnavailableException(); }
  }
  async detail(tenantId: string, id: string) {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)) throw new NotFoundException();
    try {
      const row = await this.db.order.findFirst({ where: { tenantId, id }, select: { ...fields, customerName: true, items: true, paymentEvents: { where: { tenantId, orderId: id }, select: { id: true, fromStatus: true, toStatus: true, createdAt: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] } } });
      if (!row) throw new NotFoundException();
      return { data: { id: row.id, code: row.code, createdAt: row.createdAt, orderTotal: row.orderTotal, status: row.status, paymentStatus: row.paymentStatus, customerName: row.customerName, items: staffOrderItems(row.items), paymentEvents: row.paymentEvents.map(event => ({ id: event.id, fromStatus: event.fromStatus, toStatus: event.toStatus, createdAt: event.createdAt })) } };
    } catch (error) { if (error instanceof HttpException) throw error; throw new ServiceUnavailableException(); }
  }
  async onModuleDestroy() { await this.db.$disconnect(); }
}
