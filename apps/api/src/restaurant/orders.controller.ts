import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, HttpCode, OnModuleDestroy, OnModuleInit, Param, Post, Req, Res, ServiceUnavailableException } from "@nestjs/common";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { createDatabaseClient } from "../database/client";
import { StaffController, StaffRequest, StaffResponse } from "../auth/staff.controller";
import { StaffService } from "../auth/staff.service";
import type { Order, Prisma } from "../generated/prisma/client";
import { ChatSessionsService } from "./chat-sessions.service";
import { chatCookie } from "./chat-session.controller";
import { ReservationLimiter } from "./reservation-limiter";
import { lockReservationTenant } from "./reservation-lock";
import { paymentsEnabled, paymentsConfigured, PaymentsDisabledException } from "./payments";

const OPTIONS = { isolationLevel: "ReadCommitted" as const, maxWait: 10_000, timeout: 10_000 };
const SNAP_ORIGIN = "https://app.sandbox.midtrans.com";
const STATUS_ORIGIN = "https://api.sandbox.midtrans.com";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TRANSACTION_STATUSES = new Set(["settlement", "capture", "pending", "expire", "cancel", "deny", "failure"]);
type PaymentFields = { order_id: string; status_code: string; gross_amount: string; transaction_status: string; currency?: string; fraud_status?: string };

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BadRequestException();
  return value as Record<string, unknown>;
}
function paymentFields(value: unknown, remote = false): PaymentFields {
  const input = record(value);
  if (typeof input.order_id !== "string" || input.order_id.length < 1 || input.order_id.length > 100 ||
      typeof input.status_code !== "string" || !/^\d{3}$/.test(input.status_code) ||
      typeof input.gross_amount !== "string" || !/^\d{1,12}(?:\.\d{1,2})?$/.test(input.gross_amount) ||
      typeof input.transaction_status !== "string" || !TRANSACTION_STATUSES.has(input.transaction_status) ||
      (remote ? input.currency !== "IDR" : input.currency !== undefined && input.currency !== "IDR") ||
      (input.fraud_status !== undefined && !["accept", "challenge", "deny"].includes(input.fraud_status as string))) throw new BadRequestException();
  return input as PaymentFields;
}
function matchesAmount(amount: string, total: number): boolean {
  const [whole, fraction = ""] = amount.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0")) === BigInt(total) * 100n;
}
function paymentStatus(fields: PaymentFields): string {
  if (fields.fraud_status === "deny") return "deny";
  if (fields.transaction_status === "settlement" || fields.transaction_status === "capture") return fields.fraud_status === undefined || fields.fraud_status === "accept" ? "settlement" : "pending";
  // Keep the existing stored failure vocabulary and public response shape.
  return fields.transaction_status === "failure" ? "deny" : fields.transaction_status;
}

@Controller("chat/orders")
export class OrdersController implements OnModuleInit, OnModuleDestroy {
  private readonly db = createDatabaseClient();
  private readonly customerLimiter = new ReservationLimiter();
  private readonly notificationIngressLimiter = new ReservationLimiter();
  private readonly providerLimiter = new ReservationLimiter();
  constructor(private readonly sessions: ChatSessionsService) {}

  onModuleInit() {
    paymentsEnabled();
    if (process.env.MIDTRANS_IS_PRODUCTION !== undefined && process.env.MIDTRANS_IS_PRODUCTION !== "false") throw new Error("Only sandbox payments are supported");
  }
  private requirePayments() {
    if (!paymentsEnabled()) throw new PaymentsDisabledException();
    this.key();
  }
  private key() {
    this.onModuleInit();
    if (!paymentsConfigured()) throw new ServiceUnavailableException("Payment unavailable");
    return process.env.MIDTRANS_SERVER_KEY!;
  }
  private prepare(req: StaffRequest, res: StaffResponse, mutation: boolean) {
    // Explicit foreign origins and cross-site reads are rejected; same-origin GET may omit Origin.
    new StaffController({} as StaffService).prepare(req, res, mutation || req.headers.origin !== undefined);
    if (req.headers["sec-fetch-site"] === "cross-site") throw new ForbiddenException();
    if (mutation && req.headers["content-type"]?.toString().split(";")[0].trim().toLowerCase() !== "application/json") throw new ForbiddenException();
    const token = chatCookie(req);
    this.customerLimiter.consume(createHash("sha256").update(token).digest("hex"));
    return token;
  }
  private receipt(order: Order) {
    return { data: { id: order.id, code: order.code, orderTotal: order.orderTotal, paymentStatus: order.paymentStatus, redirectUrl: order.redirectUrl, snapToken: order.snapToken } };
  }
  private replay(order: Order) {
    if (order.snapCreationState !== "ready" || !order.redirectUrl || !order.snapToken) throw new ServiceUnavailableException("Payment initialization unresolved; retry only with the same request key");
    return this.receipt(order);
  }
  private async owner(tx: Prisma.TransactionClient, session: { id: string; tenantId: string }) {
    if (!await tx.chatSession.findFirst({ where: { id: session.id, tenantId: session.tenantId, revokedAt: null, expiresAt: { gt: new Date() }, tenant: { status: "active" } }, select: { id: true } })) throw new ForbiddenException();
  }

  @Get("capabilities")
  async capabilities(@Req() req: StaffRequest, @Res({ passthrough: true }) res: StaffResponse) {
    await this.sessions.readForOrders(this.prepare(req, res, false));
    return { data: { paymentsEnabled: paymentsConfigured() } };
  }

  @Post()
  async create(@Body() body: unknown, @Req() req: StaffRequest, @Res({ passthrough: true }) res: StaffResponse) {
    res.setHeader("Cache-Control", "no-store");
    this.requirePayments();
    const token = this.prepare(req, res, true);
    const session = await this.sessions.readForOrders(token);
    const input = record(body);
    if (Object.keys(input).sort().join() !== "customerName,idempotencyKey,items" || typeof input.customerName !== "string" || !input.customerName.trim() || input.customerName.length > 120 || typeof input.idempotencyKey !== "string" || !input.idempotencyKey.trim() || input.idempotencyKey.length > 80 || !Array.isArray(input.items) || !input.items.length || input.items.length > 30) throw new BadRequestException();
    const customerName = input.customerName.trim(), idempotencyKey = input.idempotencyKey;
    const requested = new Map<string, number>();
    for (const row of input.items) {
      const item = record(row);
      if (Object.keys(item).sort().join() !== "id,quantity" || typeof item.id !== "string" || !UUID.test(item.id) || !Number.isInteger(item.quantity) || Number(item.quantity) < 1 || Number(item.quantity) > 20) throw new BadRequestException();
      const id = item.id.toLowerCase(), quantity = (requested.get(id) ?? 0) + Number(item.quantity);
      if (quantity > 20) throw new BadRequestException();
      requested.set(id, quantity);
    }
    const lines = [...requested].sort(([a], [b]) => a.localeCompare(b));
    const requestHash = createHash("sha256").update(JSON.stringify([session.tenantId, session.id, customerName, lines])).digest("hex");
    const key = this.key();
    const claim = await this.db.$transaction(async tx => {
      await lockReservationTenant(tx, session.tenantId);
      await this.owner(tx, session);
      const existing = await tx.order.findUnique({ where: { tenantId_idempotencyKey: { tenantId: session.tenantId, idempotencyKey } } });
      if (existing) {
        if (existing.chatSessionId !== session.id) throw new ForbiddenException();
        if (existing.requestHash !== requestHash) throw new ConflictException("Idempotency payload mismatch");
        return { order: existing, claimed: false };
      }
      const menu = await tx.menuItem.findMany({ where: { tenantId: session.tenantId, id: { in: lines.map(([id]) => id) }, isActive: true, isAvailable: true }, select: { id: true, name: true, price: true } });
      if (menu.length !== requested.size) throw new BadRequestException("Menu item unavailable");
      const items = menu.map(item => ({ id: item.id, name: item.name, price: item.price, quantity: requested.get(item.id)! }));
      const orderTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      if (!Number.isSafeInteger(orderTotal) || orderTotal < 1 || orderTotal > 100000000) throw new BadRequestException();
      // Persist dispatch ownership before HTTP. A crashed/uncertain dispatch is never automatically repeated.
      const order = await tx.order.create({ data: { tenantId: session.tenantId, chatSessionId: session.id, code: `DS-${randomUUID()}`, customerName, orderTotal, items, midtransOrderId: randomUUID(), idempotencyKey, requestHash, snapCreationState: "creating", paymentStatus: "pending" } });
      return { order, claimed: true };
    }, OPTIONS);
    if (!claim.claimed) return this.replay(claim.order);
    const order = claim.order;
    let snap: { token: string; redirect_url: string };
    try {
      const response = await fetch(`${SNAP_ORIGIN}/snap/v1/transactions`, { method: "POST", headers: { authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`, "content-type": "application/json" }, body: JSON.stringify({ transaction_details: { order_id: order.midtransOrderId, gross_amount: order.orderTotal }, item_details: (order.items as { id: string; name: string; price: number; quantity: number }[]).map(item => ({ ...item, name: item.name.slice(0, 50) })) }), signal: AbortSignal.timeout(15000), redirect: "error" });
      if (response.status !== 201) throw new Error("Snap unavailable");
      const result = record(await response.json());
      if (typeof result.token !== "string" || !result.token || result.token.length > 4096 || typeof result.redirect_url !== "string" || result.redirect_url.length > 4096) throw new Error("Invalid Snap response");
      const url = new URL(result.redirect_url);
      if (url.origin !== SNAP_ORIGIN || url.protocol !== "https:" || url.username || url.password || url.port) throw new Error("Invalid payment redirect");
      snap = { token: result.token, redirect_url: result.redirect_url };
    } catch {
      await this.db.order.updateMany({ where: { id: order.id, tenantId: session.tenantId, snapCreationState: "creating" }, data: { snapCreationState: "unknown" } });
      throw new ServiceUnavailableException("Payment initialization unresolved; retry only with the same request key");
    }
    // No external request inside a database transaction, including on retries.
    const saved = await this.db.$transaction(async tx => {
      await lockReservationTenant(tx, session.tenantId);
      await tx.order.updateMany({ where: { id: order.id, tenantId: session.tenantId, snapCreationState: "creating" }, data: { snapToken: snap.token, redirectUrl: snap.redirect_url, snapCreationState: "ready" } });
      return tx.order.findUniqueOrThrow({ where: { id: order.id } });
    }, OPTIONS);
    await this.sessions.readForOrders(token);
    return this.replay(saved);
  }

  @Post("notification")
  @HttpCode(200)
  async notification(@Body() body: unknown) {
    this.requirePayments();
    let fields: PaymentFields, key: string;
    try {
      const input = record(body);
      if (Buffer.byteLength(JSON.stringify(input)) > 16384) throw new BadRequestException();
      fields = paymentFields(input); key = this.key();
      if (typeof input.signature_key !== "string" || !/^[a-fA-F0-9]{128}$/.test(input.signature_key)) throw new BadRequestException();
      const expected = createHash("sha512").update(`${fields.order_id}${fields.status_code}${fields.gross_amount}${process.env.MIDTRANS_SIGNATURE_SECRET!}`).digest();
      if (!timingSafeEqual(expected, Buffer.from(input.signature_key, "hex"))) throw new BadRequestException();
    } catch (error) {
      // Rejected ingress has its own budget; it cannot starve customers or signed work.
      this.notificationIngressLimiter.consume();
      throw error;
    }
    this.providerLimiter.consume();
    const release = this.providerLimiter.acquireVerification();
    try {
      const order = await this.db.order.findUnique({ where: { midtransOrderId: fields.order_id } });
      if (!order || !matchesAmount(fields.gross_amount, order.orderTotal)) throw new BadRequestException();
      let remote: PaymentFields;
      try {
        const verify = await fetch(`${STATUS_ORIGIN}/v2/${encodeURIComponent(fields.order_id)}/status`, { headers: { authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}` }, signal: AbortSignal.timeout(10000), redirect: "error" });
        if (!verify.ok) throw new Error("Status unavailable");
        remote = paymentFields(await verify.json(), true);
        if (remote.order_id !== fields.order_id || !matchesAmount(remote.gross_amount, order.orderTotal)) throw new Error("Status mismatch");
      } catch { throw new ServiceUnavailableException("Payment verification unavailable"); }
      const next = paymentStatus(remote);
      // A signed fraud denial must never be promoted to paid, even if the status response disagrees.
      if (next === "settlement" && (fields.fraud_status === "deny" || remote.status_code !== "200")) throw new BadRequestException();
      await this.db.$transaction(async tx => {
        await lockReservationTenant(tx, order.tenantId);
        const current = await tx.order.findUniqueOrThrow({ where: { id: order.id } });
        if (current.paymentStatus === next || current.paymentStatus === "settlement" || (current.paymentStatus !== "unpaid" && current.paymentStatus !== "pending" && next !== "settlement")) return;
        const changed = await tx.order.updateMany({ where: { id: current.id, tenantId: current.tenantId, paymentStatus: current.paymentStatus }, data: { paymentStatus: next, ...(next === "settlement" ? { status: "confirmed" } : {}) } });
        if (changed.count !== 1) throw new ConflictException();
        await tx.orderPaymentEvent.create({ data: { tenantId: current.tenantId, orderId: current.id, fromStatus: current.paymentStatus, toStatus: next } });
      }, OPTIONS);
      return { ok: true };
    } finally { release(); }
  }

  @Get(":id/status")
  async status(@Param("id") id: string, @Req() req: StaffRequest, @Res({ passthrough: true }) res: StaffResponse) {
    const session = await this.sessions.readForOrders(this.prepare(req, res, false));
    if (!UUID.test(id)) throw new BadRequestException();
    const order = await this.db.order.findFirst({ where: { id, tenantId: session.tenantId, chatSessionId: session.id }, select: { code: true, paymentStatus: true, orderTotal: true } });
    return { data: order ?? null };
  }
  async onModuleDestroy() { await this.db.$disconnect(); }
}
