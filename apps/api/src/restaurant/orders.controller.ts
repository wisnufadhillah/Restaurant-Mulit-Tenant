import { BadRequestException, Body, Controller, Headers, HttpCode, Param, Post, Get, Req } from "@nestjs/common";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createDatabaseClient } from "../database/client";
import type { StaffRequest } from "../auth/staff.controller";
import { ChatSessionsService } from "./chat-sessions.service";
import { chatCookie } from "./chat-session.controller";

@Controller("chat/orders")
export class OrdersController {
  private readonly db = createDatabaseClient();
  constructor(private readonly sessions: ChatSessionsService) {}
  @Post()
  async create(@Body() body: unknown, @Req() req: StaffRequest) {
    const session = this.sessions.read(chatCookie(req), "demo-padang");
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new BadRequestException();
    const input = body as Record<string, unknown>;
    if (Object.keys(input).sort().join() !== "customerName,idempotencyKey,items" || typeof input.customerName !== "string" || !input.customerName.trim() || input.customerName.length > 120 || typeof input.idempotencyKey !== "string" || input.idempotencyKey.length > 80 || !Array.isArray(input.items) || !input.items.length || input.items.length > 30) throw new BadRequestException();
    const requested = new Map<string, number>();
    for (const row of input.items) {
      if (!row || typeof row !== "object") throw new BadRequestException();
      const item = row as Record<string, unknown>;
      if (Object.keys(item).sort().join() !== "id,quantity" || typeof item.id !== "string" || !Number.isInteger(item.quantity) || Number(item.quantity) < 1 || Number(item.quantity) > 20) throw new BadRequestException();
      requested.set(item.id, (requested.get(item.id) ?? 0) + Number(item.quantity));
    }
    const tenant = await this.db.tenant.findUnique({ where: { slug: session.slug }, select: { id: true } });
    if (!tenant) throw new BadRequestException();
    const menu = await this.db.menuItem.findMany({ where: { tenantId: tenant.id, id: { in: [...requested.keys()] }, isActive: true, isAvailable: true }, select: { id: true, name: true, price: true } });
    if (menu.length !== requested.size) throw new BadRequestException("Menu item unavailable");
    const items = menu.map(item => ({ id: item.id, name: item.name, price: item.price, quantity: requested.get(item.id)! }));
    const orderTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (!Number.isSafeInteger(orderTotal) || orderTotal < 1 || orderTotal > 100000000) throw new BadRequestException();
    const existing = await this.db.order.findUnique({ where: { tenantId_idempotencyKey: { tenantId: tenant.id, idempotencyKey: input.idempotencyKey } } });
    if (existing) return { data: { id: existing.id, code: existing.code, orderTotal: existing.orderTotal, paymentStatus: existing.paymentStatus, redirectUrl: existing.redirectUrl } };
    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey) throw new BadRequestException("Payment unavailable");
    const code = `DS-${randomUUID().slice(0, 8).toUpperCase()}`;
    const midtransOrderId = `${tenant.id}-${input.idempotencyKey}`.slice(0, 50);
    const production = process.env.MIDTRANS_IS_PRODUCTION === "true";
    const base = production ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com";
    const auth = Buffer.from(`${serverKey}:`).toString("base64");
    const response = await fetch(`${production ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com"}/snap/v1/transactions`, { method: "POST", headers: { authorization: `Basic ${auth}`, "content-type": "application/json" }, body: JSON.stringify({ transaction_details: { order_id: midtransOrderId, gross_amount: orderTotal }, item_details: items.map(i => ({ id: i.id, price: i.price, quantity: i.quantity, name: i.name.slice(0, 50) })) }), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new BadRequestException("Payment unavailable");
    const snap = await response.json() as { token?: string; redirect_url?: string };
    if (!snap.token || !snap.redirect_url || !snap.redirect_url.startsWith(base)) throw new BadRequestException("Payment unavailable");
    const order = await this.db.order.create({ data: { tenantId: tenant.id, code, customerName: input.customerName.trim(), orderTotal, items, midtransOrderId, snapToken: snap.token, redirectUrl: snap.redirect_url, idempotencyKey: input.idempotencyKey, paymentStatus: "pending" } });
    return { data: { id: order.id, code, orderTotal, paymentStatus: order.paymentStatus, redirectUrl: snap.redirect_url, snapToken: snap.token } };
  }
  @Post("notification")
  @HttpCode(200)
  async notification(@Body() body: Record<string, string>) {
    const key = process.env.MIDTRANS_SERVER_KEY;
    if (!key || !body.order_id || !body.status_code || !body.gross_amount || !body.signature_key || !body.transaction_status) throw new BadRequestException();
    const expected = createHmac("sha512", key).update(`${body.order_id}${body.status_code}${body.gross_amount}${key}`).digest("hex");
    const a = Buffer.from(expected), b = Buffer.from(body.signature_key);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new BadRequestException();
    const order = await this.db.order.findUnique({ where: { midtransOrderId: body.order_id }, select: { orderTotal: true } });
    if (!order || String(order.orderTotal) !== body.gross_amount) throw new BadRequestException();
    const production = process.env.MIDTRANS_IS_PRODUCTION === "true";
    const verify = await fetch(`${production ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com"}/v2/${encodeURIComponent(body.order_id)}/status`, { headers: { authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` }, signal: AbortSignal.timeout(10000) });
    const remote = verify.ok ? await verify.json() as { transaction_status?: string; fraud_status?: string } : {};
    const status = remote.transaction_status ? remote : { transaction_status: body.transaction_status, fraud_status: body.fraud_status };
    const map: Record<string, string> = { settlement: "settlement", capture: status.fraud_status === "accept" ? "settlement" : "pending", pending: "pending", expire: "expire", cancel: "cancel", deny: "deny" };
    const paymentStatus = map[status.transaction_status ?? ""];
    if (!paymentStatus) throw new BadRequestException();
    await this.db.order.updateMany({ where: { midtransOrderId: body.order_id }, data: { paymentStatus, ...(paymentStatus === "settlement" ? { status: "confirmed" } : {}) } });
    return { ok: true };
  }
  @Get(":id/status")
  async status(@Param("id") id: string, @Req() req: StaffRequest) {
    const session = this.sessions.read(chatCookie(req), "demo-padang");
    const tenant = await this.db.tenant.findUnique({ where: { slug: session.slug }, select: { id: true } });
    const order = tenant && await this.db.order.findFirst({ where: { id, tenantId: tenant.id }, select: { code: true, paymentStatus: true, orderTotal: true } });
    return { data: order ?? null };
  }
}
