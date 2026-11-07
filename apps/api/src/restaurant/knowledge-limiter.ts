import { TooManyRequestsException } from "./knowledge-rate-limit";
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";

export class KnowledgeLimiter {
  private readonly sessions = new Map<string, number>();
  private end = 0;
  private total = 0;
  private inflight = 0;
  constructor(private readonly clock: () => number = () => performance.now()) {}
  acquire(slug: string, sessionId: string): () => void {
    const now = this.clock();
    if (now >= this.end) { this.sessions.clear(); this.total = 0; this.end = now + 60000; }
    const deny = () => new TooManyRequestsException(Math.max(1, Math.ceil((this.end - now) / 1000)));
    if (this.total >= 200) throw deny();
    this.total++;
    const key = createHash("sha256").update(JSON.stringify([slug, sessionId])).digest("hex");
    const used = this.sessions.get(key) ?? 0;
    if (used >= 20 || (!this.sessions.has(key) && this.sessions.size >= 1000) || this.inflight >= 4) throw deny();
    this.sessions.set(key, used + 1); this.inflight++;
    let released = false;
    return () => { if (!released) { released = true; this.inflight--; } };
  }
}
