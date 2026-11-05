import { BadRequestException, HttpException, Injectable, ServiceUnavailableException, ForbiddenException } from "@nestjs/common";
import { hashSessionToken } from "../auth/crypto";
import { reservationInput } from "./reservation-input";
import { ReservationRepository } from "./reservation.repository";
import { ReservationLimiter } from "./reservation-limiter";

@Injectable()
export class ReservationService {
  constructor(private readonly repository: ReservationRepository) {}
  private readonly limiter = new ReservationLimiter();
  private limit(token: string | undefined, sessionEndpoint = false, peer?: string) {
    const hash = typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token) ? hashSessionToken(token) : undefined;
    this.limiter.consume(hash, sessionEndpoint, peer);
  }

  private slug(slug: string) {
    if (typeof slug !== "string" || slug.length > 80 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new BadRequestException();
  }
  private token(token: string | undefined) {
    try { return hashSessionToken(token!); } catch { throw new ForbiddenException(); }
  }
  private async safe<T>(run: () => Promise<T>): Promise<T> {
    try { return await run(); } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException();
    }
  }
  session(slug: string, token: string | undefined, peer?: string) {
    this.limit(token, true, peer);
    this.slug(slug);
    const hash = token === undefined ? undefined : this.token(token);
    return this.safe(() => this.repository.session(slug, hash));
  }
  confirmation(slug: string, token: string | undefined, input: unknown) {
    this.limit(token);
    this.slug(slug);
    const hash = this.token(token);
    const body = reservationInput(input);
    return this.safe(() => this.repository.confirmation(slug, hash, body));
  }
  managementSession(slug: string, creatorToken: string | undefined, key: unknown, managementToken?: string) {
    this.limit(creatorToken);
    this.slug(slug);
    const creatorHash = this.token(creatorToken);
    if (typeof key !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(key)) throw new BadRequestException();
    const existingHash = managementToken === undefined ? undefined : this.token(managementToken);
    return this.safe(() => this.repository.managementSession(slug, creatorHash, key, existingHash));
  }
  manage(slug: string, token: string | undefined, cancel: boolean, expectedReference?: string) {
    this.limit(token);
    this.slug(slug);
    const hash = this.token(token);
    return this.safe(() => this.repository.manage(slug, hash, cancel, expectedReference));
  }
  revokeManagement(slug: string, token: string | undefined) {
    this.limit(token);
    this.slug(slug);
    const hash = this.token(token);
    return this.safe(() => this.repository.revokeManagement(slug, hash));
  }
  create(slug: string, token: string | undefined, input: unknown, key: unknown) {
    this.limit(token);
    this.slug(slug);
    const tokenHash = this.token(token);
    if (typeof key !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(key) || !input || typeof input !== "object" || Array.isArray(input)) throw new BadRequestException();
    const envelope = input as Record<string, unknown>;
    if (Object.keys(envelope).sort().join() !== "nonce,reservation") throw new BadRequestException();
    const body = reservationInput(envelope.reservation);
    const nonceHash = this.token(typeof envelope.nonce === "string" ? envelope.nonce : undefined);
    return this.safe(() => this.repository.create(slug, tokenHash, body, nonceHash, key));
  }
}
