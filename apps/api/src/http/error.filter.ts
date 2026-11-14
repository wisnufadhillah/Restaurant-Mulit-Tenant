import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { ReservationRateLimitException } from "../restaurant/reservation-limiter";
import { PaymentsDisabledException } from "../restaurant/payments";

const errors: Record<number, [string, string]> = {
  400: ["INVALID_REQUEST", "Permintaan tidak valid."],
  401: ["UNAUTHORIZED", "Akses tidak terverifikasi."],
  403: ["FORBIDDEN", "Akses ditolak."],
  404: ["NOT_FOUND", "Informasi tidak ditemukan."],
  405: ["METHOD_NOT_ALLOWED", "Metode tidak diizinkan."],
  409: ["CONFLICT", "Permintaan bertentangan dengan kondisi saat ini."],
  413: ["PAYLOAD_TOO_LARGE", "Data terlalu besar."],
  422: ["VALIDATION_FAILED", "Data permintaan tidak valid."],
  429: ["RATE_LIMITED", "Terlalu banyak permintaan."],
  503: ["SERVICE_UNAVAILABLE", "Layanan belum tersedia. Silakan coba lagi."],
};

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const [code, message] = exception instanceof PaymentsDisabledException
      ? ["PAYMENTS_DISABLED", "Pembayaran belum tersedia."]
      : errors[status] ?? ["INTERNAL_ERROR", "Terjadi gangguan layanan."];
    const response = host.switchToHttp().getResponse();
    if (exception instanceof PaymentsDisabledException) response.setHeader("Cache-Control", "no-store");
    if (exception instanceof ReservationRateLimitException) {
      response.setHeader("Retry-After", String(exception.retryAfterSeconds));
      response.setHeader("Cache-Control", "no-store");
    }
    response.status(status).json({ error: { code, message }, request_id: randomUUID() });
  }
}
