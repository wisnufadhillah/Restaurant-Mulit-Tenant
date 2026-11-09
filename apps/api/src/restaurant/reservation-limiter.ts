import { HttpException } from "@nestjs/common";
import { createHmac, randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";

export class ReservationRateLimitException extends HttpException {
  constructor(readonly retryAfterSeconds: number) { super("Too many requests", 429); }
}

export class ReservationLimiter {
  private readonly secret = randomBytes(32);
  private readonly buckets = new Map<string, number>();
  private end = 0;
  private total = 0;
  private verifying = 0;
  private verifications = 0;
  constructor(private readonly clock: () => number = () => performance.now(), private readonly capacity = 4096) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error("Invalid limiter capacity");
  }

  acquireVerification(): () => void {
    if (this.verifying >= 4) throw new ReservationRateLimitException(1);
    if (this.verifications >= 120) throw new ReservationRateLimitException(Math.max(1, Math.ceil((this.end - this.clock()) / 1000)));
    this.verifications++;
    this.verifying++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.verifying--;
    };
  }

  consume(identityHash?: string, sessionEndpoint = false, peer?: string): void {
    const now = this.clock();
    if (!Number.isFinite(now) || now < 0) throw new Error("Invalid limiter clock");
    if (now >= this.end) {
      this.end = now + 60_000;
      this.total = 0;
      this.verifications = 0;
      this.buckets.clear();
    }
    const deny = (): never => { throw new ReservationRateLimitException(Math.max(1, Math.ceil((this.end - now) / 1000))); };
    if (this.total >= 2000) deny();
    this.total++;
    const identities: [string, number][] = [];
    const key = (kind: string, value: string) => createHmac("sha256", this.secret).update(JSON.stringify([kind, value])).digest("hex");
    if (identityHash !== undefined) {
      if (!/^[a-f0-9]{64}$/.test(identityHash)) throw new Error("Invalid limiter identity");
      identities.push([key("session", identityHash), 60]);
    }
    if (sessionEndpoint) identities.push([key("peer", typeof peer === "string" && peer.length > 0 && peer.length <= 128 ? peer : "unknown"), 20]);
    const additions = identities.filter(([id]) => !this.buckets.has(id)).length;
    if (this.buckets.size + additions > this.capacity) deny();
    for (const [id, limit] of identities) if ((this.buckets.get(id) ?? 0) >= limit) deny();
    for (const [id] of identities) this.buckets.set(id, (this.buckets.get(id) ?? 0) + 1);
  }
}
