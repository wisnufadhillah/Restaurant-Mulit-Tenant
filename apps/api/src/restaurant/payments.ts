import { ServiceUnavailableException } from "@nestjs/common";

export function paymentsEnabled(): boolean {
  const value = process.env.PAYMENTS_ENABLED;
  if (value === undefined || value === "true") return true;
  if (value === "false") return false;
  throw new Error("Invalid PAYMENTS_ENABLED configuration");
}

export function paymentsConfigured(): boolean {
  return paymentsEnabled() && Boolean(process.env.MIDTRANS_SERVER_KEY?.trim() && process.env.MIDTRANS_SIGNATURE_SECRET?.trim());
}

export class PaymentsDisabledException extends ServiceUnavailableException {
  constructor() { super("Pembayaran belum tersedia."); }
}
